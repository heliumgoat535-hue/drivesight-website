// Tiptap (ProseMirror) JSON → HTML for Opinly post bodies.
//
// Pure functions, no DOM. All text is escaped, link hrefs are sanitised, and
// unknown node/mark types degrade to their children rather than throwing.

import { imageUrl } from './config.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const DEFAULT_SITE = 'https://phonedashcam.com';
// C0 controls and DEL: the WHATWG URL parser strips TAB/LF/CR and leading
// controls, so "java\tscript:" would otherwise slip past a scheme regex.
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

// Returns a safe href or null. Safety is decided on the PARSED URL, never on
// the raw string. Same-origin links come back relative; external ones absolute.
export function safeHref(href, siteUrl = DEFAULT_SITE) {
  if (typeof href !== 'string') return null;
  const trimmed = href.trim();
  if (!trimmed || CONTROL_RE.test(trimmed)) return null;
  if (trimmed.startsWith('#')) return trimmed;
  if (trimmed.startsWith('//')) return null;
  let base;
  try { base = new URL(siteUrl || DEFAULT_SITE); } catch { base = new URL(DEFAULT_SITE); }
  let u;
  try { u = new URL(trimmed, `${base.origin}/`); } catch { return null; }
  if (!SAFE_PROTOCOLS.has(u.protocol)) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  if (!hasScheme) {
    // "/path" or "path" must stay on our origin ("/\evil.example" resolves elsewhere).
    if (u.origin !== base.origin) return null;
    return u.pathname + u.search + u.hash;
  }
  return u.href;
}

const SAFE_COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%]+\)|hsla?\(\s*[\d.\s,%]+\)|[a-z]{3,20})$/i;

export function slugifyHeading(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';
}

export function nodeText(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return ' ';
  return (node.content || []).map(nodeText).join('');
}

export function countWords(node) {
  const text = nodeText(node).trim();
  return text ? text.split(/\s+/).length : 0;
}

export function readingTimeMinutes(node, wpm = 220) {
  return Math.max(1, Math.round(countWords(node) / wpm));
}

