// /x — the @FoilTCG bio link (x-profile-banner addendum, 2026-07-02). Clean
// in the bio; 302s to the homepage with bio attribution. Same pattern +
// rationale as the eve vanity shortcuts (app/umbreon/route.ts): temporary by
// design so the destination can be re-pointed without fighting caches.

export function GET(request: Request): Response {
  const url = new URL("/?utm_source=x&utm_medium=bio", request.url);
  return Response.redirect(url, 302);
}
