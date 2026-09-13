// HTML templates for the Opinly-powered blog. Server-rendered in the Worker;
// styling mirrors index.html's design tokens (charcoal + emerald, Outfit/Inter).

import {
  SITE_URL, SITE_NAME, BLOG_PREFIX, RSS_PATH, ARCHIVE_PATH, PIXEL_KEY, PIXEL_SRC, EVENTS_SCRIPT,
  DEFAULT_OG_IMAGE, absUrl, imageUrl, routePath,
} from './config.js';
import { escapeHtml } from './render.js';
import {
  metaTags, jsonLdScript, breadcrumbJsonLd, blogPostingJsonLd, faqJsonLd, blogJsonLd,
  collectionPageJsonLd, personJsonLd,
} from './seo.js';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.deerdash';
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800;900&display=swap';

export const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--color-bg-main:#121317;--color-bg-card:#1c1d22;--color-bg-dark:#0e0f12;--color-bg-navbar:rgba(18,19,23,.8);--color-primary:#10b981;--color-primary-light:rgba(16,185,129,.08);--color-primary-dark:#059669;--color-secondary:#3b82f6;--color-accent:#ea580c;--color-red:#ef4444;--border-color:rgba(255,255,255,.08);--border-color-hover:rgba(255,255,255,.15);--text-bright:#fff;--text-normal:#c7cbd3;--text-dim:#8b95a8;--text-light:#4b5563;--font-title:'Outfit','Inter',-apple-system,sans-serif;--font-body:'Inter',-apple-system,sans-serif;--shadow-md:0 10px 30px rgba(0,0,0,.3),0 1px 3px rgba(0,0,0,.2);--green:var(--color-primary);--green-dark:var(--color-primary-dark);--card-bg:var(--color-bg-card);--card-border:var(--border-color);--text:var(--text-normal);--radius:14px}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important;animation:none!important}}
body{font-family:var(--font-body);background:var(--color-bg-main);color:var(--text-normal);line-height:1.65;min-height:100vh;display:flex;flex-direction:column;overflow-x:hidden}
a{color:inherit;text-decoration:none}
img{max-width:100%;height:auto;display:block}
.skip-link{position:absolute;left:-999px;top:8px;background:var(--green);color:#000;padding:10px 16px;border-radius:8px;font-weight:700;z-index:2000}
.skip-link:focus{left:8px}
:focus-visible{outline:2px solid var(--green);outline-offset:3px;border-radius:4px}
.navbar{position:fixed;top:0;left:0;right:0;z-index:1000;background:var(--color-bg-navbar);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--border-color);padding:0 24px}
.navbar-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:64px;gap:16px}
.nav-logo{display:flex;align-items:center;gap:10px;font-family:var(--font-title);font-size:1.25rem;color:var(--text-bright);flex-shrink:0}
.nav-logo img{width:36px;height:36px;border-radius:8px}
.nav-logo span{font-weight:700;letter-spacing:-.03em;text-transform:lowercase;background:linear-gradient(90deg,#fff 40%,#10b981 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.nav-links{display:flex;gap:28px;align-items:center}
.nav-links a{font-size:.9rem;font-weight:500;color:var(--text-dim);transition:color .2s}
.nav-links a:hover,.nav-links a.active,.nav-links a[aria-current=page]{color:var(--text-bright)}
.nav-social{display:flex;gap:2px;align-items:center;margin-left:4px;padding-left:12px;border-left:1px solid var(--border-color)}
.nav-links .nav-social a{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;color:var(--text-dim)}
.nav-links .nav-social a:hover{color:var(--green);background:var(--color-primary-light)}
.nav-cta{background:var(--green);color:#000!important;padding:8px 18px;border-radius:8px;font-weight:700;font-size:.85rem;transition:background .2s,transform .2s}
.nav-cta:hover{background:var(--green-dark);transform:translateY(-1px)}
.mobile-menu-btn{display:none;background:none;border:none;color:var(--text-bright);font-size:1.5rem;cursor:pointer;padding:6px}
main{flex:1;width:100%}
.wrap{max-width:1100px;margin:0 auto;padding:0 24px}
.narrow{max-width:760px}
.page-head{padding:120px 0 32px}
.eyebrow{font-size:.78rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--green);margin-bottom:12px}
h1{font-family:var(--font-title);font-size:clamp(2rem,4.5vw,3.2rem);font-weight:800;letter-spacing:-.02em;color:var(--text-bright);line-height:1.12}
.lede{font-size:1.1rem;color:var(--text-dim);margin-top:14px;max-width:700px;line-height:1.7}
.breadcrumbs{font-size:.82rem;color:var(--text-dim);margin-bottom:18px}
.breadcrumbs ol{list-style:none;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.breadcrumbs li+li::before{content:'/';color:var(--text-light);margin-right:6px}
.breadcrumbs a:hover{color:var(--green)}
.breadcrumbs [aria-current]{color:var(--text-normal)}
.toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin:8px 0 28px}
.chips{display:flex;flex-wrap:wrap;gap:8px;list-style:none}
.chip{display:inline-flex;align-items:center;font-size:.8rem;font-weight:600;padding:6px 12px;border-radius:999px;border:1px solid var(--border-color);color:var(--text-dim);background:var(--card-bg);transition:border-color .2s,color .2s}
.chip:hover{border-color:var(--green);color:var(--text-bright)}
.chip[aria-current]{background:var(--green);border-color:var(--green);color:#000}
.sort{display:inline-flex;border:1px solid var(--border-color);border-radius:8px;overflow:hidden;font-size:.8rem;font-weight:600}
.sort a{padding:6px 12px;color:var(--text-dim)}
.sort a[aria-current]{background:var(--color-primary-light);color:var(--green)}
.post-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px;list-style:none;margin-bottom:36px}
.post-card{background:var(--card-bg);border:1px solid var(--border-color);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column;transition:transform .2s,border-color .2s,box-shadow .2s;position:relative}
.post-card:hover{transform:translateY(-3px);border-color:var(--border-color-hover);box-shadow:var(--shadow-md)}
.post-card:focus-within{border-color:var(--green)}
.post-card .thumb{aspect-ratio:16/9;background:var(--color-bg-dark);overflow:hidden}
.post-card .thumb img{width:100%;height:100%;object-fit:cover}
.post-card .thumb.placeholder{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#16211d,#0e0f12)}
.post-card .thumb.placeholder svg{width:48px;height:48px;color:var(--green);opacity:.6}
.post-card .body{padding:20px 22px 22px;display:flex;flex-direction:column;gap:10px;flex:1}
.post-card .cat{font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--green)}
.post-card h2,.post-card h3{font-family:var(--font-title);font-size:1.2rem;font-weight:700;color:var(--text-bright);line-height:1.35}
.post-card h2 a::after,.post-card h3 a::after{content:'';position:absolute;inset:0}
.post-card p{font-size:.92rem;color:var(--text-dim);line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.post-card .meta{margin-top:auto;font-size:.8rem;color:var(--text-dim);display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding-top:6px}
.avatar{width:26px;height:26px;border-radius:50%;object-fit:cover;background:var(--color-bg-dark);border:1px solid var(--border-color)}
.avatar.lg{width:72px;height:72px}
.pager{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:8px 0 56px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:10px;font-weight:700;font-size:.92rem;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-bright);transition:border-color .2s,background .2s,transform .2s;cursor:pointer}
.btn:hover{border-color:var(--green);transform:translateY(-1px)}
.btn.primary{background:var(--green);border-color:var(--green);color:#000}
.btn.primary:hover{background:var(--green-dark)}
.btn[aria-busy=true]{opacity:.6;pointer-events:none}
.notice{background:var(--card-bg);border:1px solid var(--border-color);border-radius:var(--radius);padding:36px 28px;text-align:center;margin:12px 0 56px}
.notice h2{font-family:var(--font-title);color:var(--text-bright);font-size:1.4rem;margin-bottom:10px}
.notice p{color:var(--text-dim);max-width:520px;margin:0 auto 18px}
.notice.error{border-color:rgba(239,68,68,.35)}
.notice .code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.75rem;color:var(--text-dim);margin-top:12px}
.archive-callout{border-top:1px solid var(--border-color);padding:28px 0 56px;color:var(--text-dim);font-size:.92rem}
.archive-callout a{color:var(--green);font-weight:600;text-decoration:underline;text-decoration-color:rgba(16,185,129,.4);text-underline-offset:3px}
.archive-callout a:hover{text-decoration-color:var(--green)}
article.post{padding-top:110px}
.post-header{max-width:760px;margin:0 auto}
.post-meta{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;margin-top:22px;font-size:.88rem;color:var(--text-dim)}
.post-meta .who{display:inline-flex;align-items:center;gap:10px;color:var(--text-normal);font-weight:600}
.post-meta .who:hover{color:var(--green)}
.post-hero{max-width:1000px;margin:36px auto 0}
.post-hero img{width:100%;border-radius:var(--radius);border:1px solid var(--border-color);aspect-ratio:16/9;object-fit:cover}
.post-hero figcaption{font-size:.82rem;color:var(--text-dim);margin-top:10px;text-align:center}
.post-layout{max-width:760px;margin:40px auto 0}
.toc{background:var(--card-bg);border:1px solid var(--border-color);border-radius:var(--radius);padding:20px 24px;margin-bottom:36px}
.toc summary{font-family:var(--font-title);font-weight:700;color:var(--text-bright);cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center}
.toc summary::-webkit-details-marker{display:none}
.toc summary::after{content:'+';color:var(--green);font-size:1.2rem}
.toc[open] summary::after{content:'–'}
.toc ol{margin-top:14px;padding-left:20px;display:flex;flex-direction:column;gap:8px;font-size:.92rem}
.toc ol a{color:var(--text-dim)}
.toc ol a:hover{color:var(--green)}
.toc .lvl-3{padding-left:16px;font-size:.86rem}
.post-body{font-size:1.06rem;line-height:1.8;color:var(--text-normal)}
.post-body>*+*{margin-top:1.15em}
.post-body h2,.post-body h3,.post-body h4{font-family:var(--font-title);color:var(--text-bright);line-height:1.3;scroll-margin-top:90px}
.post-body h2{font-size:1.7rem;margin-top:2em}
.post-body h3{font-size:1.32rem;margin-top:1.6em}
.post-body h4{font-size:1.1rem}
.post-body a{color:var(--green);text-decoration:underline;text-decoration-color:rgba(16,185,129,.4);text-underline-offset:3px}
.post-body a:hover{text-decoration-color:var(--green)}
.post-body ul,.post-body ol{padding-left:1.4em}
.post-body li+li{margin-top:.4em}
.post-body ul.task-list{list-style:none;padding-left:0}
.post-body li.task-item{display:flex;gap:10px;align-items:flex-start}
.post-body blockquote{border-left:3px solid var(--green);padding:6px 0 6px 20px;color:var(--text-dim);font-style:italic}
.post-body pre{background:var(--color-bg-dark);border:1px solid var(--border-color);border-radius:10px;padding:16px 18px;overflow-x:auto;font-size:.88rem;line-height:1.6}
.post-body code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;background:rgba(255,255,255,.06);padding:.15em .4em;border-radius:4px}
.post-body pre code{background:none;padding:0}
.post-body hr{border:0;border-top:1px solid var(--border-color);margin:2.4em 0}
.post-body .post-figure{margin:2em 0}
.post-body .post-figure img{border-radius:12px;border:1px solid var(--border-color);margin:0 auto}
.post-body figcaption{font-size:.84rem;color:var(--text-dim);text-align:center;margin-top:10px}
.post-body .table-wrap{overflow-x:auto;border:1px solid var(--border-color);border-radius:10px}
.post-body table{width:100%;border-collapse:collapse;font-size:.92rem}
.post-body th,.post-body td{padding:10px 14px;border-bottom:1px solid var(--border-color);text-align:left;vertical-align:top}
.post-body th{background:var(--card-bg);color:var(--text-bright);font-weight:700}
.post-body tr:last-child td{border-bottom:0}
.post-body mark{background:rgba(16,185,129,.25);color:inherit;padding:0 .15em}
.faq{margin-top:56px;padding-top:36px;border-top:1px solid var(--border-color)}
.faq h2{font-family:var(--font-title);color:var(--text-bright);font-size:1.5rem;margin-bottom:18px}
.faq details{border:1px solid var(--border-color);border-radius:10px;background:var(--card-bg);margin-bottom:10px}
.faq summary{padding:16px 20px;font-weight:700;color:var(--text-bright);cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:12px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:'+';color:var(--green);flex-shrink:0}
.faq details[open] summary::after{content:'–'}
.faq .answer{padding:0 20px 18px;color:var(--text-dim);line-height:1.7}
.tag-list{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin-top:40px}
.author-card{display:flex;gap:18px;align-items:flex-start;background:var(--card-bg);border:1px solid var(--border-color);border-radius:var(--radius);padding:24px;margin-top:40px}
.author-card h2{font-family:var(--font-title);font-size:1.1rem;color:var(--text-bright)}
.author-card p{color:var(--text-dim);font-size:.92rem;margin-top:6px;line-height:1.6}
.author-card a.more{display:inline-block;margin-top:10px;color:var(--green);font-weight:600;font-size:.88rem}
.cta-card{margin-top:40px;background:linear-gradient(135deg,rgba(16,185,129,.14),rgba(59,130,246,.08));border:1px solid rgba(16,185,129,.35);border-radius:var(--radius);padding:30px 28px;display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between}
.cta-card h2{font-family:var(--font-title);color:var(--text-bright);font-size:1.35rem}
.cta-card p{color:var(--text-dim);margin-top:6px;max-width:520px}
.related{max-width:1100px;margin:64px auto 0;padding-bottom:64px}
.related h2{font-family:var(--font-title);color:var(--text-bright);font-size:1.5rem;margin-bottom:22px}
.section{padding-bottom:64px}
.section h2{font-family:var(--font-title);color:var(--text-bright);font-size:1.5rem;margin-bottom:22px}
.cat-list,.author-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:22px;list-style:none;margin-bottom:56px}
.cat-card,.author-item{background:var(--card-bg);border:1px solid var(--border-color);border-radius:var(--radius);padding:24px}
.cat-card h2,.author-item h2{font-family:var(--font-title);font-size:1.25rem;color:var(--text-bright)}
.cat-card h2 a:hover,.author-item h2 a:hover{color:var(--green)}
.cat-card p,.author-item p{color:var(--text-dim);font-size:.92rem;margin-top:8px;line-height:1.6}
.cat-card ul,.author-item ul{list-style:none;margin-top:14px;display:flex;flex-direction:column;gap:8px;font-size:.9rem}
.cat-card ul a,.author-item ul a{color:var(--text-normal)}
.cat-card ul a:hover,.author-item ul a:hover{color:var(--green)}
.author-item header{display:flex;gap:14px;align-items:center}
.profile{display:flex;gap:22px;align-items:center;margin-top:8px}
footer{border-top:1px solid var(--border-color);padding:48px 24px 24px;background:var(--color-bg-dark)}
.footer-inner{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr;gap:40px}
.footer-brand p{color:var(--text-dim);font-size:.85rem;margin-top:12px;line-height:1.6}
.footer-col{display:flex;flex-direction:column;gap:10px}
.footer-col-head{color:var(--text-bright);font-weight:700;font-size:.9rem}
.footer-col a{color:var(--text-dim);font-size:.85rem;transition:color .2s}
.footer-col a:hover{color:var(--green)}
.footer-bottom{max-width:1200px;margin:32px auto 0;padding-top:24px;border-top:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;font-size:.8rem;color:var(--text-dim);flex-wrap:wrap;gap:10px}
.footer-bottom a{color:var(--green);text-decoration:underline}
@media (max-width:1024px){.footer-inner{grid-template-columns:1fr 1fr 1fr}}
@media (max-width:900px){.nav-links{gap:14px}.nav-social{padding-left:6px}}
@media (max-width:768px){.nav-links{display:none;flex-direction:column;position:absolute;top:64px;left:0;right:0;background:rgba(14,15,18,.97);padding:24px;gap:16px;border-bottom:1px solid var(--border-color);align-items:flex-start}.nav-links.open{display:flex}.nav-social{border-left:0;padding-left:0;margin-left:0}.mobile-menu-btn{display:block}.footer-inner{grid-template-columns:1fr 1fr}.page-head{padding-top:100px}article.post{padding-top:96px}.post-body{font-size:1rem}}
@media (max-width:480px){.footer-inner{grid-template-columns:1fr}.post-grid,.cat-list,.author-list{grid-template-columns:1fr}}
`;

// aria-current="page" only on /blog itself; every other blog page just keeps
// the "Blog" item visually active (the breadcrumb names the real current page).
const navHtml = (isBlogIndex) => `
<nav class="navbar" aria-label="Primary">
  <div class="navbar-inner">
    <a href="/" class="nav-logo"><img decoding="async" width="36" height="36" src="/assets/icon-512.webp" alt=""><span>drivesight</span></a>
    <div class="nav-links" id="navLinks">
      <a href="/#features">Features</a>
      <a href="/accessories">Accessories</a>
      <a href="${BLOG_PREFIX}" class="active"${isBlogIndex ? ' aria-current="page"' : ''}>Blog</a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
      <div class="nav-social" role="group" aria-label="Social links">
        <a href="https://www.youtube.com/channel/UCXXPeHZfHXEimNK9xC6t31g" target="_blank" rel="noopener" aria-label="DriveSight on YouTube" title="YouTube"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z"/></svg></a>
        <a href="https://www.tiktok.com/@drivesight3" target="_blank" rel="noopener" aria-label="DriveSight on TikTok" title="TikTok"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></a>
        <a href="https://www.instagram.com/drivesightapp" target="_blank" rel="noopener" aria-label="DriveSight on Instagram" title="Instagram"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="0.6" fill="currentColor"/></svg></a>
        <a href="https://x.com/drivesightapp" target="_blank" rel="noopener" aria-label="DriveSight on X" title="X"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
      </div>
      <a href="${PLAY_URL}" class="nav-cta" target="_blank" rel="noopener">Download</a>
    </div>
    <button class="mobile-menu-btn" type="button" aria-controls="navLinks" aria-expanded="false" aria-label="Menu">☰</button>
  </div>
