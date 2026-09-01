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
    return env.ASSETS.fetch(request);
  },
};
