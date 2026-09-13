// sitemap.xml (static file + Opinly routes merged) and the blog RSS feed.

import { SITE_NAME, BLOG_PREFIX, RSS_PATH, RSS_LIMIT, absUrl, routePath } from './config.js';
import { escapeHtml } from './render.js';

const EMPTY_URLSET = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n';

function lastmod(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Turn Opinly route entries into absolute { loc, lastmod } pairs. Unknown types
// are dropped; duplicates keep the newest lastModified.
export function sitemapEntries(routes) {
  const byLoc = new Map();
  const add = (path, lastModified) => {
    const loc = absUrl(path);
    const mod = lastmod(lastModified);
    const prev = byLoc.get(loc);
    if (!prev || (mod && (!prev.lastmod || mod > prev.lastmod))) byLoc.set(loc, { loc, lastmod: mod });
  };
  let homeMod = null;
  for (const r of routes || []) {
    const path = routePath(r.type, r.slug);
    if (!path) continue;
    if (r.type === 'home') homeMod = r.lastModified;
    add(path, r.lastModified);
  }
  // The category and author directories are indexable pages of ours that the
  // API's route list does not enumerate.
  add(routePath('category'), homeMod);
  add(routePath('author'), homeMod);
  return [...byLoc.values()];
}

// Merge: drop any static <url> whose <loc> Opinly now owns, then append the
// Opinly entries before </urlset>. The static file's namespaces are kept.
export function mergeSitemap(staticXml, entries) {
  let xml = staticXml && staticXml.includes('</urlset>') ? staticXml : EMPTY_URLSET;
  const owned = new Set(entries.map((e) => e.loc));
  xml = xml.replace(/<url>[\s\S]*?<\/url>\s*/g, (block) => {
    const m = block.match(/<loc>\s*([^<]+?)\s*<\/loc>/);
    return m && owned.has(m[1].trim()) ? '' : block;
  });
  const extra = entries.map((e) => `  <url>\n    <loc>${escapeHtml(e.loc)}</loc>\n${e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : ''}  </url>\n`).join('');
  return xml.replace('</urlset>', `${extra}</urlset>`);
}

export async function sitemapResponse({ env, client, origin }) {
  let staticXml = EMPTY_URLSET;
  try {
    const res = env?.ASSETS ? await env.ASSETS.fetch(new Request(`${origin}/sitemap.xml`)) : null;
    if (res && res.ok) staticXml = await res.text();
  } catch { /* fall back to the empty urlset */ }

  let degraded = false;
  let entries = [];
  try {
    entries = sitemapEntries(await client.routes());
  } catch (e) {
    degraded = true;
    console.warn('[opinly] sitemap: routes unavailable, serving static sitemap', e?.message || e);
  }
  const body = degraded ? staticXml : mergeSitemap(staticXml, entries);
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': degraded ? 'public, max-age=0, s-maxage=60' : 'public, max-age=0, s-maxage=600',
      ...(degraded ? { 'x-opinly-sitemap': 'degraded' } : {}),
    },
  });
}

function rfc822(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toUTCString();
}

export function buildRss(items, { now = new Date() } = {}) {
  const channelUrl = absUrl(BLOG_PREFIX);
  const selfUrl = absUrl(RSS_PATH);
  const dates = (items || []).map((i) => new Date(i.date).getTime()).filter((t) => Number.isFinite(t));
  const lastBuild = dates.length ? new Date(Math.max(...dates)) : now;
  const itemXml = (items || []).map((it) => {
    const link = absUrl(routePath('post', it.slug));
    const pub = rfc822(it.date);
    const cats = (it.categories || []).map((c) => `      <category>${escapeHtml(c)}</category>\n`).join('');
    return `    <item>
      <title>${escapeHtml(it.title)}</title>
      <link>${escapeHtml(link)}</link>
      <guid isPermaLink="true">${escapeHtml(link)}</guid>
${pub ? `      <pubDate>${pub}</pubDate>\n` : ''}${it.description ? `      <description>${escapeHtml(it.description)}</description>\n` : ''}${cats}    </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(SITE_NAME)} Blog</title>
    <link>${escapeHtml(channelUrl)}</link>
    <description>Dashcam guides, driving safety, and DriveSight product updates.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeHtml(selfUrl)}" rel="self" type="application/rss+xml"/>
${itemXml}
  </channel>
</rss>
`;
}

export async function rssResponse({ client }) {
  const items = await client.rss({ limit: RSS_LIMIT });
  return new Response(buildRss(items), {
    status: 200,
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=600',
    },
  });
}
