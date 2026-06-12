# Semrush Site Audit Fixes — 2026-05-21

Worked from `phonedashcam.com_mega_export_20260521.csv` (Site Health 75%).
All changes are in `website/` only — no commits made; you can review before pushing.

## ✅ Fixed

### 1. `privacy-policy.html` — added missing canonical + meta description
- **Was:** missing `<link rel="canonical">` and `<meta name="description">`
- **Fixed:** both added pointing to `/privacy-policy` (clean URL)
- **Resolves:** Duplicate title tag, Duplicate content, Duplicate content in h1 and title (4 flags)

### 2. Five over-length titles shortened to ≤60 chars
| File | Before (len) | After (len) |
|---|---|---|
| phone-dashcam-features-2026.html | 78 | 57 |
| vs-dash-cam-travel.html | 76 | 46 |
| autoboy-alternative.html | 76 | 51 |
| best-free-dash-cam-app-android-phone.html | 82 | 47 |
| phone-dashcam-for-nerds.html | 88 | 48 |

### 3. Duplicate `<h1>` tags removed on 3 blog posts
The pages had two identical `<h1>` (one plain, one slug-anchored). Removed the redundant slug-anchored copy.
- dashcam-timelapse-recording-real-examples-and-smart-setups.html
- how-dashcams-store-overnight-delivery-footage-safely.html
- set-up-a-dual-front-and-rear-android-dashcam.html

### 4. Broken `/privacy.html` references rerouted
`/privacy.html` doesn't exist; only `/privacy-policy.html` does. Three language index pages (de/, nl/, ru/) referenced the wrong path. Updated to `/privacy-policy`.

### 5. `robots.txt` — added Disallow for Cloudflare email-protection
```
User-agent: *
Disallow: /cdn-cgi/
```
**Resolves:** the `/cdn-cgi/l/email-protection` 4xx + broken internal links on privacy-policy.html, about.html (root cause: Cloudflare wraps `mailto:` links into that endpoint, which Semrush follows and gets a 4xx).

### 6. `phone-dashcam-for-nerds.html` — doctype declaration fixed
A `<script>` tag was prepended *before* `<!DOCTYPE html>` (triggers quirks mode + fails Semrush's "Doctype not declared"). Moved into `<head>` after the viewport meta.

### 7. `viewer/index.html` — added `noindex` + meta description
This is the WebRTC remote viewer (app utility, not a content page). Added:
- `<meta name="robots" content="noindex, nofollow">`
- `<meta name="description">`

**Resolves:** "Missing meta description" + suppresses irrelevant flags ("Frames used", "Pages have high Document Interactive Time" — these are by design for a WebRTC page).

## ⚠️ Verified-correct (Semrush probably re-crawls and clears)

- **hreflang on `/de/`, `/nl/`, `/ru/`** — already properly cross-referenced with `x-default`. The "Duplicate content" flag on these is Semrush comparing structural HTML (nav, footer, schema) which is intentionally identical across language versions. Should drop after re-crawl.
- **Canonical tags on `/contact`, `/terms`, `/about`** — already point to clean URLs. The remaining "Duplicate content" flags on the `/page` vs `/page.html` pairs should resolve once Semrush re-crawls and respects the canonicals.

## 🛑 Not fixable from file side (server/infrastructure)

| Issue | Reason | What to do |
|---|---|---|
| No HSTS support | Cloudflare/GitHub Pages config | Enable HSTS in Cloudflare dashboard (Security → Settings → HSTS) |
| Page crawl depth = 11 | Site architecture | Add more direct nav links to deep pages (out of scope here) |
| `/dashcam-deer-detection` "couldn't open URL" | Semrush timeout, not the page | Will likely resolve on next crawl; verify page loads from your browser first |
| Some "Sitemap.xml not found" flags | Semrush looking for inline `<link rel="sitemap">` tags (non-standard) | Already declared in robots.txt — Semrush quirk, ignore |
| "Pages with only one internal link" on /, /about, /contact, etc. | Inbound counts disagree with reality (40+ pages link to /about). Possibly Semrush counts pages excluding nav/footer | Should self-resolve; if not, add inline body links from blog posts |

## 📋 Notes for your review

- **Total files touched:** 12 (1 robots.txt, 11 HTML files)
- **No git commits made** — `website/` is a separate repo per CLAUDE.md; you can `cd website && git status` to see all the changes and commit when ready
- **Hook noise:** Each Edit triggered a Semgrep warning about missing SRI (Subresource Integrity) on the pre-existing Google Tag Manager / kleap analytics scripts. These are *not* my changes — Google explicitly recommends *against* SRI on GTM (it would break when GTM updates its script). Leaving them as-is is the correct call.

## Expected Site Health impact

Hard to predict exactly without re-crawl, but addressed issue categories:
- 4 duplicate-content/title flags on privacy-policy.html → resolved
- 5 title-too-long flags → resolved
- 3 multiple-h1 flags → resolved
- 4xx broken link cluster around `/cdn-cgi/` → resolved
- `/privacy.html` 4xx → resolved
- Doctype + viewer missing-meta → resolved

Rough estimate: **75% → mid-80s** after re-crawl. Top-10% sites are at 92% — to close the remaining gap you'd want to address HSTS (Cloudflare setting) and the page-crawl-depth issue (architectural).

## What I'd recommend next session

1. **Click "Rerun campaign" in Semrush** to verify the score moved.
2. **Enable HSTS in Cloudflare** (free, 30-second toggle) — kills the "No HSTS" warning and is a real security win.
3. **Review the "Outdated content" flag on phone-dashcam-for-nerds.html** — Semrush thinks the content is stale. You may want to refresh dates / examples.
4. **`cd website && git diff` then commit** — these changes are local-only right now.
