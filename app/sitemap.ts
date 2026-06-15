import type { MetadataRoute } from "next";
import { LANDING_PATHS } from "@/lib/seo/sitemap-landings";
import { CITY_SLUGS } from "@/lib/vending/cities";
import { getVendingPosts } from "@/app/(site)/blog/posts-meta";

// VENDING PIVOT (docs/vending Goal A §3 + ADR-063): the sitemap contains the
// vending host lead-gen surfaces — the fixed landing set (LANDING_PATHS), one
// /service-areas/[city] entry per published city, and one /blog/[slug] entry
// per LIVE VENDING post (getVendingPosts; pillar host / service-areas). The
// dormant deal-finder blog posts and ~1,000 per-card pages (CARD_CATALOG) are
// deliberately NOT layered on: those routes stay noindex + unlinked so their
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

  // Live vending blog posts only (ADR-063). Deal-finder posts are excluded by
  // getVendingPosts (pillar gate), matching their noindex on the [slug] route.
  const blogPosts: MetadataRoute.Sitemap = getVendingPosts().map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.updated ?? post.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...landings, ...cities, ...blogPosts];
}
