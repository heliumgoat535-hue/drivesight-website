// Opinly → Worker webhook (Svix-signed) for cache invalidation.
//
// Two caches exist here: the API responses in the Cache API (keys built by
// cacheKeyFor) and, when Cloudflare is caching rendered HTML, the page URLs
// themselves. Cache API deletes are per data centre, so when CF_ZONE_ID and
// CF_PURGE_TOKEN secrets are present we also purge every URL zone-wide.

import { PAGE_SIZE, RSS_LIMIT, RSS_PATH, SITEMAP_PATH, absUrl, routePath, isSafeSlug } from './config.js';
import { cacheKeyFor } from './client.js';

const TOLERANCE_SEC = 300;

function b64ToBytes(b64) {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function header(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : null;
}

// Svix signature scheme: HMAC-SHA256 over "<id>.<timestamp>.<body>" with the
// base64 secret (whsec_ prefix stripped); header carries "v1,<base64>" entries.
export async function verifySvixSignature({ secret, headers, rawBody, now = Date.now(), toleranceSec = TOLERANCE_SEC }) {
  if (!secret || typeof secret !== 'string') return false;
  const id = header(headers, 'svix-id');
  const ts = header(headers, 'svix-timestamp');
  const sigHeader = header(headers, 'svix-signature');
  if (!id || !ts || !sigHeader) return false;
  if (!/^\d+$/.test(ts)) return false;
  if (Math.abs(now / 1000 - Number(ts)) > toleranceSec) return false;

  let keyBytes;
  try { keyBytes = b64ToBytes(secret.replace(/^whsec_/, '')); } catch { return false; }
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const data = new TextEncoder().encode(`${id}.${ts}.${rawBody}`);

  for (const token of sigHeader.split(/\s+/)) {
    const [version, b64] = token.split(',', 2);
    if (version !== 'v1' || !b64) continue;
    let sig;
    try { sig = b64ToBytes(b64); } catch { continue; }
    if (sig.length !== 32) continue;
    // subtle.verify is constant-time.
    if (await crypto.subtle.verify('HMAC', key, sig, data)) return true;
  }
  return false;
}

// Pure mapping from changed entities → { cacheKeys, pageUrls }.
export function invalidationPlan(changed) {
  const cacheKeys = new Set();
  const pageUrls = new Set();
  const listKeys = (params) => {
    cacheKeys.add(cacheKeyFor('/v1/content/posts', { limit: PAGE_SIZE, ...params }));
    cacheKeys.add(cacheKeyFor('/v1/content/posts', { limit: PAGE_SIZE, sort: 'oldest', ...params }));
  };
  // Any change can move a post between list pages, so the shared surfaces go every time.
  listKeys({});
  ['/v1/content/routes', '/v1/content/categories', '/v1/content/tags', '/v1/content/authors'].forEach((p) => cacheKeys.add(cacheKeyFor(p)));
  cacheKeys.add(cacheKeyFor('/v1/content/rss', { limit: RSS_LIMIT }));
  [routePath('home'), routePath('category'), routePath('author'), RSS_PATH, SITEMAP_PATH].forEach((p) => pageUrls.add(absUrl(p)));

  for (const entry of changed || []) {
    const slug = typeof entry?.slug === 'string' ? entry.slug : '';
    if (slug && !isSafeSlug(slug)) continue;
    switch (entry?.type) {
      case 'post':
        if (!slug) break;
        cacheKeys.add(cacheKeyFor('/v1/content/post', { slug }));
        pageUrls.add(absUrl(routePath('post', slug)));
        break;
      case 'category':
        if (!slug) break;
        listKeys({ category: slug });
        cacheKeys.add(cacheKeyFor('/v1/content/posts', { limit: 4, category: slug }));
        pageUrls.add(absUrl(routePath('category', slug)));
        break;
      case 'author':
        if (!slug) break;
        cacheKeys.add(cacheKeyFor(`/v1/content/authors/${encodeURIComponent(slug)}`));
        listKeys({ author: slug });
        pageUrls.add(absUrl(routePath('author', slug)));
        break;
      case 'tag':
        if (!slug) break;
        listKeys({ tag: slug });
        pageUrls.add(absUrl(routePath('tag', slug)));
        break;
      case 'home':
      default:
        break;
    }
  }
  return { cacheKeys: [...cacheKeys], pageUrls: [...pageUrls] };
}

// A post-only change still stales the lists that contain the post: its
// category archive, its tag archives, its author page, and the "related"
// query. The webhook payload does not say which those are, but our cached
// copy of the post does — read it before it is deleted and expand the plan.
export function derivedChangesFromPost(post) {
  const out = [];
  if (!post || typeof post !== 'object') return out;
  if (post.category?.slug) out.push({ type: 'category', slug: post.category.slug });
  if (post.author?.slug) out.push({ type: 'author', slug: post.author.slug });
  for (const t of Array.isArray(post.tags) ? post.tags : []) {
    if (t?.slug) out.push({ type: 'tag', slug: t.slug });
  }
  return out;
}

export async function derivedChangesFromCache(changed, cache) {
  if (!cache) return [];
  const derived = [];
  for (const entry of changed || []) {
    if (entry?.type !== 'post' || !isSafeSlug(entry.slug)) continue;
    try {
      const hit = await cache.match(cacheKeyFor('/v1/content/post', { slug: entry.slug }));
      if (!hit) continue;
      const envelope = await hit.json();
      derived.push(...derivedChangesFromPost(envelope?.data));
    } catch { /* unreadable entry: it gets deleted anyway */ }
  }
  return derived;
}

async function purgeZone(env, urls) {
  if (!env?.CF_ZONE_ID || !env?.CF_PURGE_TOKEN || !urls.length) return { attempted: false };
  const chunks = [];
  for (let i = 0; i < urls.length; i += 30) chunks.push(urls.slice(i, i + 30));
  let ok = true;
  for (const files of chunks) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.CF_PURGE_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) { ok = false; console.warn('[opinly] zone purge failed', res.status, await res.text()); }
    } catch (e) {
      ok = false;
      console.warn('[opinly] zone purge error', e?.message || e);
    }
  }
  return { attempted: true, ok };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function handleWebhook(request, env, ctx, deps = {}) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
  }
  const secret = env?.OPINLY_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    console.error('[opinly] webhook received but OPINLY_WEBHOOK_SIGNING_SECRET is not set');
    return json({ error: 'webhook not configured' }, 500);
  }
  const rawBody = await request.text();
  const valid = await verifySvixSignature({ secret, headers: request.headers, rawBody, now: deps.now ? deps.now() : Date.now() });
  if (!valid) return json({ error: 'invalid signature' }, 400);

  let event;
  try { event = JSON.parse(rawBody); } catch { return json({ error: 'invalid json' }, 400); }
  if (event?.type !== 'content.routes-changed') return json({ ok: true, ignored: event?.type ?? null });

  const changed = Array.isArray(event.data?.changed) ? event.data.changed : [];
  const cache = deps.cache ?? (globalThis.caches ? globalThis.caches.default : null);
  const derived = await derivedChangesFromCache(changed, cache);
  const plan = invalidationPlan([...changed, ...derived]);

  let deleted = 0;
  if (cache) {
    const results = await Promise.allSettled(plan.cacheKeys.map((k) => cache.delete(k)));
    deleted = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  }
  const zone = await purgeZone(env, [...plan.pageUrls, ...plan.cacheKeys]);

  console.log('[opinly] webhook', { changed: changed.length, keys: plan.cacheKeys.length, deleted, zone });
  return json({ ok: true, changed: changed.length, invalidated: { cacheKeys: plan.cacheKeys.length, deletedHere: deleted, pages: plan.pageUrls.length, zonePurge: zone } });
}
