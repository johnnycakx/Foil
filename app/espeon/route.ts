// /espeon — vanity shortcut for the eve send (eve-clean-links, 2026-07-02).
// See app/umbreon/route.ts for the 302-not-permanent rationale.

export function GET(request: Request): Response {
  const url = new URL("/lines/espeon?utm_source=x&utm_medium=eve", request.url);
  return Response.redirect(url, 302);
}
