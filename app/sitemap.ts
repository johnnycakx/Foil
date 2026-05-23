import type { MetadataRoute } from "next";
import { getAllPosts } from "./blog/posts-meta";
import { CARD_CATALOG } from "@/lib/cards/catalog";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}

// Public landing/marketing pages that should be indexed. Authenticated
// surfaces (/upload, /account, /login, /auth/*, /api/*) intentionally omitted.
const LANDING_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/japanese-pokemon-cards-value", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pokemon-card-value-calculator", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pokemon-card-condition-guide", priority: 0.9, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();

  const landings: MetadataRoute.Sitemap = LANDING_PATHS.map((entry) => ({
    url: `${base}${entry.path}`,
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));

  const posts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
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

  return [...landings, ...posts, ...cards];
}
