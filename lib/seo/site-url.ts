// Canonical site origin — ONE fallback for every surface (perf-and-data-
// foundation, 2026-07-01). Before this module, the canonical fallback had
// drifted: app/(site)/cards/[slug]/page.tsx defaulted to https://www.foiltcg.com
// while app/layout.tsx defaulted to https://foiltcg.com — so with
// NEXT_PUBLIC_SITE_URL unset, card canonicals/JSON-LD pointed at the www host
// (which 301s to the apex) while metadataBase pointed at the apex. Non-www is
// canonical (prod NEXT_PUBLIC_SITE_URL=https://foiltcg.com; www 301s to apex).
//
// Pure data module — no Next.js imports — so sitemap/proxy-style unit tests
// can exercise it under the bare node --test runner.

export const DEFAULT_SITE_URL = "https://foiltcg.com";

/** Resolved site origin: NEXT_PUBLIC_SITE_URL when set, else the canonical
 *  non-www production origin. Trailing slash stripped. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, "");
}
