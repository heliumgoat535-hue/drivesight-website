// Single-character short-link redirects for HeyCatch channel attribution
// (heycatch.ai/agents.md step 4). This host serves Workers Static Assets,
// which ignores Pages-style _redirects/_headers files — asset misses fall
// through to this worker instead, so /a-/z and /0-/9 redirect here and
// every other miss gets the normal asset 404.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
