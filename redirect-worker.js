// Single-character short-link redirects for HeyCatch channel attribution
// (heycatch.ai/agents.md step 4). This host serves Workers Static Assets,
// which ignores Pages-style _redirects/_headers files — asset misses fall
// through to this worker instead, so /a-/z and /0-/9 redirect here and
// every other miss gets the normal asset 404.
export default {
  async fetch(request, env) {
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
    if (/\.(md|toml|yml|yaml|lock)$|^\/(package(-lock)?\.json|redirect-worker\.js)$|^\/(COMPETITOR|SEO|GEO|SEMRUSH)/i.test(url.pathname)) {
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
    const resp = await env.ASSETS.fetch(request);
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      const h = new Headers(resp.headers);
      h.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://esm.sh https://in.heycatch.ai https://www.gstatic.com https://analytics-v2.kleap.co https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.googleadservices.com https://*.doubleclick.net https://us.posthog.com https://us.i.posthog.com https://*.i.posthog.com https://static.cloudflareinsights.com https://*.adtrafficquality.google; script-src-elem 'self' 'unsafe-inline' https://esm.sh https://in.heycatch.ai https://www.gstatic.com https://analytics-v2.kleap.co https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.googleadservices.com https://*.doubleclick.net https://us.posthog.com https://us.i.posthog.com https://*.i.posthog.com https://static.cloudflareinsights.com https://*.adtrafficquality.google; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://esm.sh https://in.heycatch.ai https://*.googleapis.com wss://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://www.google-analytics.com https://*.google-analytics.com https://*.googletagmanager.com https://us.posthog.com https://us.i.posthog.com https://*.posthog.com https://*.i.posthog.com https://stats.g.doubleclick.net https://*.doubleclick.net https://pagead2.googlesyndication.com https://*.googlesyndication.com https://analytics-v2.kleap.co https://*.adtrafficquality.google https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.adtrafficquality.google; object-src 'none'; base-uri 'self'; form-action 'self' https://formspree.io https://formsubmit.co; frame-ancestors 'self'; upgrade-insecure-requests");
      h.set("Strict-Transport-Security", "max-age=15552000; includeSubDomains; preload");
      h.set("X-Content-Type-Options", "nosniff");
      h.set("Referrer-Policy", "strict-origin-when-cross-origin");
      return new Response(resp.body, { status: resp.status, headers: h });
    }
    return resp;
  },
};
