// Pulls a set of competitor URLs, extracts H2/H3 outlines, diffs against
// Foil's own topic coverage, and writes docs/competitive-gaps.md.
//
// Usage:
//   node --experimental-strip-types scripts/competitive-gap-scan.ts
//
// To override the URL list ad-hoc, pass space-separated URLs on argv:
//   node ... scripts/competitive-gap-scan.ts https://example.com/a https://example.com/b

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import {
  fetchHtml,
  findTopicGaps,
  renderGapReport,
  scrapeCompetitorContent,
} from "../lib/seo/competitive-analysis.ts";
import { parseStrategyDoc } from "../lib/seo/keyword-backlog.ts";
import { POSTS_DIR } from "../lib/blog/posts-dir.ts";

const DEFAULT_TARGETS = [
  "https://pokescope.app/blog",
  "https://pokescope.app/tools/price-checker",
];

// POSTS_DIR imported from lib/blog/posts-dir (the canonical write+read dir).
const STRATEGY_PATH = path.join(process.cwd(), "docs", "seo-strategy.md");
const OUT_PATH = path.join(process.cwd(), "docs", "competitive-gaps.md");

function loadOwnTopics(): string[] {
  const topics: string[] = [];

  // Pillar titles + cluster bullet titles from the strategy doc
  if (fs.existsSync(STRATEGY_PATH)) {
    const md = fs.readFileSync(STRATEGY_PATH, "utf8");
    const candidates = parseStrategyDoc(md);
    for (const c of candidates) {
      topics.push(c.title);
      for (const lt of c.longTail) topics.push(lt);
    }
  }

  // Shipped post titles
  if (fs.existsSync(POSTS_DIR)) {
    for (const file of fs.readdirSync(POSTS_DIR)) {
      if (!file.endsWith(".mdx") || file.startsWith("_")) continue;
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
      const { data } = matter(raw);
      if (typeof data.title === "string") topics.push(data.title);
    }
  }

  // Pillar landing titles (hard-coded; they live in TSX, not Markdown)
  topics.push("Japanese Pokémon cards value");
  topics.push("Pokémon card value calculator");
  topics.push("Pokémon card condition guide");

  return topics;
}

const targets = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_TARGETS;
const ownTopics = loadOwnTopics();

console.log(`[gaps] scanning ${targets.length} competitor URLs against ${ownTopics.length} known Foil topics`);

const pages = [];
for (const url of targets) {
  try {
    const page = await scrapeCompetitorContent(url, fetchHtml);
    console.log(`[gaps] ${url} → ${page.headings.length} headings (${page.title})`);
    pages.push(page);
  } catch (err) {
    console.warn(`[gaps] skipping ${url}: ${(err as Error).message}`);
  }
}

const gaps = findTopicGaps(pages, ownTopics);
const report = renderGapReport(gaps, ownTopics);
fs.writeFileSync(OUT_PATH, report);

console.log(`[gaps] ${gaps.length} new topic gaps surfaced`);
console.log(`[gaps] report written to ${path.relative(process.cwd(), OUT_PATH)}`);
