// phonedashcam.com edge worker (Workers Static Assets + these handlers):
//   - bot-UA block, internal-file 404s
//   - /api/turn TURN-credential proxy for the viewer
//   - Opinly blog: /blog/*, /sitemap.xml, /blog/rss.xml, /api/opinly-webhook,
//     /api/opinly/purchase (see src/opinly/)
//   - HeyCatch single-character short links
//   - security headers on every HTML response
//
// Static assets are served last via env.ASSETS.fetch; the platform ignores
// Pages-style _redirects/_headers here, which is why redirects live in code.
import { handleOpinlyRequest } from "./src/opinly/router.js";

// NOTE: the live CSP on phonedashcam.com comes from a Cloudflare zone rule
// (Rules → Transform Rules → Modify Response Header) that overwrites whatever
// this worker sets. Keep this string in sync with that rule — it is the source
// of truth for what the site needs — but editing it here alone changes nothing
// in production. Opinly needs static.opinly.ai in script-src, script-src-elem
// and connect-src; cdn.opinly.ai is already covered by img-src https:.
const OPINLY_SCRIPT = "https://static.opinly.ai";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${OPINLY_SCRIPT} https://esm.sh https://in.heycatch.ai https://www.gstatic.com https://analytics-v2.kleap.co https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.googleadservices.com https://*.doubleclick.net https://us.posthog.com https://us.i.posthog.com https://*.i.posthog.com https://static.cloudflareinsights.com https://*.adtrafficquality.google`,
  `script-src-elem 'self' 'unsafe-inline' ${OPINLY_SCRIPT} https://esm.sh https://in.heycatch.ai https://www.gstatic.com https://analytics-v2.kleap.co https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.googleadservices.com https://*.doubleclick.net https://us.posthog.com https://us.i.posthog.com https://*.i.posthog.com https://static.cloudflareinsights.com https://*.adtrafficquality.google`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${OPINLY_SCRIPT} https://esm.sh https://in.heycatch.ai https://*.googleapis.com wss://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://www.google-analytics.com https://*.google-analytics.com https://*.googletagmanager.com https://us.posthog.com https://us.i.posthog.com https://*.posthog.com https://*.i.posthog.com https://stats.g.doubleclick.net https://*.doubleclick.net https://pagead2.googlesyndication.com https://*.googlesyndication.com https://analytics-v2.kleap.co https://*.adtrafficquality.google https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google`,
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.tiktok.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.adtrafficquality.google",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://formspree.io https://formsubmit.co",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

function withSecurityHeaders(resp) {
  const ct = resp.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return resp;
  const h = new Headers(resp.headers);
  h.set("Content-Security-Policy", CSP);
  h.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains; preload");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}

export default {
  async fetch(request, env, ctx) {
    // Edge block for China-origin crawlers/scrapers. robots.txt asks politely;
    // Bytespider/PetalBot and friends ignore it, so reject them here. UA is
    // spoofable — for hard enforcement add a Cloudflare WAF rule by country/ASN.
    const ua = request.headers.get("user-agent") || "";
    if (/baiduspider|sogou|360spider|haosouspider|yisouspider|bytespider|petalbot/i.test(ua)) {
      return new Response("Not available", { status: 403 });
    }
    const url = new URL(request.url);
    // Internal files must never be served publicly (business docs, build config,
    // the worker source itself). 404 them regardless of the asset directory.
    // Test the DECODED path: the asset layer decodes before lookup, so
    // "/%73rc/..." or "/wrangler%2Etoml" would otherwise slip past.
    let decodedPath;
    try { decodedPath = decodeURIComponent(url.pathname); } catch { return new Response("Not found", { status: 404 }); }
    if (/\.(md|toml|yml|yaml|lock|mjs)$|^\/(package(-lock)?\.json|redirect-worker\.js|\.dev\.vars(\..*)?|\.env(\..*)?)$|^\/(src|test|scripts)\/|^\/(COMPETITOR|SEO|GEO|SEMRUSH)/i.test(decodedPath)) {
      return new Response("Not found", { status: 404 });
    }
    // TURN credential proxy: the edge CSP restricts connect-src to 'self' plus
    // an allowlist that doesn't include cloudfunctions.net, so the viewer page
    // can't call the turnCredentials function directly. Same-origin /api/turn
    // forwards to it instead (no CSP change, no CORS preflight). The function
    // itself does all auth/rate-limiting.
    if (url.pathname === "/api/turn" &&
        (request.method === "POST" || request.method === "GET")) {
      try {
        // GET variant carries the session proof in headers (never in the URL)
        // because the asset layer only falls through to the worker for GETs
        // unless run_worker_first is honored; support both so either works.
        const body = request.method === "POST"
          ? request.body
          : JSON.stringify({
              sessionId: request.headers.get("x-session-id") || "",
              secret: request.headers.get("x-session-secret") || "",
            });
        const upstream = await fetch(
          "https://us-central1-deer-dash.cloudfunctions.net/turnCredentials",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          },
        );
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, no-store",
          },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "proxy error" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    // Opinly blog, sitemap, RSS, webhook. Returns null when the path is not ours.
    const blog = await handleOpinlyRequest(request, env, ctx);
    if (blog) return withSecurityHeaders(blog);

    const m = url.pathname.match(/^\/([a-z0-9])$/);
    if (m) {
      return Response.redirect(
        `${url.origin}/?utm_source=heycatch&utm_campaign=${m[1]}`,
        302,
      );
    }
    // Serve the asset, adding the security headers the old quiet-fog worker
    // used to inject (ported here so retargeting the main route to this
    // worker loses nothing). connect-src 'self' covers the /api/turn proxy.
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