// First ~n characters of plain text, cut on a word boundary.
export function excerpt(node, max = 200) {
  const text = nodeText(node).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).trim()}…`;
}

function applyMarks(html, marks, ctx) {
  if (!Array.isArray(marks) || marks.length === 0) return html;
  let out = html;
  // Innermost mark first (matches Tiptap's own HTML serialisation order).
  for (let i = marks.length - 1; i >= 0; i -= 1) {
    const mark = marks[i] || {};
    const attrs = mark.attrs || {};
    switch (mark.type) {
      case 'bold': out = `<strong>${out}</strong>`; break;
      case 'italic': out = `<em>${out}</em>`; break;
      case 'strike': out = `<s>${out}</s>`; break;
      case 'underline': out = `<u>${out}</u>`; break;
      case 'code': out = `<code>${out}</code>`; break;
      case 'subscript': out = `<sub>${out}</sub>`; break;
      case 'superscript': out = `<sup>${out}</sup>`; break;
      case 'highlight': out = `<mark>${out}</mark>`; break;
      case 'textStyle': {
        const color = typeof attrs.color === 'string' && SAFE_COLOR_RE.test(attrs.color.trim()) ? attrs.color.trim() : null;
        if (color) out = `<span style="color:${escapeHtml(color)}">${out}</span>`;
        break;
      }
      case 'link': {
        const href = safeHref(attrs.href, ctx.siteUrl);
        if (!href) break;
        const isExternal = /^https?:\/\//i.test(href) && !(ctx.siteUrl && href.startsWith(ctx.siteUrl));
        const target = attrs.target === '_blank' || isExternal ? ' target="_blank"' : '';
        const rel = target ? ' rel="noopener"' : '';
        const title = attrs.title ? ` title="${escapeHtml(attrs.title)}"` : '';
        out = `<a href="${escapeHtml(href)}"${target}${rel}${title}>${out}</a>`;
        break;
      }
      default: break;
    }
  }
  return out;
}

function alignAttr(node) {
  const a = node?.attrs?.textAlign;
  return a === 'center' || a === 'right' || a === 'justify' ? ` style="text-align:${a}"` : '';
}

function intAttr(v) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function renderImage(node, ctx) {
  const attrs = node.attrs || {};
  const src = imageUrl(attrs.fileKey) || safeHref(attrs.src, ctx.siteUrl);
  if (!src || !/^https?:\/\//i.test(src) && !src.startsWith('/')) return '';
  // FullPost.images[] carries alt/title/caption per fileKey; use it when the
  // node itself does not say.
  const meta = (attrs.fileKey && ctx.images.get(attrs.fileKey)) || {};
  const alt = escapeHtml(attrs.alt ?? attrs.altText ?? meta.altText ?? '');
  const titleText = attrs.title ?? meta.title;
  const title = titleText ? ` title="${escapeHtml(titleText)}"` : '';
  const w = intAttr(attrs.width);
  const h = intAttr(attrs.height);
  const size = `${w ? ` width="${w}"` : ''}${h ? ` height="${h}"` : ''}`;
  const captionText = attrs.caption ?? meta.caption;
  const caption = captionText ? `<figcaption>${escapeHtml(captionText)}</figcaption>` : '';
  return `<figure class="post-figure"><img src="${escapeHtml(src)}" alt="${alt}"${title}${size} loading="lazy" decoding="async">${caption}</figure>`;
}

function renderNode(node, ctx) {
  if (!node || typeof node !== 'object') return '';
  const children = () => (node.content || []).map((c) => renderNode(c, ctx)).join('');
  const attrs = node.attrs || {};
  switch (node.type) {
    case 'doc':
      return children();
    case 'text':
      return applyMarks(escapeHtml(node.text || ''), node.marks, ctx);
    case 'paragraph': {
      const inner = children();
      return inner.trim() ? `<p${alignAttr(node)}>${inner}</p>` : '';
    }
    case 'heading': {
      // The page already has the post title as its h1; demote body h1s to h2.
      const level = Math.min(6, Math.max(2, Number(attrs.level) || 2));
      const text = nodeText(node).trim();
      let id = slugifyHeading(text);
      const seen = ctx.ids.get(id) || 0;
      ctx.ids.set(id, seen + 1);
      if (seen) id = `${id}-${seen + 1}`;
      ctx.headings.push({ level, text, id });
      return `<h${level} id="${id}"${alignAttr(node)}>${children()}</h${level}>`;
    }
    case 'image':
      return renderImage(node, ctx);
    case 'bulletList':
      return `<ul>${children()}</ul>`;
    case 'orderedList': {
      const start = intAttr(attrs.start);
      return `<ol${start && start !== 1 ? ` start="${start}"` : ''}>${children()}</ol>`;
    }
    case 'listItem':
      return `<li>${children()}</li>`;
    case 'taskList':
      return `<ul class="task-list">${children()}</ul>`;
    case 'taskItem':
      return `<li class="task-item"><input type="checkbox" disabled${attrs.checked ? ' checked' : ''} aria-label="${attrs.checked ? 'Done' : 'Not done'}">${children()}</li>`;
    case 'blockquote':
      return `<blockquote>${children()}</blockquote>`;
    case 'codeBlock': {
      const lang = typeof attrs.language === 'string' && /^[a-z0-9_+-]{1,30}$/i.test(attrs.language)
        ? ` class="language-${escapeHtml(attrs.language)}"` : '';
      return `<pre><code${lang}>${escapeHtml(nodeText(node))}</code></pre>`;
    }
    case 'horizontalRule':
      return '<hr>';
    case 'hardBreak':
      return '<br>';
    case 'table': {
      // Track the row index so header cells get the right scope: first row =
      // column headers, later rows = row headers (comparison tables).
      const rows = (node.content || []).map((row, i) => renderNode(row, { ...ctx, rowIndex: i })).join('');
      return `<div class="table-wrap" role="region" aria-label="Table" tabindex="0"><table>${rows}</table></div>`;
    }
    case 'tableRow':
      return `<tr>${children()}</tr>`;
    case 'tableHeader':
    case 'tableCell': {
      const tag = node.type === 'tableHeader' ? 'th' : 'td';
      const colspan = intAttr(attrs.colspan);
      const rowspan = intAttr(attrs.rowspan);
      const span = `${colspan && colspan > 1 ? ` colspan="${colspan}"` : ''}${rowspan && rowspan > 1 ? ` rowspan="${rowspan}"` : ''}`;
      const scope = tag === 'th' ? ` scope="${ctx.rowIndex ? 'row' : 'col'}"` : '';
      return `<${tag}${span}${scope}>${children()}</${tag}>`;
    }
    default:
      // Unknown container → render its children; unknown leaf → skip.
      return Array.isArray(node.content) ? children() : '';
  }
}

// Render a post body. Returns html plus the headings (for a table of contents)
// and word count collected during the same walk.
export function renderPostBody(content, { siteUrl = '', images = [] } = {}) {
  const imageMeta = new Map();
  for (const img of Array.isArray(images) ? images : []) {
    if (img && typeof img.fileKey === 'string') imageMeta.set(img.fileKey, img);
  }
  const ctx = { siteUrl, headings: [], ids: new Map(), images: imageMeta, rowIndex: 0 };
  const html = renderNode(content, ctx);
  return { html, headings: ctx.headings, words: countWords(content) };
}

export function renderToHtml(content, opts) {
  return renderPostBody(content, opts).html;
}
