#!/usr/bin/env node
// Local stand-in for https://sdk.opinly.ai/v1 using test/fixtures/opinly.mjs.
// Point the Worker at it with OPINLY_API_URL=http://127.0.0.1:8790 in .dev.vars.
// Any bearer token is accepted; a missing one returns the real 401 shape.
import { createServer } from 'node:http';
import * as fx from '../test/fixtures/opinly.mjs';

const PORT = Number(process.env.PORT || 8790);
const PAGE_DEFAULT = 12;

function problem(res, status, code, title, detail) {
  res.writeHead(status, { 'content-type': 'application/problem+json' });
  res.end(JSON.stringify({ type: `https://opinly.ai/docs/reference/errors/${code.toLowerCase().replace(/_/g, '-')}`, title, status, code, detail, request_id: 'mock' }));
}
function json(res, body, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json', 'x-request-id': 'mock' });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const auth = req.headers.authorization || '';
  console.log(req.method, url.pathname + url.search, auth ? '' : '(no auth)');
  if (!/^Bearer\s+\S+/.test(auth)) return problem(res, 401, 'UNAUTHORIZED', 'Unauthorized');
  if (process.env.MOCK_FAIL === '1') return problem(res, 500, 'INTERNAL_ERROR', 'Simulated outage');

  const p = url.pathname;
  if (p === '/v1/content/posts') {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || PAGE_DEFAULT)));
    const sort = url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';
    const category = url.searchParams.get('category');
    const author = url.searchParams.get('author');
    const tag = url.searchParams.get('tag');
    let list = fx.posts.filter((x) => (!category || x.category?.slug === category)
      && (!author || x.author?.slug === author)
      && (!tag || x.tags.some((t) => t.slug === tag)));
    list.sort((a, b) => (sort === 'oldest' ? 1 : -1) * (new Date(a.firstPublishedAt) - new Date(b.firstPublishedAt)));
    const cursor = url.searchParams.get('cursor');
    let offset = 0;
    if (cursor) {
      const n = Number(Buffer.from(cursor, 'base64').toString('utf8'));
      if (!Number.isFinite(n)) return problem(res, 400, 'INVALID_CURSOR', 'Invalid request', 'cursor is not valid');
      offset = n;
    }
    const page = list.slice(offset, offset + limit);
    const has_more = offset + limit < list.length;
    return json(res, { data: page, has_more, next_cursor: has_more ? Buffer.from(String(offset + limit)).toString('base64') : null });
  }
  if (p === '/v1/content/post') {
    const slug = url.searchParams.get('slug');
    if (!slug) return problem(res, 400, 'VALIDATION_ERROR', 'Invalid request', 'slug is required');
    const post = fx.fullPosts.find((x) => x.slug === slug);
    return post ? json(res, post) : problem(res, 404, 'NOT_FOUND', 'Not found', `No post with slug ${slug}`);
  }
  if (p === '/v1/content/routes') return json(res, fx.routes);
  if (p === '/v1/content/categories') return json(res, fx.categorySummaries);
  if (p === '/v1/content/tags') return json(res, fx.tagSummaries);
  if (p === '/v1/content/authors') return json(res, fx.authorsResponse);
  if (p.startsWith('/v1/content/authors/')) {
    const slug = decodeURIComponent(p.slice('/v1/content/authors/'.length));
    const a = fx.authorsResponse.data.find((x) => x.slug === slug);
    return json(res, a ? { type: 'author', data: a } : { type: 'not-found', data: null });
  }
  if (p === '/v1/content/rss') {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 20)));
    return json(res, fx.rssItems.slice(0, limit));
  }
  if (p === '/v1/events' || p === '/v1/events/purchase') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => { console.log('  event body:', body); json(res, { recorded: true }, 201); });
    return undefined;
  }
  return problem(res, 404, 'NOT_FOUND', 'Not found');
}).listen(PORT, '127.0.0.1', () => console.log(`mock Opinly API on http://127.0.0.1:${PORT}/v1`));