</nav>`;

const FOOTER = `
<footer>
  <div class="footer-inner">
    <div class="footer-brand">
      <div class="nav-logo"><img decoding="async" width="32" height="32" src="/assets/icon-512.webp" alt="" style="width:32px;height:32px;border-radius:6px" loading="lazy"><span>drivesight</span></div>
      <p>The smartest AI dash cam app on Android. Parking mode, crash detection, cloud backup, and 336,000+ camera alerts. Built by Cyberlab Automation.</p>
    </div>
    <div class="footer-col"><p class="footer-col-head">Product</p><a href="/#features">App Features</a><a href="/police-aircraft-tracker-app">Police Aircraft Tracker</a><a href="/accessories">Accessories &amp; Mounts</a></div>
    <div class="footer-col"><p class="footer-col-head">Blog</p><a href="${BLOG_PREFIX}">Latest posts</a><a href="${routePath('category')}">Categories</a><a href="${routePath('author')}">Authors</a><a href="${ARCHIVE_PATH}">Guide archive</a><a href="${RSS_PATH}">RSS feed</a></div>
    <div class="footer-col"><p class="footer-col-head">Company</p><a href="/about">About Us</a><a href="/contact">Contact Us</a><a href="https://www.youtube.com/channel/UCXXPeHZfHXEimNK9xC6t31g" target="_blank" rel="noopener">YouTube Channel</a><a href="https://www.tiktok.com/@drivesight3" target="_blank" rel="noopener">TikTok</a><a href="https://www.instagram.com/drivesightapp" target="_blank" rel="noopener">Instagram</a><a href="https://x.com/drivesightapp" target="_blank" rel="noopener">X (Twitter)</a><a href="/privacy-policy.html">Privacy &amp; Data</a><a href="/terms">Terms of Service</a></div>
    <div class="footer-col"><p class="footer-col-head">Download</p><a href="${PLAY_URL}" target="_blank" rel="noopener">Google Play Store</a></div>
    <div class="footer-col"><p class="footer-col-head">Language</p><a href="/" hreflang="en">English</a><a href="/de/" hreflang="de">Deutsch</a><a href="/nl/" hreflang="nl">Nederlands</a><a href="/ru/" hreflang="ru">Русский</a></div>
  </div>
  <div class="footer-bottom">
    <span>&copy; ${new Date().getUTCFullYear()} Cyberlab Automation. All rights reserved.</span>
    <span><a href="/privacy-policy.html">Privacy Policy</a> &middot; <a href="/terms">Terms</a> &middot; <a href="/contact">Get in Touch</a></span>
  </div>
