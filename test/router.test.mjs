import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import worker from '../redirect-worker.js';

// Boot the mock Opinly API in-process on a random port.
process.env.PORT = '0';
let mockUrl;
let stopMock = () => {};
test.before(async () => {
  const { default: startMock } = await import('./helpers/start-mock.mjs');
  const mock = await startMock();
  mockUrl = mock.url;
  stopMock = mock.stop;
});
test.after(() => stopMock());

const assets = {
  fetch: async (req) => {
    const u = new URL(req.url);
    if (u.pathname === '/sitemap.xml') return new Response('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://phonedashcam.com/blog</loc>\n  </url>\n</urlset>\n', { headers: { 'content-type': 'application/xml' } });
    // Mirror the real asset binding: "/blog.html" 307s to "/blog" (auto-trailing-slash), "/blog" serves blog.html.
    if (u.pathname === '/blog.html') return new Response(null, { status: 307, headers: { location: '/blog' } });
    if (u.pathname === '/blog') return new Response('<!DOCTYPE html><html><body>legacy archive</body></html>', { headers: { 'content-type': 'text/html' } });
    return new Response('asset:' + u.pathname, { status: u.pathname === '/missing' ? 404 : 200, headers: { 'content-type': 'text/html' } });
  },
};

function env(extra = {}) {
  return { ASSETS: assets, OPINLY_API_KEY: 'sk-test', OPINLY_API_URL: mockUrl, ...extra };
}
const ctx = { waitUntil: () => {} };
const get = (path, e = env(), init = {}) => worker.fetch(new Request(`https://phonedashcam.com${path}`, init), e, ctx);

test('blog index, post, category, author, tag render with 200 and security headers', async () => {
  for (const path of ['/blog', '/blog?sort=oldest', '/blog/parking-mode-on-a-phone-dash-cam', '/blog/category', '/blog/category/guides', '/blog/authors', '/blog/authors/jordan-reyes', '/blog/tag/deer']) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(res.headers.get('content-security-policy'), /static\.opinly\.ai/);
    const html = await res.text();
    assert.match(html, /static.opinly.ai\/p.js/, path);
    assert.match(html, /<main id="main"/, path);
  }
});

test('404s for unknown post/category/author/tag and deep paths; unsafe slugs never hit the API', async () => {
  for (const path of ['/blog/nope', '/blog/category/nope', '/blog/authors/nope', '/blog/tag/nope', '/blog/a/b/c', '/blog/..%2Fetc']) {
    const res = await get(path);
    assert.equal(res.status, 404, path);
    assert.match(await res.text(), /isn't here/);
  }
});

test('trailing slashes redirect, legacy index moves to /blog-archive, static falls through', async () => {
  const slash = await get('/blog/parking-mode-on-a-phone-dash-cam/?x=1');
  assert.equal(slash.status, 301);
  assert.equal(slash.headers.get('location'), '/blog/parking-mode-on-a-phone-dash-cam?x=1');
  const legacy = await get('/blog.html');
  assert.equal(legacy.status, 301);
  assert.equal(legacy.headers.get('location'), '/blog-archive');
  const archive = await get('/blog-archive');
  assert.equal(archive.status, 200);
  assert.match(await archive.text(), /legacy archive/);
  const other = await get('/about');
  assert.equal(await other.text(), 'asset:/about');
  assert.equal((await get('/src/opinly/config.js')).status, 404);
  assert.equal((await get('/.dev.vars')).status, 404);
  for (const sneaky of ['/%73rc/opinly/config.js', '/src%2Fopinly%2Fconfig.js', '/wrangler%2Etoml', '/%2Edev.vars', '/.dev.vars.local', '/.env.production', '/OPINLY-BLOG%2Emd']) {
    assert.equal((await get(sneaky)).status, 404, sneaky);
  }
  assert.equal(await (await get('/accessories')).text(), 'asset:/accessories');
});

test('an invalid ?cursor= is a 404, not an outage page', async () => {
  const res = await get('/blog?cursor=not-a-real-cursor');
  assert.equal(res.status, 404);
  assert.match(await res.text(), /isn't here/);
});

test('sitemap merges Opinly routes into the static file; RSS is served', async () => {
  const sm = await get('/sitemap.xml');
  assert.equal(sm.status, 200);
  const xml = await sm.text();
  assert.equal((xml.match(/<loc>https:\/\/phonedashcam.com\/blog<\/loc>/g) || []).length, 1);
  assert.match(xml, /<loc>https:\/\/phonedashcam.com\/blog\/deer-season-driving-what-a-dash-cam-sees-first<\/loc>/);
  const rss = await get('/blog/rss.xml');
  assert.equal(rss.status, 200);
  assert.match(rss.headers.get('content-type'), /application\/rss\+xml/);
  assert.match(await rss.text(), /<item>/);
  const head = await get('/blog', env(), { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await get('/blog', env(), { method: 'POST' })).status, 405);
});

test('missing API key → 503 setup page; sitemap still serves the static file', async () => {
  const res = await get('/blog', env({ OPINLY_API_KEY: '' }));
  assert.equal(res.status, 503);
  assert.match(await res.text(), /Blog not configured/);
  const sm = await get('/sitemap.xml', env({ OPINLY_API_KEY: '' }));
  assert.equal(sm.status, 200);
  assert.equal(sm.headers.get('x-opinly-sitemap'), 'degraded');
});

test('upstream outage → 503 error page with no-store, not a crash', async () => {
  const res = await get('/blog/category/safety', env({ OPINLY_API_URL: 'http://127.0.0.1:1' }));
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(await res.text(), /taking a short break/);
});

test('purchase ingest: disabled without token, 401 wrong token, 201 with valid body', async () => {
  const body = JSON.stringify({ orderId: 'GPA.1234', value: 29.99, currency: 'usd', email: 'buyer@example.com' });
  const mk = (e, token) => get('/api/opinly/purchase', e, { method: 'POST', body, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  assert.equal((await mk(env(), 'x')).status, 404);
  assert.equal((await mk(env({ OPINLY_PURCHASE_INGEST_TOKEN: 'secret' }), 'wrong')).status, 401);
  const ok = await mk(env({ OPINLY_PURCHASE_INGEST_TOKEN: 'secret' }), 'secret');
  assert.equal(ok.status, 201);
  assert.equal((await ok.json()).ok, true);
  const bad = await get('/api/opinly/purchase', env({ OPINLY_PURCHASE_INGEST_TOKEN: 'secret' }), { method: 'POST', body: '{"orderId":"","value":-1}', headers: { authorization: 'Bearer secret' } });
  assert.equal(bad.status, 400);
  for (const body of ['null', '[]', '"str"', '42']) {
    const res = await get('/api/opinly/purchase', env({ OPINLY_PURCHASE_INGEST_TOKEN: 'secret' }), { method: 'POST', body, headers: { authorization: 'Bearer secret' } });
    assert.equal(res.status, 400, body);
  }
});
