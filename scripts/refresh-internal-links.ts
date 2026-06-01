// Internal-link suggestion refresh. Scans all shipped posts for incoming +
// outgoing link opportunities against a target post and writes a report to
// docs/internal-link-suggestions.md.
//
// Usage:
//   node --experimental-strip-types scripts/refresh-internal-links.ts <slug>
//
// If <slug> is omitted, uses the most recently modified MDX file under
// the canonical POSTS_DIR (app/(site)/blog/posts/) as the target.

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  renderReport,
  suggestForNewPost,
  type LinkablePost,
} from "../lib/seo/internal-linking.ts";
import { POSTS_DIR } from "../lib/blog/posts-dir.ts";

// Pillar pages are not MDX — they're TSX with metadata in code. We hand-roll
// their LinkablePost entries so internal-link suggestions can target them
// alongside cluster posts.
const PILLARS: LinkablePost[] = [
  {
    slug: "japanese-pokemon-cards-value",
    title: "Japanese Pokémon cards value",
    urlPath: "/japanese-pokemon-cards-value",
    primaryKeyword: "Japanese Pokémon cards value",
    secondaryKeywords: ["Japanese Pokémon card prices", "valuing Japanese Pokémon cards"],
    body: "",
    isPillar: true,
  },
  {
    slug: "pokemon-card-value-calculator",
    title: "Pokémon card value calculator",
    urlPath: "/pokemon-card-value-calculator",
    primaryKeyword: "Pokémon card value calculator",
    secondaryKeywords: ["look up a card's value", "Pokémon card valuation guide"],
    body: "",
    isPillar: true,
  },
  {
    slug: "pokemon-card-condition-guide",
    title: "Pokémon card condition guide",
    urlPath: "/pokemon-card-condition-guide",
    primaryKeyword: "Pokémon card condition guide",
    secondaryKeywords: ["NM vs LP vs MP guide", "card condition grading explained"],
    body: "",
    isPillar: true,
  },
];

function loadBlogPosts(): LinkablePost[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      const { data, content } = matter(raw);
      const slug = file.replace(/\.mdx$/, "");
      const title = typeof data.title === "string" ? data.title : slug;
      const primary =
        typeof data.primaryKeyword === "string"
          ? data.primaryKeyword
          : Array.isArray(data.tags) && typeof data.tags[0] === "string"
            ? data.tags[0]
            : title;
      const tags = Array.isArray(data.tags)
        ? data.tags.filter((t): t is string => typeof t === "string")
        : [];
      return {
        slug,
        title,
        urlPath: `/blog/${slug}`,
        primaryKeyword: primary,
        secondaryKeywords: tags,
        body: content,
        isPillar: false,
      };
    });
}

function mostRecentSlug(posts: LinkablePost[]): string | null {
  if (!posts.length) return null;
  let bestSlug: string | null = null;
  let bestMtime = -Infinity;
  for (const post of posts) {
    const stat = fs.statSync(path.join(POSTS_DIR, `${post.slug}.mdx`));
    if (stat.mtimeMs > bestMtime) {
      bestMtime = stat.mtimeMs;
      bestSlug = post.slug;
    }
  }
  return bestSlug;
}

const requestedSlug = process.argv[2];
const allBlogPosts = loadBlogPosts();
const targetSlug = requestedSlug ?? mostRecentSlug(allBlogPosts);

if (!targetSlug) {
  console.error("No target slug supplied and no shipped posts found.");
  process.exit(1);
}

const newPost = allBlogPosts.find((p) => p.slug === targetSlug);
if (!newPost) {
  console.error(`No shipped post found with slug "${targetSlug}".`);
  console.error("Available slugs:", allBlogPosts.map((p) => p.slug).join(", "));
  process.exit(1);
}

const existing = [...PILLARS, ...allBlogPosts.filter((p) => p.slug !== targetSlug)];
const bundle = suggestForNewPost(newPost, existing);

const report = renderReport(newPost, bundle);
const outPath = path.join(process.cwd(), "docs", "internal-link-suggestions.md");
fs.writeFileSync(outPath, report);

console.log(`[links] target = ${newPost.title} (${newPost.urlPath})`);
console.log(`[links] incoming suggestions = ${bundle.incoming.length}`);
console.log(`[links] outgoing suggestions = ${bundle.outgoing.length}`);
console.log(`[links] report written to ${path.relative(process.cwd(), outPath)}`);
