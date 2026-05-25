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

  // V1 deal-finder per-card landing pages (ADR-020 + ADR-021). Buyer-side,
  // anonymous-friendly — no auth gate before someone can see a deal or join a
  // watchlist. Every /cards/<slug> URL must stay crawlable for SEO.
  { kind: "prefix", path: "/cards" },

  // Watchlist email-capture endpoint posted to from /cards/<slug> pages.
  // Same anonymous-friendly contract as /api/subscribe; Zod gates the body
  // and the service-role client gates the insert.
  { kind: "exact", path: "/api/watchlist" },

  // Auth surface — login form (exact) + magic-link callback tree. /auth/*
  // MUST be public or the magic-link redirect loops back through the auth
  // gate and consumes the OTP token before /auth/callback can exchange it
  // (error=invalid_link).
  { kind: "exact", path: "/login" },
  { kind: "prefix", path: "/auth" },

  // 3rd-party webhooks — Stripe POSTs here with its own signature scheme.
  { kind: "prefix", path: "/api/webhooks" },

  // Vercel Cron Job routes (ADR-024). Vercel's cron infra POSTs with
  // `Authorization: Bearer ${CRON_SECRET}` — the route does its own bearer
  // gate. Auth-gating these via the proxy would force a public Vercel
  // schedule definition to also be a Supabase-authed user, which it isn't.
  { kind: "prefix", path: "/api/cron" },

  // Public legal / compliance pages — anything under /legal/* is
  // reviewer-facing and must be crawlable. Session 33 added the first
  // such page (/legal/ebay-api-compliance, the public mirror of
  // docs/EBAY-COMPLIANCE.md). Future privacy/ToS lands here too.
  { kind: "prefix", path: "/legal" },

  // Newsletter subscribe endpoint. Today the EmailCapture component invokes a
  // colocated Server Action so the POST piggy-backs on the host page (already
  // public). Listed here as the contract anchor: if we ever extract to a real
  // /api/subscribe route, anonymous visitors must still be able to reach it.
  { kind: "exact", path: "/api/subscribe" },

  // Newsletter landing page (Task #18 / Session 37). Twitter-CTA target;
  // single email field with source='newsletter-landing'.
  { kind: "exact", path: "/newsletter" },

  // RFC 8058 one-click unsubscribe endpoint (Task #18 / Session 37). Both
  // GET (visible-link path) and POST (List-Unsubscribe-Post one-click) are
  // anonymous — the HMAC token IS the identity proof; no session needed.
  { kind: "exact", path: "/api/unsubscribe" },

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
