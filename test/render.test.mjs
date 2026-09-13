import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPostBody, renderToHtml, safeHref, escapeHtml, excerpt } from '../src/opinly/render.js';
import { fullPosts } from './fixtures/opinly.mjs';

const SITE = 'https://phonedashcam.com';

test('escapes text and never emits raw markup from content', () => {
  const html = renderToHtml({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert("x")</script> & "quotes"' }] }] });
  assert.equal(html, '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;quotes&quot;</p>');
});

test('drops javascript: and data: links but keeps http, mailto, relative', () => {
  assert.equal(safeHref('javascript:alert(1)'), null);
  assert.equal(safeHref('data:text/html,hi'), null);
  assert.equal(safeHref('//evil.example'), null);
  assert.equal(safeHref('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(safeHref('mailto:a@b.co'), 'mailto:a@b.co');
  assert.equal(safeHref('/accessories'), '/accessories');
  assert.equal(safeHref('guide/setup'), '/guide/setup');
  assert.equal(safeHref('#top'), '#top');
});

test('control characters and backslash tricks cannot smuggle a scheme past the check', () => {
  for (const bad of ['java\tscript:alert(1)', 'java\nscript:alert(1)', 'java\rscript:alert(1)', '\u0001javascript:alert(1)', '\u001fjavascript:alert(1)', 'JAVASCRIPT:alert(1)', ' javascript:alert(1)', 'vbscript:x', 'file:///etc/passwd']) {
    assert.equal(safeHref(bad), null, JSON.stringify(bad));
  }
  // "/\evil.example" resolves off-origin in browsers; an internal-looking link must stay internal.
  assert.equal(safeHref('/\\evil.example/phish'), null);
  assert.equal(safeHref('/\\\\evil.example/phish'), null);
  const html = renderToHtml({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'java\tscript:alert(1)' } }] }] }] });
  assert.equal(html, '<p>x</p>');
});

test('external links open in a new tab with rel=noopener; internal do not', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'ext', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
    { type: 'text', text: 'int', marks: [{ type: 'link', attrs: { href: '/accessories' } }] },
    { type: 'text', text: 'bad', marks: [{ type: 'link', attrs: { href: 'javascript:1' } }] },
  ] }] };
  const html = renderToHtml(doc, { siteUrl: SITE });
  assert.match(html, /<a href="https:\/\/example.com\/" target="_blank" rel="noopener">ext<\/a>/);
  assert.match(html, /<a href="\/accessories">int<\/a>/);
  assert.match(html, />bad</);
  assert.doesNotMatch(html, /javascript:/);
});

test('marks nest in Tiptap order and textStyle colours are validated', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'x', marks: [{ type: 'bold' }, { type: 'italic' }] },
    { type: 'text', text: 'c', marks: [{ type: 'textStyle', attrs: { color: '#ff0000' } }] },
    { type: 'text', text: 'd', marks: [{ type: 'textStyle', attrs: { color: 'red;background:url(x)' } }] },
  ] }] };
  const html = renderToHtml(doc);
  assert.match(html, /<strong><em>x<\/em><\/strong>/);
  assert.match(html, /<span style="color:#ff0000">c<\/span>/);
  assert.match(html, />d</);
  assert.doesNotMatch(html, /url\(/);
});

test('headings get ids, are demoted below h1, and are collected for a TOC', () => {
  const doc = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Power comes first' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Power comes first' }] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Ünïcode & symbols!' }] },
  ] };
  const { html, headings } = renderPostBody(doc);
  assert.match(html, /<h2 id="power-comes-first">/);
  assert.match(html, /<h2 id="power-comes-first-2">/);
  assert.match(html, /<h3 id="unicode-symbols">/);
  assert.deepEqual(headings.map((h) => h.level), [2, 2, 3]);
});

test('images resolve fileKey under the CDN namespace verbatim and lazy-load', () => {
  const html = renderToHtml({ type: 'doc', content: [{ type: 'image', attrs: { fileKey: 'posts/a/b.jpg', alt: 'A "thing"', caption: 'Cap', width: 800, height: 600 } }] });
  assert.match(html, /<img src="https:\/\/cdn.opinly.ai\/BTxA7nMFSIcYDbIUpqapG\/posts\/a\/b.jpg" alt="A &quot;thing&quot;" width="800" height="600" loading="lazy" decoding="async">/);
  assert.match(html, /<figcaption>Cap<\/figcaption>/);
});

test('lists, tables, code blocks, and unknown nodes render safely', () => {
  const { html, words } = renderPostBody(fullPosts[0].content, { siteUrl: SITE });
  assert.match(html, /<ul><li><p>Mount high/);
  assert.match(html, /<ol><li>/);
  assert.match(html, /<div class="table-wrap"[^>]*><table><tr><th scope="col"><p>Setting<\/p><\/th>/);
  // header cells below the first row are row headers
  const rowHeaders = renderToHtml({ type: 'doc', content: [{ type: 'table', content: [
    { type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Feature' }] }] }] },
    { type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Parking' }] }] }, { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Yes' }] }] }] },
  ] }] });
  assert.match(rowHeaders, /<th scope="col"><p>Feature/);
  assert.match(rowHeaders, /<th scope="row"><p>Parking/);
  // image alt/caption fall back to FullPost.images[] by fileKey
  const withMeta = renderPostBody({ type: 'doc', content: [{ type: 'image', attrs: { fileKey: 'a/b.jpg' } }] }, { images: [{ fileKey: 'a/b.jpg', altText: 'From images[]', title: null, caption: 'Cap from images[]' }] }).html;
  assert.match(withMeta, /alt="From images\[\]"/);
  assert.match(withMeta, /<figcaption>Cap from images\[\]<\/figcaption>/);
  assert.match(html, /<pre><code class="language-text">Settings → Parking Guard/);
  assert.match(html, /<hr>/);
  assert.match(html, /<blockquote><p>/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.ok(words > 100);
  // unknown node with children still renders the children
  const unknown = renderToHtml({ type: 'doc', content: [{ type: 'callout', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'inner' }] }] }, { type: 'widget' }] });
  assert.equal(unknown, '<p>inner</p>');
});

test('excerpt cuts on a word boundary', () => {
  const e = excerpt(fullPosts[0].content, 60);
  assert.ok(e.length <= 62 && e.endsWith('…'));
  assert.equal(escapeHtml(null), '');
});
