// Routes every Opinly-backed URL. Returns null for anything that is not ours
// so redirect-worker.js can fall through to static assets.

import {
  SITE_URL, BLOG_PREFIX, CATEGORY_PREFIX, AUTHOR_PREFIX, TAG_PREFIX, RSS_PATH, SITEMAP_PATH, WEBHOOK_PATH,
  PURCHASE_INGEST_PATH, ARCHIVE_PATH, PAGE_SIZE, isSafeSlug,
} from './config.js';
import { createClient, OpinlyError, OpinlyConfigError } from './client.js';
import { renderPostBody } from './render.js';
import {
  indexPage, postPage, categoryPage, categoriesPage, authorsPage, authorPage, tagPage,
  notFoundPage, errorPage, notConfiguredPage,
} from './pages.js';
import { sitemapResponse, rssResponse } from './feeds.js';
import { handleWebhook } from './webhook.js';
import { handlePurchaseIngest } from './events.js';

const PAGE_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

function html(markup, { status = 200, cacheControl = PAGE_CACHE, method = 'GET' } = {}) {
  return new Response(method === 'HEAD' ? null : markup, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': status >= 500 ? 'no-store' : cacheControl,
      ...(status >= 500 ? { 'retry-after': '60' } : {}),
      vary: 'Accept-Encoding',
    },
  });
}

function redirect(location, status = 301) {
  return new Response(null, { status, headers: { location, 'cache-control': 'public, max-age=3600' } });
}

function cursorParam(url) {
  const c = url.searchParams.get('cursor') || '';
  return c.length <= 512 ? c : '';
}

async function renderIndex(client, url) {
  const sort = url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const cursor = cursorParam(url);
  // Omit sort=newest (the API default) so the cache key matches the one the
  // webhook handler invalidates (see invalidationPlan).
  const [list, categories] = await Promise.all([
    client.posts({ limit: PAGE_SIZE, cursor: cursor || undefined, sort: sort === 'oldest' ? 'oldest' : undefined }),
    client.categories().catch((e) => { console.warn('[opinly] categories failed on index', e?.message); return []; }),
  ]);
  return indexPage({
    posts: list.data || [], hasMore: Boolean(list.has_more), nextCursor: list.next_cursor,
    cursor, sort, categories, activeCategory: null,
  });
}

async function renderPost(client, slug) {
  const post = await client.post(slug);
  if (!post) return { status: 404, markup: notFoundPage({ what: 'post' }) };
  const rendered = renderPostBody(post.content, { siteUrl: SITE_URL, images: post.images });
  let related = [];
  if (post.category?.slug) {
    try {
      const list = await client.posts({ limit: 4, category: post.category.slug });
      related = (list.data || []).filter((p) => p.slug !== post.slug).slice(0, 3);
    } catch (e) {
      console.warn('[opinly] related posts failed', e?.message);
    }
  }
  return { status: 200, markup: postPage({ post, rendered, related }) };
}

async function renderCategory(client, slug, url) {
  const cursor = cursorParam(url);
  const [categories, list] = await Promise.all([
    client.categories(),
    client.posts({ limit: PAGE_SIZE, category: slug, cursor: cursor || undefined }),
  ]);
  const category = (categories || []).find((c) => c.slug === slug);
  if (!category) return { status: 404, markup: notFoundPage({ what: 'category' }) };
  return {
    status: 200,
    markup: categoryPage({ category, posts: list.data || [], hasMore: Boolean(list.has_more), nextCursor: list.next_cursor, cursor }),
  };
}

async function renderTag(client, slug, url) {
  const cursor = cursorParam(url);
  const [tags, list] = await Promise.all([
    client.tags().catch(() => []),
    client.posts({ limit: PAGE_SIZE, tag: slug, cursor: cursor || undefined }),
  ]);
  const tag = (tags || []).find((t) => t.slug === slug);
  if (!tag && !(list.data || []).length) return { status: 404, markup: notFoundPage({ what: 'tag' }) };
  return {
    status: 200,
    markup: tagPage({ tag: tag || { slug, name: slug }, posts: list.data || [], hasMore: Boolean(list.has_more), nextCursor: list.next_cursor, cursor }),
  };
}

async function renderAuthor(client, slug) {
  const author = await client.author(slug);
  if (!author) return { status: 404, markup: notFoundPage({ what: 'author' }) };
  return { status: 200, markup: authorPage({ author }) };
}

