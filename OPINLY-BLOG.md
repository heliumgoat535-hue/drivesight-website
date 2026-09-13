# Opinly blog integration

phonedashcam.com serves its blog from the Opinly content API, rendered at the
edge by the Cloudflare Worker in `redirect-worker.js` (code in `src/opinly/`).
There is no build step and no npm dependency: Workers Builds bundles the
`src/` imports when it deploys the worker.

## URLs

| Path | Source | Notes |
| --- | --- | --- |
| `/blog` | `GET /v1/content/posts` | index, `?cursor=` pagination, `?sort=oldest` |
| `/blog/<slug>` | `GET /v1/content/post?slug=` | post page, 404 page when missing |
| `/blog/category` | `GET /v1/content/categories` | category directory |
| `/blog/category/<slug>` | `posts?category=` | category archive |
| `/blog/authors` | `GET /v1/content/authors` | author directory |
| `/blog/authors/<slug>` | `GET /v1/content/authors/{slug}` | author page |
| `/blog/tag/<slug>` | `posts?tag=` | tag archive |
| `/blog/rss.xml` | `GET /v1/content/rss` | RSS 2.0 |
| `/sitemap.xml` | static file + `GET /v1/content/routes` | merged at request time |
| `/blog-archive` | `blog.html` | the pre-Opinly static guide index |
| `/api/opinly-webhook` | Svix-signed POST | cache invalidation |
| `/api/opinly/purchase` | bearer-gated POST | server-side purchase → Opinly |

`src/opinly/config.js` → `routePath()` is the one mapping from Opinly entity
types to these paths. Pages, sitemap, RSS and the webhook all use it.

## Secrets and variables

Set in Cloudflare → Workers & Pages → drivesight-website → Settings →
Variables and Secrets (or `wrangler secret put NAME`). **Set the API key before
pushing** — until it exists `/blog` answers 503 "Blog not configured".

| Name | Required | Purpose |
| --- | --- | --- |
| `OPINLY_API_KEY` | yes | `sk-…` content key. Server-side only. |
| `OPINLY_WEBHOOK_SIGNING_SECRET` | yes for webhook | `whsec_…` from Opinly Settings → Developers |
| `CF_ZONE_ID`, `CF_PURGE_TOKEN` | optional | zone-wide purge of changed URLs on webhook (token scope: Zone → Cache Purge) |
| `OPINLY_PURCHASE_INGEST_TOKEN` | optional | enables `/api/opinly/purchase` |
| `OPINLY_API_URL` | no | `[vars]` in wrangler.toml, defaults to `https://sdk.opinly.ai` |

Local dev reads the same names from `.dev.vars` (gitignored).

## Webhook

In Opinly → Settings → Developers add an endpoint for
`https://phonedashcam.com/api/opinly-webhook` subscribed to
`content.routes-changed`, and store its signing secret as
`OPINLY_WEBHOOK_SIGNING_SECRET`.

The handler verifies the Svix signature (HMAC-SHA256 over
`id.timestamp.body`, 5-minute tolerance, WebCrypto constant-time compare),
answers 400 on a bad signature, and on success drops the API responses that
the change touches plus the always-shared ones (list first pages, routes,
categories, authors, tags, RSS). Cache API deletes only apply in the data
centre that receives the webhook; with `CF_ZONE_ID`/`CF_PURGE_TOKEN` it also
purges the page URLs and cache keys zone-wide. Without them, other locations
age out on the TTLs below.

For a `post` entry the handler also reads the cached copy of that post before
deleting it and invalidates its category, tag, and author lists (the payload
does not name them).

Cache TTLs (`src/opinly/client.js`): lists 5 min, posts 60 min, everything else
10 min. Entries are kept for 24 h and served stale if Opinly is unreachable.

## Content Security Policy

The live CSP is a Cloudflare **zone rule**, not the worker. Until it is edited,
the browser blocks the pixel. Add `https://static.opinly.ai` to `script-src`,
`script-src-elem`, and `connect-src` in dash → phonedashcam.com → Rules →
Transform Rules (Modify Response Header). `img-src https:` already allows
`cdn.opinly.ai`. The CSP string in `redirect-worker.js` is kept in sync as the
reference copy.

## Analytics

Every HTML page except `viewer/index.html` carries the pixel
(`static.opinly.ai/p.js` with the public `pk-` key) plus
`assets/opinly-events.js`. The viewer is the private remote-viewer app and
keeps a session secret in the page, so it gets no third-party script; remove
`viewer` from `SKIP_DIRS` in the injector to change that. The events script
sends:

- `play_store_click` on every Google Play link (custom event, aggregated)
- `generate_lead` when the contact form submits (standard conversion event)
- `blog_post_read` when a reader reaches the end of a post body

and exposes `window.driveSightAnalytics` with `identify(email, userId)`,
`track(event, props, opts)`, `purchase(orderId, value, currency)` and
`anonId()`. Emails typed into the contact form are identified by the pixel
itself. Server-side purchases: POST JSON
`{ orderId, value, currency, email?, anonId? }` to `/api/opinly/purchase` with
`Authorization: Bearer <OPINLY_PURCHASE_INGEST_TOKEN>`; send the same
`orderId` from the browser (`driveSightAnalytics.purchase`) and the two merge.

## Local development

```
npm test                       # unit + router tests (node --test, no deps)
node scripts/mock-opinly.mjs   # fixture API on :8790 (test/fixtures/opinly.mjs)
npm run dev                    # wrangler dev on :8787 (needs .dev.vars)
node scripts/inject-opinly-pixel.mjs   # re-run after adding new static pages
```

`wrangler dev` with `assets.directory = "."` reload-loops on its own
`.wrangler/` output; run it from a directory outside the repo with a dev
`wrangler.toml` pointing `main` and `assets.directory` at absolute paths
(the `blog-worker` launch config does this).
