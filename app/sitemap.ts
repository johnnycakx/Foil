import type { MetadataRoute } from "next";
import { LANDING_PATHS } from "@/lib/seo/sitemap-landings";
import { siteUrl } from "@/lib/seo/site-url";
import { CITY_SLUGS } from "@/lib/vending/cities";
import { getAllPosts } from "@/app/(site)/blog/posts-meta";
import { CARD_CATALOG, cardTier, setIdsInCatalog } from "@/lib/cards/catalog";
import { getBakedSnapshotTimestamp } from "@/lib/cards/sdk";

// DUAL-TRACK sitemap (ADR-064). Layers, on top of the fixed LANDING_PATHS set:
//   - every /cards/[slug] programmatic deal-finder page (CARD_CATALOG) — the
//     primary SEO surface, restored from the vending pivot's dormancy;
//   - /cards + every /cards/sets/[set-id] hub page (the fast prerendered browse
//     layer — omitted entirely until the perf-and-data-foundation goal,
//     2026-07-01, despite being the crawl path INTO the card long tail);
//   - every /blog/[slug] post (getAllPosts) — both the deal-finder collector
//     posts AND the vending host posts are indexable now;
//   - every /service-areas/[city] page (vending local SEO).
// /machines is intentionally NOT layered on: it's indexable but shows no live
// locations yet, so it carries no organic value and stays out of the crawl set.
//
// lastModified discipline: only REAL dates. Card/set URLs carry the snapshot's
// bakedAt (when their data last changed); blog posts carry their post date.
// Fixed landings carry NO lastModified — a fabricated `new Date()` on every
// request tells Google "everything changed today" on every crawl, which
// erodes trust in the field exactly where we want it believed.

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  // Real per-snapshot date: when the baked card/set data last changed.
  const bakedAtIso = getBakedSnapshotTimestamp();
  const bakedAt = bakedAtIso ? new Date(bakedAtIso) : undefined;

  const landings: MetadataRoute.Sitemap = LANDING_PATHS.map((entry) => ({
    url: `${base}${entry.path}`,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));

  const cities: MetadataRoute.Sitemap = CITY_SLUGS.map((slug) => ({
    url: `${base}/service-areas/${slug}`,
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

  // Set hub pages — the prerendered browse layer that links every card page.
  const sets: MetadataRoute.Sitemap = setIdsInCatalog().map((id) => ({
    url: `${base}/cards/sets/${id}`,
    lastModified: bakedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // V1 deal-finder per-card landing pages — the programmatic SEO surface
  // (ADR-020 + ADR-021). One URL per catalog entry. The crawled HTML is
  // metadata-stable (baked snapshot; the live listing hydrates client-side and
  // is never in the crawled DOM), so "weekly" is the honest changefreq — the
  // old uniform daily/0.8 was aspiration, not fact. Curated pages keep the
  // higher priority; the long tail sits below the hub/landing layer.
  const cards: MetadataRoute.Sitemap = CARD_CATALOG.map((entry) => ({
    url: `${base}/cards/${entry.slug}`,
    lastModified: bakedAt,
    changeFrequency: "weekly",
    priority: cardTier(entry.slug) === "curated" ? 0.8 : 0.5,
  }));

  return [...landings, ...cities, ...blogPosts, ...sets, ...cards];
}
