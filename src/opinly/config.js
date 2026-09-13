// Opinly blog integration — single source of truth for URLs and constants.
//
// Every route mapping in the worker (pages, sitemap, RSS, webhook invalidation)
// goes through routePath() so the four can never drift apart.

export const SITE_URL = 'https://phonedashcam.com';
export const SITE_NAME = 'DriveSight';
export const ORG_NAME = 'Cyberlab Automation';
export const ORG_ID = `${SITE_URL}/#organization`;
export const ORG_LOGO = `${SITE_URL}/assets/icon-512.webp`;
export const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/hero-dashcam.jpg`;

export const BLOG_PREFIX = '/blog';
export const CATEGORY_PREFIX = 'category';
export const AUTHOR_PREFIX = 'authors';
export const TAG_PREFIX = 'tag';
export const RSS_PATH = `${BLOG_PREFIX}/rss.xml`;
export const SITEMAP_PATH = '/sitemap.xml';
export const WEBHOOK_PATH = '/api/opinly-webhook';
export const PURCHASE_INGEST_PATH = '/api/opinly/purchase';
// The pre-Opinly static blog index (blog.html) keeps its ~100 hand-built
// guides reachable here; the new index links to it.
export const ARCHIVE_PATH = '/blog-archive';

export const API_URL_DEFAULT = 'https://sdk.opinly.ai';
export const CDN_BASE = 'https://cdn.opinly.ai/BTxA7nMFSIcYDbIUpqapG';

// Publishable pixel key: write-only, meant to ship in HTML.
export const PIXEL_KEY = 'pk-x3Ndgpy8F7LYjLNTRlDHjHEGplgr8y8F0KBFqtR';
export const PIXEL_SRC = 'https://static.opinly.ai/p.js';
export const EVENTS_SCRIPT = '/assets/opinly-events.js';

export const PAGE_SIZE = 12;
export const RSS_LIMIT = 20;

const SLUG_RE = /^[a-z0-9][a-z0-9._~-]{0,199}$/i;
export function isSafeSlug(slug) {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

// Map an Opinly route entity ({ type, slug }) onto this site's URL path.
// Returns null for unknown types so callers can skip them safely.
export function routePath(type, slug = '') {
  switch (type) {
    case 'home':
      return BLOG_PREFIX;
    case 'post':
      return slug ? `${BLOG_PREFIX}/${slug}` : BLOG_PREFIX;
    case 'category':
      return slug ? `${BLOG_PREFIX}/${CATEGORY_PREFIX}/${slug}` : `${BLOG_PREFIX}/${CATEGORY_PREFIX}`;
    case 'author':
      return slug ? `${BLOG_PREFIX}/${AUTHOR_PREFIX}/${slug}` : `${BLOG_PREFIX}/${AUTHOR_PREFIX}`;
    case 'tag':
      return slug ? `${BLOG_PREFIX}/${TAG_PREFIX}/${slug}` : BLOG_PREFIX;
    default:
      return null;
  }
}

export function absUrl(path) {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

// Image fields come back as CDN-relative file keys. Render them verbatim under
// the CDN namespace; if the API ever hands us an absolute URL, pass it through.
export function imageUrl(fileKey) {
  if (!fileKey || typeof fileKey !== 'string') return null;
  if (/^https?:\/\//i.test(fileKey)) return fileKey;
  return `${CDN_BASE}/${fileKey.replace(/^\/+/, '')}`;
}
