/**
 * Static landing/marketing pages included in the XML sitemap.
 *
 * Pure data module — no Next.js runtime imports — so the sitemap contract can
 * be unit-tested in isolation (same pattern as lib/supabase/public-routes.ts,
 * which the auth proxy uses). app/sitemap.ts imports this list and layers the
 * dynamic /cards/* + /blog/* URLs on top.
 *
 * What belongs here: fixed, indexable, public content pages. Deliberately
 * OMITTED — authenticated surfaces (/upload, /account, /login, /auth/*), API
 * routes, the /go click-time affiliate redirect (a redirect, not content), and
 * Next metadata routes (robots/sitemap/og/twitter/manifest). Every path here
 * must also be public per lib/supabase/public-routes.ts; the sitemap test pins
 * that invariant so a gated route can't leak into the crawl surface.
 */

// Mirror of Next's MetadataRoute.Sitemap[number]["changeFrequency"] union,
// declared locally so this module carries no "next" import (keeps it
// resolvable under the bare `node --test` runner).
export type SitemapChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export type LandingPath = {
  path: string;
  priority: number;
  changeFrequency: SitemapChangeFrequency;
};

export const LANDING_PATHS: readonly LandingPath[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/japanese-pokemon-cards-value", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pokemon-card-value-calculator", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pokemon-card-condition-guide", priority: 0.9, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
  { path: "/newsletter", priority: 0.8, changeFrequency: "monthly" },
  { path: "/start", priority: 0.95, changeFrequency: "weekly" },
  // "Today's best deals" leaderboard (ADR-054). The X-bot screenshot surface +
  // homepage primary CTA; the deals-refresh cron rewrites the board daily, so
  // changefreq is daily. Was missing from the sitemap through 2026-06-06 — the
  // one real defect the GSC review surfaced.
  { path: "/deals", priority: 0.9, changeFrequency: "daily" },
  // Buy-signal methodology / trust page (ADR-053) every buy-signal badge links
  // to. Public + crawlable but was also absent from the sitemap.
  { path: "/pricing-methodology", priority: 0.5, changeFrequency: "monthly" },
  { path: "/legal/ebay-api-compliance", priority: 0.5, changeFrequency: "monthly" },
  { path: "/legal/privacy", priority: 0.4, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.4, changeFrequency: "yearly" },
];
