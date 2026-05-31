import type { MetadataRoute } from "next";
import { getAllPosts } from "./(site)/blog/posts-meta";
import { entriesForSet, setIdsInCatalog } from "@/lib/cards/catalog";

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
  { path: "/newsletter", priority: 0.8, changeFrequency: "monthly" },
  { path: "/start", priority: 0.95, changeFrequency: "weekly" },
  { path: "/legal/ebay-api-compliance", priority: 0.5, changeFrequency: "monthly" },
  { path: "/legal/privacy", priority: 0.4, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.4, changeFrequency: "yearly" },
];

const PAGES_SHARD = "pages";

// Split sitemap (ADR-047): one child sitemap per catalog set + a "pages" shard
// for landings/blog. Next auto-serves a sitemap INDEX at /sitemap.xml that
// references each child at /sitemap/<id>.xml. Each shard is far under Google's
// 50K-URL/file limit (largest set < 300 cards), and this scales cleanly to the
// 18K catalog + future international printings without any single file growing
// unbounded. robots.ts already points crawlers at /sitemap.xml (the index).
export async function generateSitemaps(): Promise<{ id: string }[]> {
  return [{ id: PAGES_SHARD }, ...setIdsInCatalog().map((setId) => ({ id: `set-${setId}` }))];
}

export default async function sitemap({ id }: { id: Promise<string> | string }): Promise<MetadataRoute.Sitemap> {
  const shard = typeof id === "string" ? id : await id;
  const base = siteUrl();
  const now = new Date();

  if (shard === PAGES_SHARD) {
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
    return [...landings, ...posts];
  }

  // Per-set card shard. changefreq daily because the curated tier's best-listing
  // block updates on every load (ADR-021); catalog metadata itself is stable.
  const setId = shard.replace(/^set-/, "");
  return entriesForSet(setId).map((entry) => ({
    url: `${base}/cards/${entry.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));
}
