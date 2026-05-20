/**
 * Canonical public-route allowlist. Pure routing predicate — no Next.js
 * imports — so it can be tested in isolation from the proxy/Supabase stack.
 *
 * Everything NOT matched here requires an authenticated session and gets
 * redirected to /login by lib/supabase/proxy.ts.
 *
 * When you add a new route to app/, decide which side it belongs on:
 *   - Marketing / SEO / auth flow / 3rd-party webhooks → add a rule below.
 *   - User-data, scans, billing, account → leave it out (it'll auto-gate).
 *
 * Each rule has an explicit `kind`:
 *   - exact:  matches if pathname === path
 *   - prefix: matches if pathname starts with `${path}/` OR pathname === path
 *
 * The redundant equality check on prefix rules is what lets us register e.g.
 * { kind: "prefix", path: "/blog" } and have it match both /blog and
 * /blog/anything without it also matching /blogs. Using a trailing-slash
 * convention was tempting but homepage "/" is both prefix-shaped and
 * exact-only, so the kind has to be explicit.
 */
export type PublicRouteRule =
  | { kind: "exact"; path: string }
  | { kind: "prefix"; path: string };

export const PUBLIC_ROUTES: readonly PublicRouteRule[] = [
  // Homepage + marketing landings — exact match only
  { kind: "exact", path: "/" },
  { kind: "exact", path: "/japanese-pokemon-cards-value" },
  { kind: "exact", path: "/pokemon-card-value-calculator" },
  { kind: "exact", path: "/pokemon-card-condition-guide" },

  // Blog index + every post under it
  { kind: "prefix", path: "/blog" },

  // Auth surface — login form (exact) + magic-link callback tree. /auth/*
  // MUST be public or the magic-link redirect loops back through the auth
  // gate and consumes the OTP token before /auth/callback can exchange it
  // (error=invalid_link).
  { kind: "exact", path: "/login" },
  { kind: "prefix", path: "/auth" },

  // 3rd-party webhooks — Stripe POSTs here with its own signature scheme.
  { kind: "prefix", path: "/api/webhooks" },

  // Next.js metadata routes. Already crawler-bound; redirecting them to
  // /login would break SEO indexing of robots.txt / sitemap.xml entirely.
  { kind: "exact", path: "/robots.txt" },
  { kind: "exact", path: "/sitemap.xml" },
  { kind: "exact", path: "/opengraph-image" },
  { kind: "exact", path: "/twitter-image" },
  { kind: "exact", path: "/manifest.webmanifest" },
];

export function isPublicRoute(pathname: string): boolean {
  for (const rule of PUBLIC_ROUTES) {
    if (rule.kind === "exact") {
      if (pathname === rule.path) return true;
    } else {
      // prefix: match the path itself OR any child path. The trailing "/"
      // check prevents "/blog" from matching "/blogs" or "/blog-archive".
      if (pathname === rule.path || pathname.startsWith(`${rule.path}/`)) {
        return true;
      }
    }
  }
  return false;
}
