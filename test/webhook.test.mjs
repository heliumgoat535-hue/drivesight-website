import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { verifySvixSignature, invalidationPlan, handleWebhook, derivedChangesFromPost } from '../src/opinly/webhook.js';
import { cacheKeyFor } from '../src/opinly/client.js';

const secretBytes = randomBytes(24);
const SECRET = `whsec_${secretBytes.toString('base64')}`;

function sign(body, { id = 'msg_1', ts = Math.floor(Date.now() / 1000), secret = secretBytes } = {}) {
  const sig = createHmac('sha256', secret).update(`${id}.${ts}.${body}`).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': `v1,${sig}` };
}

const payload = JSON.stringify({
  type: 'content.routes-changed',
  data: { changed: [
    { type: 'post', slug: 'my-post', lastModified: '2026-07-06T12:00:00.000Z' },
    { type: 'category', slug: 'guides', lastModified: '2026-07-06T12:00:00.000Z' },
    { type: 'author', slug: 'jane', lastModified: '2026-07-06T12:00:00.000Z' },
    { type: 'tag', slug: 'seo', lastModified: '2026-07-06T12:00:00.000Z' },
    { type: 'home', slug: '', lastModified: '2026-07-06T12:00:00.000Z' },
    { type: 'post', slug: '../etc/passwd', lastModified: '2026-07-06T12:00:00.000Z' },
  ] },
});

test('accepts a valid Svix signature (including multiple v1 entries)', async () => {
  const h = sign(payload);
  assert.equal(await verifySvixSignature({ secret: SECRET, headers: h, rawBody: payload }), true);
  const multi = { ...h, 'svix-signature': `v1,${Buffer.alloc(32).toString('base64')} ${h['svix-signature']}` };
  assert.equal(await verifySvixSignature({ secret: SECRET, headers: multi, rawBody: payload }), true);
});

test('rejects wrong secret, tampered body, stale timestamp, missing headers', async () => {
  const h = sign(payload);
  assert.equal(await verifySvixSignature({ secret: `whsec_${randomBytes(24).toString('base64')}`, headers: h, rawBody: payload }), false);
  assert.equal(await verifySvixSignature({ secret: SECRET, headers: h, rawBody: `${payload} ` }), false);
  const old = sign(payload, { ts: Math.floor(Date.now() / 1000) - 3600 });
  assert.equal(await verifySvixSignature({ secret: SECRET, headers: old, rawBody: payload }), false);
  assert.equal(await verifySvixSignature({ secret: SECRET, headers: { 'svix-id': 'x' }, rawBody: payload }), false);
  assert.equal(await verifySvixSignature({ secret: '', headers: h, rawBody: payload }), false);
});

test('invalidation plan maps entities to cache keys and page URLs, skipping unsafe slugs', () => {
  const plan = invalidationPlan(JSON.parse(payload).data.changed);
  assert.ok(plan.cacheKeys.includes(cacheKeyFor('/v1/content/post', { slug: 'my-post' })));
  assert.ok(plan.cacheKeys.includes(cacheKeyFor('/v1/content/posts', { limit: 12, category: 'guides' })));
  assert.ok(plan.cacheKeys.includes(cacheKeyFor('/v1/content/authors/jane')));
  assert.ok(plan.cacheKeys.includes(cacheKeyFor('/v1/content/posts', { limit: 12, tag: 'seo' })));
  assert.ok(plan.cacheKeys.includes(cacheKeyFor('/v1/content/routes')));
  assert.ok(plan.cacheKeys.includes(cacheKeyFor('/v1/content/rss', { limit: 20 })));
  assert.ok(plan.pageUrls.includes('https://phonedashcam.com/blog/my-post'));
  assert.ok(plan.pageUrls.includes('https://phonedashcam.com/blog/category/guides'));
  assert.ok(plan.pageUrls.includes('https://phonedashcam.com/blog/authors/jane'));
  assert.ok(plan.pageUrls.includes('https://phonedashcam.com/blog/tag/seo'));
  assert.ok(plan.pageUrls.includes('https://phonedashcam.com/blog'));
  assert.ok(plan.pageUrls.includes('https://phonedashcam.com/sitemap.xml'));
  assert.ok(plan.pageUrls.includes('https://phonedashcam.com/blog/rss.xml'));
  assert.ok(!plan.cacheKeys.some((k) => k.includes('passwd')));
});

