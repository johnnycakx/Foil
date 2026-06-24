import type { MetadataRoute } from "next";
import { LANDING_PATHS } from "@/lib/seo/sitemap-landings";
import { CITY_SLUGS } from "@/lib/vending/cities";
import { getAllPosts } from "@/app/(site)/blog/posts-meta";
import { CARD_CATALOG } from "@/lib/cards/catalog";

// DUAL-TRACK sitemap (ADR-064). Layers, on top of the fixed LANDING_PATHS set:
//   - every /cards/[slug] programmatic deal-finder page (CARD_CATALOG) — the
//     primary SEO surface, restored from the vending pivot's dormancy;
//   - every /blog/[slug] post (getAllPosts) — both the deal-finder collector
//     posts AND the vending host posts are indexable now;
//   - every /service-areas/[city] page (vending local SEO).
// /machines is intentionally NOT layered on: it's indexable but shows no live
// locations yet, so it carries no organic value and stays out of the crawl set.

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

  // All blog posts (dual-track, ADR-064): deal-finder collector posts + vending
  // host posts. Both classes are indexable on the [slug] route, so both belong
  // in the sitemap.
  const blogPosts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.updated ?? post.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // V1 deal-finder per-card landing pages — the programmatic SEO surface
  // (ADR-020 + ADR-021). One URL per catalog entry; changefreq daily because
  // the EPN-driven "best listing" block updates on every page load, even
  // though the catalog metadata itself is stable.
  const cards: MetadataRoute.Sitemap = CARD_CATALOG.map((entry) => ({
    url: `${base}/cards/${entry.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...landings, ...cities, ...blogPosts, ...cards];
}
