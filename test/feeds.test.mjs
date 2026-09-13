import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sitemapEntries, mergeSitemap, buildRss } from '../src/opinly/feeds.js';
import { routePath, imageUrl, isSafeSlug } from '../src/opinly/config.js';
import { routes, rssItems } from './fixtures/opinly.mjs';

test('routePath is the single mapping for every entity type', () => {
  assert.equal(routePath('home'), '/blog');
  assert.equal(routePath('post', 'a-b'), '/blog/a-b');
  assert.equal(routePath('category', 'guides'), '/blog/category/guides');
  assert.equal(routePath('category'), '/blog/category');
  assert.equal(routePath('author', 'jane'), '/blog/authors/jane');
  assert.equal(routePath('tag', 'seo'), '/blog/tag/seo');
  assert.equal(routePath('nope', 'x'), null);
  assert.equal(imageUrl('posts/x.jpg'), 'https://cdn.opinly.ai/BTxA7nMFSIcYDbIUpqapG/posts/x.jpg');
  assert.equal(imageUrl('/posts/x.jpg'), 'https://cdn.opinly.ai/BTxA7nMFSIcYDbIUpqapG/posts/x.jpg');
  assert.equal(imageUrl('https://cdn.opinly.ai/other/x.jpg'), 'https://cdn.opinly.ai/other/x.jpg');
  assert.equal(imageUrl(null), null);
  assert.equal(isSafeSlug('my-post_1.2'), true);
  assert.equal(isSafeSlug('../x'), false);
  assert.equal(isSafeSlug(''), false);
});

test('sitemap entries dedupe by loc and keep the newest lastmod', () => {
  const entries = sitemapEntries([...routes, { type: 'post', slug: routes[1].slug, lastModified: '2027-01-01T00:00:00.000Z' }, { type: 'bogus', slug: 'x', lastModified: '2026-01-01' }]);
  const post = entries.find((e) => e.loc === `https://phonedashcam.com/blog/${routes[1].slug}`);
  assert.equal(post.lastmod, '2027-01-01T00:00:00.000Z');
  assert.ok(entries.some((e) => e.loc === 'https://phonedashcam.com/blog'));
  assert.ok(entries.some((e) => e.loc === 'https://phonedashcam.com/blog/tag/deer'));
  assert.ok(!entries.some((e) => e.loc.includes('/x')));
  // the category and author directories are ours, not in the API's route list
  const hub = entries.find((e) => e.loc === 'https://phonedashcam.com/blog/category');
  assert.equal(hub.lastmod, '2026-09-10T09:30:00.000Z');
  assert.ok(entries.some((e) => e.loc === 'https://phonedashcam.com/blog/authors'));
});

test('merging replaces static entries Opinly now owns and appends the rest', () => {
  const staticXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://phonedashcam.com/</loc>
    <lastmod>2026-05-09</lastmod>
  </url>
  <url>
    <loc>https://phonedashcam.com/blog</loc>
    <lastmod>2026-05-09</lastmod>
  </url>
</urlset>
`;
  const merged = mergeSitemap(staticXml, sitemapEntries(routes));
  assert.equal((merged.match(/<loc>https:\/\/phonedashcam.com\/blog<\/loc>/g) || []).length, 1);
  assert.match(merged, /<loc>https:\/\/phonedashcam.com\/<\/loc>/);
  assert.match(merged, /<loc>https:\/\/phonedashcam.com\/blog\/parking-mode-on-a-phone-dash-cam<\/loc>\s*<lastmod>2026-09-10T09:30:00.000Z<\/lastmod>/);
  assert.match(merged, /xmlns:xhtml/);
  assert.ok(merged.trim().endsWith('</urlset>'));
  // garbage in → still a valid urlset
  assert.match(mergeSitemap('not xml', []), /<urlset[\s\S]*<\/urlset>/);
});

test('RSS is valid 2.0 with escaped fields and permalink guids', () => {
  const xml = buildRss([...rssItems, { slug: 'x', title: 'Tom & Jerry <3', date: 'not-a-date' }]);
  assert.match(xml, /<rss version="2.0" xmlns:atom="http:\/\/www.w3.org\/2005\/Atom">/);
  assert.match(xml, /<atom:link href="https:\/\/phonedashcam.com\/blog\/rss.xml" rel="self"/);
  assert.match(xml, /<guid isPermaLink="true">https:\/\/phonedashcam.com\/blog\/parking-mode-on-a-phone-dash-cam<\/guid>/);
  assert.match(xml, /<pubDate>Tue, 01 Sep 2026 12:00:00 GMT<\/pubDate>/);
  assert.match(xml, /<title>Tom &amp; Jerry &lt;3<\/title>/);
  assert.match(xml, /<category>Guides<\/category>/);
  assert.doesNotMatch(xml, /<pubDate>Invalid/);
  assert.match(xml, /<lastBuildDate>Tue, 01 Sep 2026 12:00:00 GMT<\/lastBuildDate>/);
  // RSS 2.0 channel images must be GIF/JPEG/PNG ≤144px; we have none that fit, so none is declared
  assert.doesNotMatch(xml, /<image>/);
});