export async function handleOpinlyRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // --- API-ish endpoints (method-specific) ---
  if (path === WEBHOOK_PATH) return handleWebhook(request, env, ctx);
  if (path === PURCHASE_INGEST_PATH) return handlePurchaseIngest(request, env);

  const isBlog = path === BLOG_PREFIX || path.startsWith(`${BLOG_PREFIX}/`);
  const isOurs = isBlog || path === SITEMAP_PATH || path === ARCHIVE_PATH || path === '/blog.html';
  if (!isOurs) return null;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  }
  const method = request.method;

  // Legacy static index lives on under /blog-archive. Ask the asset binding
  // for the extensionless path: with the default auto-trailing-slash handling
  // "/blog.html" comes back as a 307 to "/blog", while "/blog" serves the file.
  if (path === '/blog.html') return redirect(ARCHIVE_PATH);
  if (path === ARCHIVE_PATH) {
    const headers = new Headers(request.headers);
    let asset = await env.ASSETS.fetch(new Request(`${url.origin}${BLOG_PREFIX}`, { method, headers }));
    if (asset.status >= 300) asset = await env.ASSETS.fetch(new Request(`${url.origin}/blog.html`, { method, headers, redirect: 'manual' }));
    if (asset.status >= 300) return html(notFoundPage(), { status: 404, method });
    return new Response(asset.body, { status: asset.status, headers: asset.headers });
  }

  // Canonical: no trailing slash under /blog.
  if (path.length > BLOG_PREFIX.length && path.endsWith('/')) {
    return redirect(path.replace(/\/+$/, '') + url.search);
  }

  const client = createClient(env, ctx);
  try {
    if (path === SITEMAP_PATH) {
      const res = await sitemapResponse({ env, client, origin: url.origin });
      return method === 'HEAD' ? new Response(null, res) : res;
    }
    if (!client.isConfigured()) throw new OpinlyConfigError('OPINLY_API_KEY is not set');
    if (path === RSS_PATH) {
      const res = await rssResponse({ client });
      return method === 'HEAD' ? new Response(null, res) : res;
    }

    const segments = path.slice(BLOG_PREFIX.length).split('/').filter(Boolean).map((s) => {
      try { return decodeURIComponent(s); } catch { return s; }
    });

    let result;
    if (segments.length === 0) {
      result = { status: 200, markup: await renderIndex(client, url) };
    } else if (segments[0] === CATEGORY_PREFIX) {
      if (segments.length === 1) result = { status: 200, markup: categoriesPage({ categories: await client.categories() }) };
      else if (segments.length === 2 && isSafeSlug(segments[1])) result = await renderCategory(client, segments[1], url);
    } else if (segments[0] === AUTHOR_PREFIX) {
      if (segments.length === 1) result = { status: 200, markup: authorsPage({ authors: await client.authors() }) };
      else if (segments.length === 2 && isSafeSlug(segments[1])) result = await renderAuthor(client, segments[1]);
    } else if (segments[0] === TAG_PREFIX) {
      if (segments.length === 2 && isSafeSlug(segments[1])) result = await renderTag(client, segments[1], url);
    } else if (segments.length === 1 && isSafeSlug(segments[0])) {
      result = await renderPost(client, segments[0]);
    }
    if (!result) result = { status: 404, markup: notFoundPage() };
    return html(result.markup, { status: result.status, method, cacheControl: result.status === 404 ? 'public, max-age=0, s-maxage=60' : PAGE_CACHE });
  } catch (e) {
    if (e instanceof OpinlyConfigError) {
      console.error('[opinly]', e.message);
      return html(notConfiguredPage(), { status: 503, method });
    }
    // A 400 from Opinly means OUR request was bad (an invalid or expired
    // ?cursor=, mostly) — that is a client error, not an outage.
    if (e instanceof OpinlyError && e.status === 400) {
      console.warn('[opinly] rejected request', path, e.message);
      return html(notFoundPage(), { status: 404, method, cacheControl: 'public, max-age=0, s-maxage=60' });
    }
    console.error('[opinly] render failed', path, e?.message || e, e?.requestId ? `request_id=${e.requestId}` : '');
    return html(errorPage({ status: 503, requestId: e?.requestId || null }), { status: 503, method });
  }
}
