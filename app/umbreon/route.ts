// /umbreon — vanity shortcut for the eve send (eve-clean-links, 2026-07-02).
// The tweet shows a clean top-level link; this 302s to the UTM'd line page so
// attribution survives. TEMPORARY 302 by design (never 301/308): after the
// eve event this path gets re-pointed to the clean /lines/umbreon as a
// permanent shortcut, and a cached permanent redirect would freeze the UTM
// destination into browsers/X forever.

export function GET(request: Request): Response {
  const url = new URL("/lines/umbreon?utm_source=x&utm_medium=eve", request.url);
  return Response.redirect(url, 302);
}
