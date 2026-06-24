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

// DUAL-TRACK (ADR-064): the Pokémon-card deal-finder is the primary indexed SEO
// surface again, and the vending lead-gen business lives at /host. The sitemap
// carries BOTH tracks' fixed landing pages. app/sitemap.ts layers the dynamic
// surfaces on top: every /cards/[slug] (the programmatic deal-finder pages),
// every /blog/[slug] post (deal-finder collector + vending host posts — all
// indexable), and every /service-areas/[city] page. /machines is intentionally
// omitted (indexable but no live locations yet — no thin page in the crawl set).
export const LANDING_PATHS: readonly LandingPath[] = [
  // Deal-finder — the primary surface (ADR-020 positioning, restored).
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/japanese-pokemon-cards-value", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pokemon-card-value-calculator", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pokemon-card-condition-guide", priority: 0.9, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
  { path: "/newsletter", priority: 0.8, changeFrequency: "monthly" },
  { path: "/start", priority: 0.95, changeFrequency: "weekly" },
  { path: "/deals", priority: 0.9, changeFrequency: "daily" },
  { path: "/pricing-methodology", priority: 0.5, changeFrequency: "monthly" },
  // Vending lead-gen — the secondary track at /host (kept live + indexed).
  { path: "/host", priority: 0.9, changeFrequency: "monthly" },
  { path: "/service-areas", priority: 0.8, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
  // Legal / compliance.
  { path: "/legal/ebay-api-compliance", priority: 0.5, changeFrequency: "monthly" },
  { path: "/legal/privacy", priority: 0.4, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.4, changeFrequency: "yearly" },
];
