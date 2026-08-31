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