</footer>`;

// Small progressive enhancements: menu toggle, "Loading…" state on pager links.
const ENHANCE_JS = `
(function(){
  var btn=document.querySelector('.mobile-menu-btn'),links=document.getElementById('navLinks');
  if(btn&&links){btn.addEventListener('click',function(){var open=links.classList.toggle('open');btn.setAttribute('aria-expanded',open?'true':'false');});}
  document.querySelectorAll('.pager a').forEach(function(a){a.addEventListener('click',function(){a.setAttribute('aria-busy','true');a.dataset.label=a.textContent;a.textContent='Loading…';});});
  window.addEventListener('pageshow',function(){document.querySelectorAll('.pager a[aria-busy]').forEach(function(a){a.removeAttribute('aria-busy');if(a.dataset.label)a.textContent=a.dataset.label;});});
})();`;

export function shell({ head, body, jsonLd = [], isBlogIndex = false }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Opinly analytics: public write-only key, safe in HTML -->
<script async src="${PIXEL_SRC}" data-key="${PIXEL_KEY}"></script>
<script defer src="${EVENTS_SCRIPT}"></script>
${head}
<meta name="theme-color" content="#121317">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon-192.png">
<link rel="apple-touch-icon" href="/assets/favicon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.opinly.ai">
<link href="${FONTS_HREF}" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="${FONTS_HREF}" rel="stylesheet"></noscript>
<style>${CSS}</style>
${jsonLd.filter(Boolean).map(jsonLdScript).join('\n')}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${navHtml(isBlogIndex)}
<main id="main" tabindex="-1">
${body}
</main>
${FOOTER}
<script>${ENHANCE_JS}</script>
</body>
</html>`;
}

