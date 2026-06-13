import type { MetadataRoute } from "next";
import { LANDING_PATHS } from "@/lib/seo/sitemap-landings";
import { CITY_SLUGS } from "@/lib/vending/cities";

// VENDING PIVOT (docs/vending Goal A §3): the sitemap now contains ONLY the
// vending host lead-gen surfaces — the fixed landing set (LANDING_PATHS) plus
// one /service-areas/[city] entry per published city. The deal-finder's blog
// posts (getAllPosts) and ~1,000 per-card pages (CARD_CATALOG) are deliberately
// NO LONGER layered on: those routes are dormant (noindex + unlinked) so their
// already-indexed URLs drop out of Google. The code for them stays in-tree.

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();

  const landings: MetadataRoute.Sitemap = LANDING_PATHS.map((entry) => ({
    url: `${base}${entry.path}`,
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));

  const cities: MetadataRoute.Sitemap = CITY_SLUGS.map((slug) => ({
    url: `${base}/service-areas/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...landings, ...cities];
}
