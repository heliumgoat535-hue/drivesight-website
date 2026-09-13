import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexPage, postPage, categoryPage, authorPage, notFoundPage, errorPage } from '../src/opinly/pages.js';
import { renderPostBody } from '../src/opinly/render.js';
import { fullPosts, posts, categorySummaries, authorsResponse } from './fixtures/opinly.mjs';

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}

test('index page: pixel in head, canonical, Blog + BreadcrumbList JSON-LD, pagination, empty state', () => {
  const html = indexPage({ posts, hasMore: true, nextCursor: 'abc', cursor: '', sort: 'newest', categories: categorySummaries });
  assert.match(html, /<script async src="https:\/\/static.opinly.ai\/p.js" data-key="pk-x3Ndgpy8F7LYjLNTRlDHjHEGplgr8y8F0KBFqtR"><\/script>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/phonedashcam.com\/blog">/);
  assert.match(html, /<link rel="next" href="https:\/\/phonedashcam.com\/blog\?cursor=abc">/);
  assert.match(html, /<a class="btn" href="\/blog\?cursor=abc" rel="next">Older posts/);
  assert.match(html, /<meta name="robots" content="index, follow/);
  const ld = jsonLdBlocks(html);
  assert.deepEqual(ld.map((b) => b['@type']), ['Blog', 'BreadcrumbList']);
  assert.equal(ld[0].blogPost.length, 3);
  assert.match(html, /<h1>/);
  assert.equal((html.match(/<li class="post-card">/g) || []).length, 3);
  assert.match(html, /cdn.opinly.ai\/BTxA7nMFSIcYDbIUpqapG\/posts\/parking-mode\/hero.jpg/);

  const cursorPage = indexPage({ posts, hasMore: false, nextCursor: null, cursor: 'abc', sort: 'oldest', categories: [] });
  assert.match(cursorPage, /<meta name="robots" content="noindex, follow">/);
  assert.match(cursorPage, /<link rel="canonical" href="https:\/\/phonedashcam.com\/blog\?cursor=abc&amp;sort=oldest">/);
  assert.doesNotMatch(cursorPage, /rel="prev"/);
  assert.match(cursorPage, /Back to newest/);
  // nav: aria-current="page" only on the real index; other blog pages just keep it visually active
  assert.match(html, /<a href="\/blog" class="active" aria-current="page">Blog<\/a>/);
  assert.match(cursorPage, /<a href="\/blog" class="active">Blog<\/a>/);
  assert.match(html, /<div class="nav-social" role="group" aria-label="Social links">/);

  const empty = indexPage({ posts: [], hasMore: false, nextCursor: null, cursor: '', sort: 'newest', categories: [] });
  assert.match(empty, /No posts yet/);
  assert.match(empty, /href="\/blog-archive"/);
});

test('post page: article meta, BlogPosting + BreadcrumbList + FAQPage, TOC, tags, related, escaped title', () => {
  const post = { ...fullPosts[0], title: 'Parking <mode> & "quotes"' };
  const rendered = renderPostBody(post.content, { siteUrl: 'https://phonedashcam.com' });
  const html = postPage({ post, rendered, related: posts.slice(1) });
  assert.match(html, /<title>Parking &lt;mode&gt; &amp; &quot;quotes&quot; \| DriveSight<\/title>/);
  assert.match(html, /<meta property="og:type" content="article">/);
  assert.match(html, /<meta property="article:published_time" content="2026-09-01T12:00:00.000Z">/);
  assert.match(html, /<meta property="article:author" content="https:\/\/phonedashcam.com\/blog\/authors\/jordan-reyes">/);
  assert.match(html, /<a href="\/blog" class="active">Blog<\/a>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/phonedashcam.com\/blog\/parking-mode-on-a-phone-dash-cam">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/cdn.opinly.ai\/BTxA7nMFSIcYDbIUpqapG\/posts\/parking-mode\/hero.jpg">/);
  const ld = jsonLdBlocks(html);
  assert.deepEqual(ld.map((b) => b['@type']), ['BlogPosting', 'BreadcrumbList', 'FAQPage']);
  assert.equal(ld[0].headline, 'Parking <mode> & "quotes"');
  assert.equal(ld[0].author.name, 'Jordan Reyes');
  assert.equal(ld[0].publisher['@id'], 'https://phonedashcam.com/#organization');
  assert.equal(ld[1].itemListElement.length, 4);
  assert.equal(ld[1].itemListElement[2].item, 'https://phonedashcam.com/blog/category/guides');
  assert.equal(ld[2].mainEntity.length, 2);
  assert.match(html, /<details class="toc" open>/);
  assert.match(html, /href="#power-comes-first"/);
  assert.match(html, /href="\/blog\/tag\/parking-mode"/);
  assert.match(html, /More in Guides/);
  assert.match(html, /data-opinly-post="parking-mode-on-a-phone-dash-cam"/);
  assert.match(html, /<span>Updated <\/span><time/);
  assert.doesNotMatch(html, /<script>alert/);
  // no hero image → default OG image; no author → Organization as author; short post → no TOC
  const noHero = fullPosts[1];
  const noHeroHtml = postPage({ post: noHero, rendered: renderPostBody(noHero.content), related: [] });
  assert.match(noHeroHtml, /<meta property="og:image" content="https:\/\/phonedashcam.com\/assets\/hero-dashcam.jpg">/);
  assert.doesNotMatch(noHeroHtml, /class="post-hero"/);
  assert.doesNotMatch(noHeroHtml, /class="toc"/);
  const noAuthor = fullPosts[2];
  const noAuthorHtml = postPage({ post: noAuthor, rendered: renderPostBody(noAuthor.content), related: [] });
  assert.equal(jsonLdBlocks(noAuthorHtml)[0].author['@type'], 'Organization');
  assert.doesNotMatch(noAuthorHtml, /class="author-card"/);
});

test('category, author, 404 and error pages', () => {
  const cat = categoryPage({ category: categorySummaries[0], posts: posts.slice(0, 2), hasMore: false, nextCursor: null, cursor: '' });
  assert.match(cat, /<link rel="canonical" href="https:\/\/phonedashcam.com\/blog\/category\/guides">/);
  assert.equal(jsonLdBlocks(cat)[0]['@type'], 'CollectionPage');
  const au = authorPage({ author: authorsResponse.data[0] });
  assert.match(au, /<h1>Jordan Reyes<\/h1>/);
  assert.equal(jsonLdBlocks(au)[0]['@type'], 'Person');
  assert.match(au, /cdn.opinly.ai\/BTxA7nMFSIcYDbIUpqapG\/authors\/jordan-reyes.jpg/);
  const nf = notFoundPage({ what: 'post' });
  assert.match(nf, /noindex/);
  assert.match(nf, /That post isn't here/);
  const err = errorPage({ status: 503, requestId: 'abc' });
  assert.match(err, /role="alert"/);
  assert.match(err, /Request ID: abc/);
});
