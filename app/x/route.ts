// /x — the @FoilTCG bio link (x-profile-banner addendum, 2026-07-02). Clean
// in the bio; 302s to the homepage with bio attribution. Same pattern +
// rationale as the eve vanity shortcuts (app/umbreon/route.ts): temporary by
// design so the destination can be re-pointed without fighting caches.

export function GET(request: Request): Response {
  // Full bio attribution (x-reply-desk §4): utm_campaign=profile completes the
  // reply→signup proof chain (runbook docs/runbooks/acquisition-utm.md:27), so
  // `npm run subscriber-sources` can isolate bio-link signups.
  const url = new URL("/?utm_source=x&utm_medium=bio&utm_campaign=profile", request.url);
  return Response.redirect(url, 302);
}
