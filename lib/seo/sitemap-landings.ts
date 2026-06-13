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

// VENDING PIVOT (docs/vending Goal A §3): the sitemap contains ONLY the new
// vending host lead-gen surfaces plus the general legal pages. Every
// deal-finder route (/cards, /deals, /blog, /start, /newsletter,
// /pricing-methodology, the three pillars, /machines, /legal/ebay-api-compliance)
// is dormant — noindexed + unlinked — and deliberately absent here so the
// already-indexed URLs drop out of Google over time. app/sitemap.ts layers the
// /service-areas/[city] pages on top of this list.
export const LANDING_PATHS: readonly LandingPath[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/host", priority: 0.9, changeFrequency: "monthly" },
  { path: "/service-areas", priority: 0.8, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
];
