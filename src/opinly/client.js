// Opinly REST client for the Worker.
//
// Every GET is cached in the Cloudflare Cache API under a synthetic key so the
// webhook handler can delete exactly the entries an update touched. Entries are
// kept for STALE_MAX seconds but marked fresh only for their per-endpoint TTL:
// a stale hit triggers a refetch, and if the upstream is down the stale copy is
// served instead of an error page (stale-while-error).

import { API_URL_DEFAULT, BLOG_PREFIX, SITE_URL } from './config.js';

export const FRESH_TTL = {
  posts: 300,
  post: 3600,
  routes: 600,
  categories: 600,
  tags: 600,
  authors: 600,
  author: 600,
  rss: 600,
  notFound: 60,
};
const STALE_MAX = 86400;
const UPSTREAM_TIMEOUT_MS = 8000;

export class OpinlyError extends Error {
  constructor(message, { status, code, requestId, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'OpinlyError';
    this.status = status ?? 0;
    this.code = code ?? 'UNKNOWN';
    this.requestId = requestId ?? null;
  }
}

export class OpinlyConfigError extends OpinlyError {
  constructor(message) {
    super(message, { status: 0, code: 'NOT_CONFIGURED' });
    this.name = 'OpinlyConfigError';
  }
}

// Canonical cache key: same params in any order produce the same key.
export function cacheKeyFor(path, params = {}) {
  const url = new URL(`${SITE_URL}/__opinly-cache${path}`);
  Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .forEach((k) => url.searchParams.set(k, String(params[k])));
  return url.href;
}

function cleanParams(params) {
  const out = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
}

export function createClient(env, ctx, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  const now = deps.now || (() => Date.now());
  const getCache = deps.cache
    ? async () => deps.cache
    : async () => (globalThis.caches ? globalThis.caches.default : null);
  const log = deps.log || ((...a) => console.warn('[opinly]', ...a));

  const apiKey = env?.OPINLY_API_KEY;
  const baseUrl = (env?.OPINLY_API_URL || API_URL_DEFAULT).replace(/\/+$/, '');

  const waitUntil = (p) => {
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(p);
    return p;
  };

  async function readCached(cache, key) {
    if (!cache) return null;
    try {
      const hit = await cache.match(key);
      if (!hit) return null;
      const freshUntil = Number(hit.headers.get('x-opinly-fresh-until') || 0);
      const body = await hit.json();
      return { body, fresh: now() < freshUntil };
    } catch (e) {
      log('cache read failed', e?.message || e);
      return null;
    }
  }

  function storeCached(cache, key, body, ttl) {
    if (!cache) return;
    const resp = new Response(JSON.stringify(body), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': `public, max-age=${STALE_MAX}`,
        'x-opinly-fresh-until': String(now() + ttl * 1000),
      },
    });
    waitUntil(cache.put(key, resp).catch((e) => log('cache put failed', e?.message || e)));
  }

  async function upstream(path, params) {
    const url = new URL(`${baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const requestId = globalThis.crypto?.randomUUID ? crypto.randomUUID() : String(now());
    const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
      ? AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
      : undefined;
    let res;
    try {
      res = await fetchImpl(url.href, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${apiKey}`,
          accept: 'application/json',
          'x-request-id': requestId,
          // Lets Opinly know each post's live URL (rankings/traffic in its dashboard).
          'x-opinly-site-url': SITE_URL,
          'x-opinly-blog-prefix': BLOG_PREFIX,
        },
        signal,
      });
    } catch (e) {
      throw new OpinlyError(`Opinly request failed: ${e?.message || e}`, { status: 0, code: 'NETWORK', requestId, cause: e });
    }
    if (res.ok) {
      return { status: res.status, body: await res.json() };
    }
    let problem = null;
    try { problem = await res.json(); } catch { /* not a problem document */ }
    return {
      status: res.status,
      error: new OpinlyError(
        `Opinly ${res.status}${problem?.code ? ` ${problem.code}` : ''}${problem?.detail ? `: ${problem.detail}` : ''}`,
        { status: res.status, code: problem?.code, requestId: res.headers.get('x-request-id') || requestId },
      ),
    };
  }

  // kind: FRESH_TTL bucket; notFoundValue: what to return on a 404 (undefined = throw)
  async function get(kind, path, rawParams = {}, { notFoundValue } = {}) {
    if (!apiKey) throw new OpinlyConfigError('OPINLY_API_KEY is not set');
    const params = cleanParams(rawParams);
    const key = cacheKeyFor(path, params);
    const cache = await getCache();
    const cached = await readCached(cache, key);
    if (cached && cached.fresh) return unwrap(cached.body, notFoundValue);

    let result;
    try {
      result = await upstream(path, params);
    } catch (e) {
      if (cached) { log('serving stale after network error', path, e.message); return unwrap(cached.body, notFoundValue); }
      throw e;
    }
    if (result.body !== undefined) {
      storeCached(cache, key, { ok: true, data: result.body }, FRESH_TTL[kind] ?? 300);
      return result.body;
    }
    if (result.status === 404 && notFoundValue !== undefined) {
      storeCached(cache, key, { ok: false, notFound: true }, FRESH_TTL.notFound);
      return notFoundValue;
    }
    if (cached && result.status >= 500) {
      log('serving stale after upstream error', path, result.error.message);
      return unwrap(cached.body, notFoundValue);
    }
    throw result.error;
  }

  function unwrap(envelope, notFoundValue) {
    if (envelope && envelope.ok) return envelope.data;
    if (envelope && envelope.notFound && notFoundValue !== undefined) return notFoundValue;
    throw new OpinlyError('Cached response unusable', { status: 0, code: 'CACHE' });
  }

  return {
    posts: ({ limit, cursor, category, author, tag, sort } = {}) =>
      get('posts', '/v1/content/posts', { limit, cursor, category, author, tag, sort }),
    // null when there is no such post
    post: (slug) => get('post', '/v1/content/post', { slug }, { notFoundValue: null }),
    routes: () => get('routes', '/v1/content/routes'),
    categories: () => get('categories', '/v1/content/categories'),
    tags: () => get('tags', '/v1/content/tags'),
    authors: async () => {
      const res = await get('authors', '/v1/content/authors');
      return Array.isArray(res) ? res : (res?.data ?? []);
    },
    // null when the author does not exist (API answers { type: 'not-found' } or 404)
    author: async (slug) => {
      const res = await get('author', `/v1/content/authors/${encodeURIComponent(slug)}`, {}, { notFoundValue: null });
      if (!res) return null;
      if (res.type === 'author') return res.data;
      if (res.type === 'not-found') return null;
      return res.data ?? res;
    },
    rss: ({ limit } = {}) => get('rss', '/v1/content/rss', { limit }),
    isConfigured: () => Boolean(apiKey),
  };
}