function fakeCache() {
  const store = new Map();
  return {
    store,
    match: async (k) => store.get(k) ?? undefined,
    put: async (k, v) => { store.set(k, v); },
    delete: async (k) => store.delete(k),
  };
}

test('a post-only change also invalidates the lists the cached post belongs to', async () => {
  const post = { slug: 'my-post', category: { slug: 'guides' }, author: { slug: 'jane' }, tags: [{ slug: 'seo' }, { slug: 'android' }] };
  assert.deepEqual(derivedChangesFromPost(post), [
    { type: 'category', slug: 'guides' }, { type: 'author', slug: 'jane' }, { type: 'tag', slug: 'seo' }, { type: 'tag', slug: 'android' },
  ]);
  assert.deepEqual(derivedChangesFromPost(null), []);
  const cache = fakeCache();
  cache.store.set(cacheKeyFor('/v1/content/post', { slug: 'my-post' }), new Response(JSON.stringify({ ok: true, data: post })));
  cache.store.set(cacheKeyFor('/v1/content/posts', { limit: 12, category: 'guides' }), new Response('{}'));
  cache.store.set(cacheKeyFor('/v1/content/posts', { limit: 4, category: 'guides' }), new Response('{}'));
  cache.store.set(cacheKeyFor('/v1/content/posts', { limit: 12, tag: 'android' }), new Response('{}'));
  cache.store.set(cacheKeyFor('/v1/content/authors/jane'), new Response('{}'));
  const body = JSON.stringify({ type: 'content.routes-changed', data: { changed: [{ type: 'post', slug: 'my-post', lastModified: '2026-07-06T12:00:00.000Z' }] } });
  const res = await handleWebhook(new Request('https://phonedashcam.com/api/opinly-webhook', { method: 'POST', headers: sign(body), body }), { OPINLY_WEBHOOK_SIGNING_SECRET: SECRET }, null, { cache });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).invalidated.deletedHere, 5);
  assert.equal(cache.store.size, 0);
});

test('handler: 400 on bad signature, 200 + deletes on good one, 405 on GET, 500 unconfigured', async () => {
  const cache = fakeCache();
  cache.store.set(cacheKeyFor('/v1/content/post', { slug: 'my-post' }), new Response('{}'));
  cache.store.set(cacheKeyFor('/v1/content/routes'), new Response('[]'));
  const env = { OPINLY_WEBHOOK_SIGNING_SECRET: SECRET };
  const mk = (headers, method = 'POST') => new Request('https://phonedashcam.com/api/opinly-webhook', { method, headers, body: method === 'POST' ? payload : undefined });

  const bad = await handleWebhook(mk({ ...sign(payload), 'svix-signature': 'v1,AAAA' }), env, null, { cache });
  assert.equal(bad.status, 400);
  assert.equal(cache.store.size, 2);

  const good = await handleWebhook(mk(sign(payload)), env, null, { cache });
  assert.equal(good.status, 200);
  const body = await good.json();
  assert.equal(body.ok, true);
  assert.equal(body.changed, 6);
  assert.equal(body.invalidated.deletedHere, 2);
  assert.equal(cache.store.size, 0);

  assert.equal((await handleWebhook(mk({}, 'GET'), env, null, { cache })).status, 405);
  assert.equal((await handleWebhook(mk(sign(payload)), {}, null, { cache })).status, 500);

  const other = JSON.stringify({ type: 'something.else', data: {} });
  const ignored = await handleWebhook(new Request('https://phonedashcam.com/api/opinly-webhook', { method: 'POST', headers: sign(other), body: other }), env, null, { cache });
  assert.equal(ignored.status, 200);
  assert.equal((await ignored.json()).ignored, 'something.else');
});