// ---------- shared fragments ----------

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function isoAttr(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

function timeTag(iso, prefix = '') {
  const text = fmtDate(iso);
  return text ? `${prefix}<time datetime="${isoAttr(iso)}">${text}</time>` : '';
}

function avatar(fileKey, name, cls = 'avatar') {
  const src = imageUrl(fileKey);
  if (!src) return `<span class="${cls}" aria-hidden="true"></span>`;
  return `<img class="${cls}" src="${escapeHtml(src)}" alt="" width="26" height="26" loading="lazy" decoding="async">`;
}

const PLACEHOLDER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M7 6l1.5-2h7L17 6"/></svg>';

export function postCard(post, headingTag = 'h2') {
  const href = routePath('post', post.slug);
  const img = imageUrl(post.image?.fileKey);
  const thumb = img
    ? `<div class="thumb"><img src="${escapeHtml(img)}" alt="${escapeHtml(post.image?.alt || '')}" loading="lazy" decoding="async" width="640" height="360"></div>`
    : `<div class="thumb placeholder" aria-hidden="true">${PLACEHOLDER_SVG}</div>`;
  const cat = post.category ? `<span class="cat">${escapeHtml(post.category.name)}</span>` : '';
  const who = post.author ? `${avatar(post.author.fileKey ?? post.author.image?.fileKey, post.author.name)}<span>${escapeHtml(post.author.name)}</span>` : '';
  return `<li class="post-card">
  ${thumb}
  <div class="body">
    ${cat}
    <${headingTag}><a href="${escapeHtml(href)}">${escapeHtml(post.title)}</a></${headingTag}>
    ${post.description ? `<p>${escapeHtml(post.description)}</p>` : ''}
    <div class="meta">${who}${who ? '<span aria-hidden="true">·</span>' : ''}${timeTag(post.firstPublishedAt)}</div>
  </div>
</li>`;
}

export function postGrid(posts, headingTag = 'h2') {
  return `<ul class="post-grid">${posts.map((p) => postCard(p, headingTag)).join('\n')}</ul>`;
}

export function emptyState({ title = 'No posts yet', text = 'New articles land here as soon as they are published.', showArchive = true } = {}) {
  return `<section class="notice" aria-live="polite">
  <h2>${escapeHtml(title)}</h2>
  <p>${escapeHtml(text)}</p>
  ${showArchive ? `<a class="btn" href="${ARCHIVE_PATH}">Browse the guide archive</a>` : `<a class="btn" href="${BLOG_PREFIX}">Back to the blog</a>`}
</section>`;
}

export function pager({ basePath, params = {}, cursor, hasMore, nextCursor }) {
  const build = (extra) => {
    const u = new URL(basePath, SITE_URL);
    Object.entries({ ...params, ...extra }).forEach(([k, v]) => { if (v) u.searchParams.set(k, v); });
    return u.pathname + u.search;
  };
  const older = hasMore && nextCursor ? `<a class="btn" href="${escapeHtml(build({ cursor: nextCursor }))}" rel="next">Older posts →</a>` : '<span></span>';
  const newer = cursor ? `<a class="btn" href="${escapeHtml(build({ cursor: '' }))}">← Back to newest</a>` : '<span></span>';
  if (!hasMore && !cursor) return '';
  return `<nav class="pager" aria-label="Pagination">${newer}${older}</nav>`;
}

export function breadcrumbs(items) {
  const last = items.length - 1;
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${items.map((it, i) => (
    i === last
      ? `<li><span aria-current="page">${escapeHtml(it.name)}</span></li>`
      : `<li><a href="${escapeHtml(it.url)}">${escapeHtml(it.name)}</a></li>`
  )).join('')}</ol></nav>`;
}

const HOME_CRUMB = { name: 'Home', url: '/' };
const BLOG_CRUMB = { name: 'Blog', url: BLOG_PREFIX };

// ---------- pages ----------

export function indexPage({ posts, hasMore, nextCursor, cursor, sort, categories = [], activeCategory = null }) {
  const canonical = absUrl(BLOG_PREFIX);
  const chips = [{ slug: '', title: 'All posts' }, ...categories.map((c) => ({ slug: c.slug, title: c.title }))];
  const chipHtml = chips.length > 1 ? `<ul class="chips" aria-label="Categories">${chips.map((c) => {
    const href = c.slug ? routePath('category', c.slug) : BLOG_PREFIX;
    const current = (c.slug || null) === activeCategory ? ' aria-current="page"' : '';
    return `<li><a class="chip" href="${escapeHtml(href)}"${current}>${escapeHtml(c.title)}</a></li>`;
  }).join('')}</ul>` : '<span></span>';
  const sortHtml = `<div class="sort" role="group" aria-label="Sort order">
    <a href="${BLOG_PREFIX}"${sort !== 'oldest' ? ' aria-current="page"' : ''}>Newest</a>
    <a href="${BLOG_PREFIX}?sort=oldest"${sort === 'oldest' ? ' aria-current="page"' : ''}>Oldest</a>
  </div>`;
  const body = `
<div class="wrap">
  <header class="page-head">
    ${breadcrumbs([HOME_CRUMB, { name: 'Blog' }])}
    <p class="eyebrow">DriveSight Blog</p>
    <h1>Dashcam guides, driving safety, and app updates</h1>
    <p class="lede">Practical articles on turning an Android phone into a dash cam, parking mode, camera alerts, and getting the most out of DriveSight.</p>
  </header>
  <div class="toolbar">${chipHtml}${sortHtml}</div>
  ${posts.length ? postGrid(posts) : emptyState()}
  ${pager({ basePath: BLOG_PREFIX, params: { sort: sort === 'oldest' ? 'oldest' : '' }, cursor, hasMore, nextCursor })}
  <p class="archive-callout">Looking for the earlier DriveSight guides? <a href="${ARCHIVE_PATH}">Browse the full guide archive</a> or subscribe via <a href="${RSS_PATH}">RSS</a>.</p>
</div>`;
  // Cursor pages: noindex + a SELF canonical (pointing later pages at page 1
  // is the mixed signal Google's pagination guidance warns against).
  const sortQs = sort === 'oldest' ? '&sort=oldest' : '';
  const selfUrl = cursor ? absUrl(`${BLOG_PREFIX}?cursor=${encodeURIComponent(cursor)}${sortQs}`) : canonical;
  return shell({
    head: metaTags({
      title: 'Blog',
      description: 'Dashcam guides, driving safety tips, and DriveSight product updates from the Cyberlab Automation team.',
      canonical: selfUrl,
      noindex: Boolean(cursor),
      nextUrl: hasMore && nextCursor ? absUrl(`${BLOG_PREFIX}?cursor=${encodeURIComponent(nextCursor)}${sortQs}`) : undefined,
    }),
    body,
    jsonLd: [blogJsonLd({ posts }), breadcrumbJsonLd([HOME_CRUMB, BLOG_CRUMB])],
    isBlogIndex: !cursor && sort !== 'oldest',
  });
}

export function postPage({ post, rendered, related = [] }) {
  const url = absUrl(routePath('post', post.slug));
  const hero = post.titleFile?.fileKey ? imageUrl(post.titleFile.fileKey) : null;
  const heroAlt = post.titleFile?.altText || post.title;
  const published = post.firstPublishedAt;
  const modified = post.modifiedAt;
  const showUpdated = published && modified && (new Date(modified) - new Date(published)) > 86400000;
  const minutes = Math.max(1, Math.round(rendered.words / 220));
  const crumbs = [HOME_CRUMB, BLOG_CRUMB];
  if (post.category) crumbs.push({ name: post.category.name, url: routePath('category', post.category.slug) });
  crumbs.push({ name: post.title, url: routePath('post', post.slug) });

  const toc = rendered.headings.filter((h) => h.level <= 3).length >= 3
    ? `<details class="toc" open><summary>On this page</summary><ol>${rendered.headings.filter((h) => h.level <= 3).map((h) => `<li class="lvl-${h.level}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`).join('')}</ol></details>`
    : '';
  const faqs = (post.faqs || []).filter((f) => f?.question && f?.answer);
  const faqHtml = faqs.length ? `<section class="faq" aria-labelledby="faq-heading"><h2 id="faq-heading">Frequently asked questions</h2>${faqs.map((f) => `<details><summary>${escapeHtml(f.question)}</summary><div class="answer">${escapeHtml(f.answer)}</div></details>`).join('')}</section>` : '';
  const tags = post.tags?.length ? `<ul class="tag-list" aria-label="Tags">${post.tags.map((t) => `<li><a class="chip" href="${escapeHtml(routePath('tag', t.slug))}">#${escapeHtml(t.name)}</a></li>`).join('')}</ul>` : '';
  const authorCard = post.author ? `<aside class="author-card" aria-label="About the author">
    ${avatar(post.author.fileKey, post.author.name, 'avatar lg')}
    <div><h2>${escapeHtml(post.author.name)}</h2>${post.author.bio ? `<p>${escapeHtml(post.author.bio)}</p>` : ''}<a class="more" href="${escapeHtml(routePath('author', post.author.slug))}">More from ${escapeHtml(post.author.name)} →</a></div>
  </aside>` : '';
  const relatedHtml = related.length ? `<section class="related wrap" aria-labelledby="related-heading"><h2 id="related-heading">More in ${escapeHtml(post.category?.name || 'the blog')}</h2>${postGrid(related, 'h3')}</section>` : '';

  const body = `
<article class="post" data-opinly-post="${escapeHtml(post.slug)}"${post.category ? ` data-opinly-category="${escapeHtml(post.category.slug)}"` : ''}>
  <div class="wrap">
    <header class="post-header">
      ${breadcrumbs(crumbs)}
      ${post.category ? `<a class="eyebrow" href="${escapeHtml(routePath('category', post.category.slug))}">${escapeHtml(post.category.name)}</a>` : ''}
      <h1>${escapeHtml(post.title)}</h1>
      ${post.description ? `<p class="lede">${escapeHtml(post.description)}</p>` : ''}
      <div class="post-meta">
        ${post.author ? `<a class="who" href="${escapeHtml(routePath('author', post.author.slug))}">${avatar(post.author.fileKey, post.author.name)}${escapeHtml(post.author.name)}</a>` : ''}
        ${timeTag(published, '<span>Published </span>')}
        ${showUpdated ? timeTag(modified, '<span>Updated </span>') : ''}
        <span>${minutes} min read</span>
      </div>
    </header>
    ${hero ? `<figure class="post-hero"><img src="${escapeHtml(hero)}" alt="${escapeHtml(heroAlt)}" width="1200" height="675" fetchpriority="high" decoding="async">${post.titleFile?.caption ? `<figcaption>${escapeHtml(post.titleFile.caption)}</figcaption>` : ''}</figure>` : ''}
    <div class="post-layout">
      ${toc}
      <div class="post-body">${rendered.html || '<p>This post has no content yet.</p>'}</div>
      ${faqHtml}
      ${tags}
      ${authorCard}
      <aside class="cta-card" aria-label="Download DriveSight">
        <div><h2>Turn your phone into a dash cam</h2><p>DriveSight records your drives, watches your parked car, and warns you about speed cameras and police aircraft. Free on Google Play.</p></div>
        <a class="btn primary" href="${PLAY_URL}" target="_blank" rel="noopener">Get DriveSight</a>
      </aside>
    </div>
  </div>
  ${relatedHtml}
</article>`;

  return shell({
    head: metaTags({
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.description,
      canonical: url,
      ogType: 'article',
      ogImage: hero || DEFAULT_OG_IMAGE,
      ogImageAlt: hero ? heroAlt : undefined,
      publishedTime: published,
      modifiedTime: modified,
      authorUrl: post.author?.slug ? absUrl(routePath('author', post.author.slug)) : undefined,
      tags: (post.tags || []).map((t) => t.name),
    }),
    body,
    jsonLd: [
      blogPostingJsonLd(post, { wordCount: rendered.words }),
      breadcrumbJsonLd(crumbs),
      faqJsonLd(faqs),
    ],
  });
}

function listingPage({ crumbs, eyebrow, title, description, posts, hasMore, nextCursor, cursor, basePath, canonical, jsonLd, extraHeader = '' }) {
  const body = `
<div class="wrap">
  <header class="page-head">
    ${breadcrumbs(crumbs)}
    ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
    ${extraHeader || `<h1>${escapeHtml(title)}</h1>`}
    ${description ? `<p class="lede">${escapeHtml(description)}</p>` : ''}
  </header>
  ${posts.length ? postGrid(posts) : emptyState({ title: 'Nothing here yet', text: 'No published posts match this page yet.', showArchive: false })}
  ${pager({ basePath, cursor, hasMore, nextCursor })}
</div>`;
  return shell({
    head: metaTags({
      title,
      description,
      canonical: cursor ? absUrl(`${basePath}?cursor=${encodeURIComponent(cursor)}`) : canonical,
      noindex: Boolean(cursor),
      nextUrl: hasMore && nextCursor ? absUrl(`${basePath}?cursor=${encodeURIComponent(nextCursor)}`) : undefined,
    }),
    body,
    jsonLd,
  });
}

export function categoryPage({ category, posts, hasMore, nextCursor, cursor }) {
  const path = routePath('category', category.slug);
  const canonical = absUrl(path);
  const crumbs = [HOME_CRUMB, BLOG_CRUMB, { name: 'Categories', url: routePath('category') }, { name: category.title, url: path }];
  return listingPage({
    crumbs,
    eyebrow: 'Category',
    title: category.title,
    description: category.description || `Every DriveSight post filed under ${category.title}.`,
    posts, hasMore, nextCursor, cursor,
    basePath: path,
    canonical,
    jsonLd: [
      collectionPageJsonLd({ name: category.title, description: category.description, url: canonical, posts }),
      breadcrumbJsonLd(crumbs),
    ],
  });
}

export function tagPage({ tag, posts, hasMore, nextCursor, cursor }) {
  const path = routePath('tag', tag.slug);
  const canonical = absUrl(path);
  const crumbs = [HOME_CRUMB, BLOG_CRUMB, { name: `#${tag.name}`, url: path }];
  return listingPage({
    crumbs,
    eyebrow: 'Tag',
    title: `#${tag.name}`,
    description: tag.description || `Posts tagged ${tag.name}.`,
    posts, hasMore, nextCursor, cursor,
    basePath: path,
    canonical,
    jsonLd: [collectionPageJsonLd({ name: `#${tag.name}`, description: tag.description, url: canonical, posts }), breadcrumbJsonLd(crumbs)],
  });
}

export function categoriesPage({ categories }) {
  const path = routePath('category');
  const canonical = absUrl(path);
  const crumbs = [HOME_CRUMB, BLOG_CRUMB, { name: 'Categories', url: path }];
  const list = categories.length ? `<ul class="cat-list">${categories.map((c) => `<li class="cat-card">
    <h2><a href="${escapeHtml(routePath('category', c.slug))}">${escapeHtml(c.title)}</a></h2>
    ${c.description ? `<p>${escapeHtml(c.description)}</p>` : ''}
    ${c.posts?.length ? `<ul aria-label="Latest in ${escapeHtml(c.title)}">${c.posts.slice(0, 5).map((p) => `<li><a href="${escapeHtml(routePath('post', p.slug))}">${escapeHtml(p.title)}</a></li>`).join('')}</ul>` : ''}
  </li>`).join('')}</ul>` : emptyState({ title: 'No categories yet', text: 'Categories appear once posts are filed under them.', showArchive: false });
  const body = `<div class="wrap"><header class="page-head">${breadcrumbs(crumbs)}<p class="eyebrow">Browse by topic</p><h1>Categories</h1><p class="lede">Every DriveSight article, grouped by what it covers.</p></header>${list}</div>`;
  return shell({
    head: metaTags({ title: 'Blog categories', description: 'Browse DriveSight blog posts by topic.', canonical }),
    body,
    jsonLd: [breadcrumbJsonLd(crumbs)],
  });
}

export function authorsPage({ authors }) {
  const path = routePath('author');
  const canonical = absUrl(path);
  const crumbs = [HOME_CRUMB, BLOG_CRUMB, { name: 'Authors', url: path }];
  const list = authors.length ? `<ul class="author-list">${authors.map((a) => `<li class="author-item">
    <header>${avatar(a.image?.fileKey ?? a.fileKey, a.name, 'avatar lg')}<h2><a href="${escapeHtml(routePath('author', a.slug))}">${escapeHtml(a.name)}</a></h2></header>
    ${a.bio ? `<p>${escapeHtml(a.bio)}</p>` : ''}
    ${a.posts?.length ? `<ul aria-label="Latest by ${escapeHtml(a.name)}">${a.posts.slice(0, 5).map((p) => `<li><a href="${escapeHtml(routePath('post', p.slug))}">${escapeHtml(p.title)}</a></li>`).join('')}</ul>` : ''}
  </li>`).join('')}</ul>` : emptyState({ title: 'No authors yet', text: 'Authors appear here once they have published a post.', showArchive: false });
  const body = `<div class="wrap"><header class="page-head">${breadcrumbs(crumbs)}<p class="eyebrow">The people behind the posts</p><h1>Authors</h1></header>${list}</div>`;
  return shell({
    head: metaTags({ title: 'Blog authors', description: 'Writers contributing to the DriveSight blog.', canonical }),
    body,
    jsonLd: [breadcrumbJsonLd(crumbs)],
  });
}

export function authorPage({ author }) {
  const path = routePath('author', author.slug);
  const canonical = absUrl(path);
  const crumbs = [HOME_CRUMB, BLOG_CRUMB, { name: 'Authors', url: routePath('author') }, { name: author.name, url: path }];
  const posts = author.posts || [];
  const header = `<div class="profile">${avatar(author.image?.fileKey ?? author.fileKey, author.name, 'avatar lg')}<h1>${escapeHtml(author.name)}</h1></div>`;
  const person = personJsonLd({ ...author, fileKey: author.image?.fileKey ?? author.fileKey });
  return listingPage({
    crumbs,
    eyebrow: 'Author',
    title: author.name,
    description: author.bio || `Posts by ${author.name} on the DriveSight blog.`,
    posts,
    hasMore: false,
    nextCursor: null,
    cursor: '',
    basePath: path,
    canonical,
    extraHeader: header,
    jsonLd: [person, collectionPageJsonLd({ name: `Posts by ${author.name}`, url: canonical, posts }), breadcrumbJsonLd(crumbs)],
  });
}

export function notFoundPage({ what = 'page' } = {}) {
  const body = `<div class="wrap"><header class="page-head">${breadcrumbs([HOME_CRUMB, BLOG_CRUMB, { name: 'Not found' }])}<p class="eyebrow">404</p><h1>That ${escapeHtml(what)} isn't here</h1><p class="lede">It may have been unpublished or moved. The latest posts are one click away.</p></header>
  <section class="notice"><h2>Keep reading</h2><p>Head back to the blog index, or search the guide archive for older articles.</p><a class="btn primary" href="${BLOG_PREFIX}">Latest posts</a> <a class="btn" href="${ARCHIVE_PATH}">Guide archive</a></section></div>`;
  return shell({
    head: metaTags({ title: 'Not found', description: 'The page you were looking for does not exist.', canonical: undefined, noindex: true }),
    body,
  });
}

export function errorPage({ status = 503, requestId = null } = {}) {
  const body = `<div class="wrap"><header class="page-head">${breadcrumbs([HOME_CRUMB, BLOG_CRUMB, { name: 'Unavailable' }])}<p class="eyebrow">${status}</p><h1>The blog is taking a short break</h1><p class="lede">We couldn't load posts just now. This is usually temporary.</p></header>
  <section class="notice error" role="alert"><h2>Try again in a moment</h2><p>Refresh the page, or browse the guide archive while we reconnect.</p><a class="btn primary" href="${BLOG_PREFIX}">Retry</a> <a class="btn" href="${ARCHIVE_PATH}">Guide archive</a>${requestId ? `<p class="code">Request ID: ${escapeHtml(requestId)}</p>` : ''}</section></div>`;
  return shell({
    head: metaTags({ title: 'Blog temporarily unavailable', description: 'The DriveSight blog is temporarily unavailable.', noindex: true }),
    body,
  });
}

export function notConfiguredPage() {
  const body = `<div class="wrap"><header class="page-head"><p class="eyebrow">Setup</p><h1>Blog not configured</h1><p class="lede">The Worker has no <code>OPINLY_API_KEY</code> secret. Add it in Cloudflare → Workers → drivesight-website → Settings → Variables and Secrets, then redeploy.</p></header></div>`;
  return shell({ head: metaTags({ title: 'Blog not configured', noindex: true }), body });
}
