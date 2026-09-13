import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, cacheKeyFor, OpinlyError, OpinlyConfigError } from '../src/opinly/client.js';

function fakeCache() {
  const store = new Map();
  return {
    store,
    match: async (k) => { const v = store.get(k); return v ? v.clone() : undefined; },
    put: async (k, v) => { store.set(k, v); },
    delete: async (k) => store.delete(k),
  };
}

function fetchStub(handler) {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url, init }); return handler(url, init, calls.length); };
  fn.calls = calls;
  return fn;
}

const env = { OPINLY_API_KEY: 'sk-test', OPINLY_API_URL: 'https://api.example' };

test('cache keys are canonical regardless of param order and drop empties', () => {
  assert.equal(cacheKeyFor('/v1/content/posts', { sort: 'newest', limit: 12, cursor: '' }), cacheKeyFor('/v1/content/posts', { limit: 12, sort: 'newest' }));
  assert.equal(cacheKeyFor('/v1/content/posts', { limit: 12 }), 'https://phonedashcam.com/__opinly-cache/v1/content/posts?limit=12');
});

test('sends bearer + site headers, caches responses, serves fresh hits without refetching', async () => {
  const cache = fakeCache();
  let t = 1_000_000;
  const fetch = fetchStub((url, init) => {
    assert.equal(init.headers.authorization, 'Bearer sk-test');
    assert.equal(init.headers['x-opinly-site-url'], 'https://phonedashcam.com');
    assert.equal(init.headers['x-opinly-blog-prefix'], '/blog');
    assert.match(url, /^https:\/\/api.example\/v1\/content\/posts\?limit=12&sort=newest$/);
    return new Response(JSON.stringify({ data: [], has_more: false, next_cursor: null }), { headers: { 'content-type': 'application/json' } });
  });
  const client = createClient(env, null, { fetch, cache, now: () => t });
  const a = await client.posts({ limit: 12, sort: 'newest' });
  const b = await client.posts({ sort: 'newest', limit: 12, cursor: '' });
  assert.deepEqual(a, b);
  assert.equal(fetch.calls.length, 1);
  assert.equal(cache.store.size, 1);
});

test('stale entries are refetched, and served when the upstream fails', async () => {
  const cache = fakeCache();
  let t = 0;
  let mode = 'ok';
  const fetch = fetchStub(() => {
    if (mode === 'ok') return new Response(JSON.stringify([{ type: 'home', slug: '' }]));
    if (mode === '500') return new Response(JSON.stringify({ code: 'INTERNAL_ERROR', detail: 'boom' }), { status: 500 });
    throw new TypeError('network down');
  });
  const client = createClient(env, null, { fetch, cache, now: () => t, log: () => {} });
  assert.equal((await client.routes()).length, 1);
  t += 700 * 1000; // past the 600s routes TTL
  mode = '500';
  assert.equal((await client.routes()).length, 1);
  assert.equal(fetch.calls.length, 2);
  mode = 'network';
  assert.equal((await client.routes()).length, 1);
  assert.equal(fetch.calls.length, 3);
  // with no cached copy a failure surfaces as OpinlyError
  const fresh = createClient(env, null, { fetch, cache: fakeCache(), now: () => t, log: () => {} });
  await assert.rejects(fresh.routes(), (e) => e instanceof OpinlyError && e.code === 'NETWORK');
});

test('post() returns null on 404 and caches the miss briefly; author() unwraps the envelope', async () => {
  const cache = fakeCache();
  const fetch = fetchStub((url) => {
    if (url.includes('/post?')) return new Response(JSON.stringify({ code: 'NOT_FOUND', status: 404 }), { status: 404, headers: { 'x-request-id': 'r1' } });
    if (url.endsWith('/authors/jane')) return new Response(JSON.stringify({ type: 'author', data: { name: 'Jane', slug: 'jane', posts: [] } }));
    if (url.endsWith('/authors/nobody')) return new Response(JSON.stringify({ type: 'not-found', data: null }));
    return new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), { status: 401 });
  });
  const client = createClient(env, null, { fetch, cache, log: () => {} });
  assert.equal(await client.post('missing'), null);
  assert.equal(await client.post('missing'), null);
  assert.equal(fetch.calls.length, 1);
  assert.equal((await client.author('jane')).name, 'Jane');
  assert.equal(await client.author('nobody'), null);
  await assert.rejects(client.categories(), (e) => e instanceof OpinlyError && e.status === 401 && e.code === 'UNAUTHORIZED');
});

test('throws OpinlyConfigError without an API key', async () => {
  const client = createClient({}, null, { fetch: fetchStub(() => new Response('{}')), cache: fakeCache() });
  assert.equal(client.isConfigured(), false);
  await assert.rejects(client.posts(), (e) => e instanceof OpinlyConfigError);
});
