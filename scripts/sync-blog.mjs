#!/usr/bin/env node
// Pulls new articles from BabyLoveGrowth and publishes them as static HTML.
// Run: BABYLOVE_API_KEY=... node scripts/sync-blog.mjs
// Or:  npm run sync   (loads .env automatically)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MANIFEST = join(__dirname, 'synced-posts.json');
const SITE = 'https://phonedashcam.com';
const API_BASE = 'https://api.babylovegrowth.ai/api/integrations';

const API_KEY = process.env.BABYLOVE_API_KEY;
if (!API_KEY) {
  console.error('Missing BABYLOVE_API_KEY (set in .env or environment).');
  process.exit(1);
}

const headers = { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' };

async function api(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function loadManifest() {
  if (!existsSync(MANIFEST)) return { posts: {} };
  return JSON.parse(await readFile(MANIFEST, 'utf8'));
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function isoDate(d) { return new Date(d || Date.now()).toISOString().slice(0, 10); }

function renderPost(article) {
  const slug = (article.slug && slugify(article.slug)) || `post-${article.id}`;
  const title = article.title || 'Untitled';
  const desc = article.meta_description || article.excerpt || title;
  const hero = article.hero_image_url || `${SITE}/assets/hero-dashcam.jpg`;
  const date = isoDate(article.created_at);
  const keywords = (article.keywords || []).slice(0, 12).join(', ');
  const html = article.content_html || `<p>${escapeHtml(article.content_markdown || '')}</p>`;
  const articleJsonLd = article.jsonLd || {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: desc,
    author: { '@type': 'Organization', name: 'Phone Dashcam', url: SITE },
    publisher: { '@type': 'Organization', name: 'Phone Dashcam', url: SITE },
    datePublished: date,
    dateModified: date,
    image: hero,
    mainEntityOfPage: `${SITE}/${slug}`,
    keywords: article.keywords || [],
    inLanguage: 'en-US'
  };
  const faqJsonLd = article.faqJsonLd ? `\n<script type="application/ld+json">${JSON.stringify(article.faqJsonLd)}</script>` : '';

  return { slug, date, title, desc, html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta name="google-site-verification" content="zhf91iEx_qMCudqjN4_EFK2I0hMN74I7r65bsB6PDXo" />
<script async src="https://www.googletagmanager.com/gtag/js?id=G-7R95MFY0PM"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-7R95MFY0PM');</script>
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WNK22QM3');</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta name="keywords" content="${escapeHtml(keywords)}">
<meta name="author" content="Phone Dashcam Team">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${SITE}/${slug}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${escapeHtml(hero)}">
<meta property="og:site_name" content="Phone Dashcam">
<meta property="og:url" content="${SITE}/${slug}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<link rel="icon" type="image/png" href="/assets/icon-512.png">
<link rel="apple-touch-icon" href="/assets/icon-512.png">
<script type="application/ld+json">${JSON.stringify(articleJsonLd)}</script>${faqJsonLd}
<style>
:root{--bg:#0a0a0a;--card-bg:#111;--card-border:#222;--text:#d1d5db;--text-bright:#fafafa;--text-dim:#9ca3af;--green:#4ade80}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.7}
nav{padding:20px 32px;border-bottom:1px solid var(--card-border);display:flex;gap:24px;align-items:center;flex-wrap:wrap}
nav a{color:var(--text-dim);text-decoration:none;font-weight:600;font-size:.95rem}nav a:hover{color:var(--green)}
nav .brand{color:var(--text-bright);font-size:1.1rem;margin-right:auto}
article{max-width:760px;margin:0 auto;padding:48px 24px}
article h1{color:var(--text-bright);font-size:2.2rem;line-height:1.25;margin:0 0 12px}
article .meta{color:var(--text-dim);font-size:.9rem;margin-bottom:32px}
article h2{color:var(--text-bright);font-size:1.5rem;margin-top:40px}
article h3{color:var(--text-bright);font-size:1.2rem;margin-top:28px}
article p,article li{color:var(--text);font-size:1.02rem}
article a{color:var(--green)}
article img{max-width:100%;height:auto;border-radius:10px;margin:20px 0}
article code{background:#1a1a1a;padding:2px 6px;border-radius:4px;font-size:.9em}
article pre{background:#111;border:1px solid var(--card-border);padding:16px;border-radius:8px;overflow-x:auto}
article blockquote{border-left:3px solid var(--green);padding-left:16px;color:var(--text-dim);margin:20px 0}
.cta-box{background:var(--card-bg);border:1px solid var(--card-border);border-radius:12px;padding:24px;margin:40px 0}
.cta-box h3{margin-top:0}.btn-primary{display:inline-flex;align-items:center;gap:8px;background:var(--green);color:#000;padding:12px 20px;border-radius:8px;font-weight:700;text-decoration:none}
footer{border-top:1px solid var(--card-border);padding:32px 24px;text-align:center;color:var(--text-dim);font-size:.9rem;margin-top:60px}
footer a{color:var(--text-dim)}footer a:hover{color:var(--green)}
</style>
</head>
<body>
<nav>
  <a href="/" class="brand">Phone Dashcam</a>
  <a href="/">Home</a><a href="/blog">Blog</a><a href="/about">About</a>
  <a href="https://play.google.com/store/apps/details?id=com.deerdash" target="_blank" rel="noopener">Get the App</a>
</nav>
<article>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${date} &middot; Phone Dashcam Team</p>
${html}
<div class="cta-box">
<h3>Get Phone Dashcam free</h3>
<p>Loop recording, crash detection, GPS tracking, and AI object detection — all in your phone. No new hardware required.</p>
<a class="btn-primary" href="https://play.google.com/store/apps/details?id=com.deerdash" target="_blank" rel="noopener">Download Phone Dashcam</a>
</div>
</article>
<footer>
<p>&copy; ${new Date().getFullYear()} <a href="/">Phone Dashcam</a> by Cyberlab Automation. All rights reserved.</p>
<p style="margin-top:8px;"><a href="/">Home</a> &middot; <a href="/blog">Blog</a> &middot; <a href="/privacy-policy.html">Privacy Policy</a> &middot; <a href="/terms.html">Terms</a></p>
</footer>
</body>
</html>` };
}

function injectBetweenMarkers(source, startMarker, endMarker, payload) {
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return null;
  return source.slice(0, startIdx + startMarker.length) + '\n' + payload + '\n' + source.slice(endIdx);
}

async function updateBlogIndex(newPosts) {
  const path = join(ROOT, 'blog.html');
  let src = await readFile(path, 'utf8');
  const START = '<!-- AUTO-BLOG-CARDS-START -->';
  const END = '<!-- AUTO-BLOG-CARDS-END -->';

  if (!src.includes(START)) {
    const inject = `\n    <h2 class="section-heading">Latest Articles</h2>\n    <div class="blog-grid">\n    ${START}\n    ${END}\n    </div>\n`;
    src = src.replace('<h2 class="section-heading">New This Month</h2>', inject + '\n    <h2 class="section-heading">New This Month</h2>');
  }

  // Read existing auto cards (so we accumulate, newest first)
  const between = src.slice(src.indexOf(START) + START.length, src.indexOf(END));
  const existing = between.trim();
  const newCards = newPosts.map(p =>
    `        <a href="/${p.slug}" class="blog-card">\n` +
    `            <h2>${escapeHtml(p.title)}</h2>\n` +
    `            <p>${escapeHtml(p.desc)}</p>\n` +
    `            <span class="blog-date">${p.date}</span>\n` +
    `            <span class="read-more">Read article</span>\n` +
    `        </a>`
  ).join('\n');
  const combined = [newCards, existing].filter(Boolean).join('\n');
  const updated = injectBetweenMarkers(src, START, END, combined);
  if (updated) await writeFile(path, updated);
}

async function updateSitemap(newPosts) {
  const path = join(ROOT, 'sitemap.xml');
  if (!existsSync(path)) return;
  let src = await readFile(path, 'utf8');
  const today = isoDate(Date.now());
  const entries = newPosts.map(p =>
    `  <url><loc>${SITE}/${p.slug}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`
  ).join('\n');
  if (!src.includes('</urlset>')) return;
  src = src.replace('</urlset>', entries + '\n</urlset>');
  await writeFile(path, src);
}

async function main() {
  const manifest = await loadManifest();
  console.log(`Listing articles…`);
  const list = await api('/v1/articles?limit=50');
  const unseen = list.filter(a => !manifest.posts[a.id]);
  console.log(`Found ${list.length} total, ${unseen.length} new.`);
  if (unseen.length === 0) return;

  const published = [];
  for (const summary of unseen) {
    try {
      console.log(`Fetching #${summary.id} ${summary.title}`);
      const full = await api(`/v1/articles/${summary.id}`);
      const post = renderPost(full);
      const outPath = join(ROOT, `${post.slug}.html`);
      if (existsSync(outPath)) {
        console.warn(`  skip — file already exists: ${post.slug}.html`);
        manifest.posts[summary.id] = { slug: post.slug, date: post.date, skipped: true };
        continue;
      }
      await writeFile(outPath, post.html);
      manifest.posts[summary.id] = { slug: post.slug, date: post.date, title: post.title };
      published.push(post);
      console.log(`  wrote ${post.slug}.html`);
    } catch (e) {
      console.error(`  FAILED #${summary.id}: ${e.message}`);
    }
  }

  if (published.length) {
    await updateBlogIndex(published);
    await updateSitemap(published);
  }
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`Done. Published ${published.length} new post(s).`);
}

main().catch(e => { console.error(e); process.exit(1); });
