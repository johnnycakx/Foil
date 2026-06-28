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

  // X content-bot approval endpoint (ADR-071). The Foil HQ Discord bot POSTs here
  // after the owner approves/skips a draft; the route does its OWN bearer gate
  // (X_APPROVE_SECRET) + the bot does the Discord owner-gate. Auth-gating it via
  // the proxy would 302 the bot's request to /login and break approval.
  { kind: "exact", path: "/api/x/approve" },

  // Newsletter digest approval endpoint (ADR-077). Same contract as /api/x/approve:
  // the bot POSTs here (its own bearer gate NEWSLETTER_APPROVE_SECRET) when the
  // owner approves/skips a digest draft whose id was not an X draft. Must be public
  // or the proxy 302s the bot to /login and approval breaks.
  { kind: "exact", path: "/api/newsletter/approve" },

  // Newsletter subscribe endpoint. Today the EmailCapture component invokes a
  // colocated Server Action so the POST piggy-backs on the host page (already
  // public). Listed here as the contract anchor: if we ever extract to a real
  // /api/subscribe route, anonymous visitors must still be able to reach it.
  { kind: "exact", path: "/api/subscribe" },

  // Newsletter landing page (Task #18 / Session 37). Twitter-CTA target;
  // single email field with source='newsletter-landing'.
  { kind: "exact", path: "/newsletter" },

  // Buy-signal methodology (ROADMAP #32 / ADR-053). Public, crawlable — it's
  // the trust/defensibility page every buy-signal badge links to.
  { kind: "exact", path: "/pricing-methodology" },

  // Lead-magnet landing pages (ADR-068). Indexable, anonymous-friendly — the
  // page ranks; the gated asset reveals on subscribe via the existing subscribe
  // Server Action. Prefix so future magnets under /free/* are public too.
  { kind: "prefix", path: "/free" },

  // Click-time affiliate redirect (ROADMAP B.4 follow-up / ADR-056). /go/deal/
  // [slug] runs a live getBestListing and 302s to the specific item's affiliate
  // URL. Anonymous-friendly (it's a buyer click-through); the destination is
  // always an internally-built eBay URL (no open redirect).
  { kind: "prefix", path: "/go" },

  // "Today's best deals" leaderboard (ROADMAP B.4 / ADR-054). Public,
  // crawlable, anonymous-friendly — the screenshot surface for the X content
  // bot + the homepage primary CTA. Renders from the buy_signals cache (no
  // eBay call at view time); the refresh cron is /api/cron/deals-refresh
  // (already covered by the /api/cron prefix).
  { kind: "exact", path: "/deals" },

  // Vending surfaces. /host is the venue-acquisition funnel; /faq is the host
  // FAQ; /service-areas is the Bay-Area hub + its /service-areas/[city] pages
  // (prefix). All anonymous-friendly marketing surfaces; the /host lead form
  // writes through a Server Action on the page. /machines is the buyer-facing
  // locator hub (prefix: /machines/[location] pages arrive in Phase V-2) — it's
  // dormant/noindexed under the host-lead-gen pivot (docs/vending Goal A) but
  // the route stays public so it resolves when revived.
  { kind: "prefix", path: "/machines" },
  { kind: "exact", path: "/host" },
  { kind: "exact", path: "/faq" },
  { kind: "prefix", path: "/service-areas" },

  // /start onboarding page (Task #20 / Session 38). Multi-card watchlist
  // signup — the new headline Twitter-CTA target. The page + the /api/start
  // POST + the /api/cards/search GET (typeahead) all must be reachable
  // anonymously per ADR-020.
  { kind: "exact", path: "/start" },
  { kind: "exact", path: "/api/start" },
  { kind: "exact", path: "/api/cards/search" },

  // Live curated-listing endpoint (SEO crawlability fix, ADR-047 v2). The
  // per-card page hydrates its live eBay best-listing + buy-signal from
  // /api/listing/[slug] client-side so the server render stays fast + crawlable.
  // Anonymous-friendly read (same posture as the anonymous card page, ADR-020);
  // the route self-protects via R-008 no-store + sanitized inputs. Lives under
  // /api/listing (NOT /api/cards) precisely so this prefix can't open the rest
  // of /api/cards/* (which stays gated by default).
  { kind: "prefix", path: "/api/listing" },

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
