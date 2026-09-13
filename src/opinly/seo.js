// Head metadata and schema.org JSON-LD builders for the blog pages.

import {
  SITE_URL, SITE_NAME, ORG_NAME, ORG_ID, ORG_LOGO, DEFAULT_OG_IMAGE, RSS_PATH,
  absUrl, imageUrl, routePath,
} from './config.js';
import { escapeHtml } from './render.js';

export function jsonLdScript(obj) {
  // "<" cannot terminate the script element once escaped as \u003c.
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

export const publisherJsonLd = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: ORG_NAME,
  url: SITE_URL,
  logo: { '@type': 'ImageObject', url: ORG_LOGO, width: 1024, height: 1024 },
};

export function pageTitle(title) {
  if (!title) return `${SITE_NAME} Blog`;
  return new RegExp(`\\b${SITE_NAME}\\b`, 'i').test(title) ? title : `${title} | ${SITE_NAME}`;
}

function isoDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Standard <head> block: title, description, canonical, Open Graph, Twitter.
export function metaTags({
  title,
  description,
  canonical,
  ogType = 'website',
  ogImage,
  ogImageAlt,
  publishedTime,
  modifiedTime,
  authorUrl,
  tags = [],
  noindex = false,
  prevUrl,
  nextUrl,
}) {
  const fullTitle = pageTitle(title);
  const desc = (description || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const image = ogImage || DEFAULT_OG_IMAGE;
  const lines = [
    `<title>${escapeHtml(fullTitle)}</title>`,
    desc ? `<meta name="description" content="${escapeHtml(desc)}">` : '',
    `<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">`,
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : '',
    prevUrl ? `<link rel="prev" href="${escapeHtml(prevUrl)}">` : '',
    nextUrl ? `<link rel="next" href="${escapeHtml(nextUrl)}">` : '',
    `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_NAME)} Blog" href="${escapeHtml(absUrl(RSS_PATH))}">`,
    `<meta property="og:type" content="${escapeHtml(ogType)}">`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:title" content="${escapeHtml(fullTitle)}">`,
    desc ? `<meta property="og:description" content="${escapeHtml(desc)}">` : '',
    canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}">` : '',
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    ogImageAlt ? `<meta property="og:image:alt" content="${escapeHtml(ogImageAlt)}">` : '',
    ogType === 'article' && isoDate(publishedTime) ? `<meta property="article:published_time" content="${isoDate(publishedTime)}">` : '',
    ogType === 'article' && isoDate(modifiedTime) ? `<meta property="article:modified_time" content="${isoDate(modifiedTime)}">` : '',
    // Open Graph defines article:author as a profile URL, not a name.
    ogType === 'article' && authorUrl ? `<meta property="article:author" content="${escapeHtml(authorUrl)}">` : '',
    ...(ogType === 'article' ? tags.map((t) => `<meta property="article:tag" content="${escapeHtml(t)}">`) : []),
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:site" content="@drivesightapp">`,
    `<meta name="twitter:title" content="${escapeHtml(fullTitle)}">`,
    desc ? `<meta name="twitter:description" content="${escapeHtml(desc)}">` : '',
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
  ];
  return lines.filter(Boolean).join('\n');
}

export function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absUrl(item.url),
    })),
  };
}

export function personJsonLd(author) {
  if (!author) return null;
  const image = imageUrl(author.fileKey ?? author.image?.fileKey);
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${absUrl(routePath('author', author.slug))}#person`,
    name: author.name,
    url: absUrl(routePath('author', author.slug)),
    ...(image ? { image } : {}),
    ...(author.bio ? { description: author.bio } : {}),
  };
}

export function blogPostingJsonLd(post, { wordCount, bodyText } = {}) {
  const url = absUrl(routePath('post', post.slug));
  const hero = imageUrl(post.titleFile?.fileKey);
  const author = post.author
    ? { '@type': 'Person', name: post.author.name, url: absUrl(routePath('author', post.author.slug)) }
    : { '@type': 'Organization', '@id': ORG_ID, name: ORG_NAME };
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#blogposting`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    headline: post.title,
    description: post.metaDescription || post.description || undefined,
    image: hero ? [hero] : [DEFAULT_OG_IMAGE],
    datePublished: isoDate(post.firstPublishedAt) || undefined,
    dateModified: isoDate(post.modifiedAt) || isoDate(post.firstPublishedAt) || undefined,
    author,
    publisher: publisherJsonLd,
    isPartOf: { '@type': 'Blog', '@id': `${absUrl(routePath('home'))}#blog`, name: `${SITE_NAME} Blog` },
    inLanguage: 'en-US',
    ...(post.category ? { articleSection: post.category.name } : {}),
    ...(post.tags?.length ? { keywords: post.tags.map((t) => t.name).join(', ') } : {}),
    ...(wordCount ? { wordCount } : {}),
    ...(bodyText ? { articleBody: bodyText } : {}),
  };
}

export function faqJsonLd(faqs) {
  const list = (faqs || []).filter((f) => f?.question && f?.answer);
  if (!list.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: list.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function blogJsonLd({ posts = [] } = {}) {
  const url = absUrl(routePath('home'));
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${url}#blog`,
    url,
    name: `${SITE_NAME} Blog`,
    description: 'Dashcam guides, driving safety, and DriveSight product updates.',
    publisher: publisherJsonLd,
    inLanguage: 'en-US',
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: absUrl(routePath('post', p.slug)),
      datePublished: isoDate(p.firstPublishedAt) || undefined,
    })),
  };
}

export function collectionPageJsonLd({ name, description, url, posts = [] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    url,
    name,
    ...(description ? { description } : {}),
    isPartOf: { '@type': 'Blog', '@id': `${absUrl(routePath('home'))}#blog` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: posts.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: absUrl(routePath('post', p.slug)),
        name: p.title,
      })),
    },
  };
}
