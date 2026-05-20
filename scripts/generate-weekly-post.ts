// Weekly content generator. Picks the next cluster topic from the strategy
// doc backlog, calls Claude Sonnet 4.6 to draft it, and writes the result to
// app/blog/posts/_pending/{slug}.mdx so it isn't picked up by static-param
// generation until John moves it out.
//
// Usage:
//   node --experimental-strip-types scripts/generate-weekly-post.ts
//
// Optional env vars:
//   ANTHROPIC_API_KEY      — required
//   WEEKLY_POST_WEBHOOK_URL — POSTed to with {title, slug, previewUrl} after success

import fs from "node:fs";
import path from "node:path";
import { generateWeeklyPost, serializeDraft } from "../lib/seo/content-engine.ts";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set in env or .env.local — generator can't call Claude.");
  process.exit(1);
}

const POSTS_DIR = path.join(process.cwd(), "app", "blog", "posts");
const PENDING_DIR = path.join(POSTS_DIR, "_pending");
fs.mkdirSync(PENDING_DIR, { recursive: true });

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function listShippedSlugs(): Set<string> {
  const shipped = new Set<string>();
  if (!fs.existsSync(POSTS_DIR)) return shipped;
  for (const entry of fs.readdirSync(POSTS_DIR, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".mdx") && !entry.name.startsWith("_")) {
      shipped.add(entry.name.replace(/\.mdx$/, ""));
    }
  }
  // Also treat anything already drafted in _pending/ as "shipped" for picking
  // purposes — don't regenerate the same topic two weeks in a row if John
  // hasn't reviewed it yet.
  if (fs.existsSync(PENDING_DIR)) {
    for (const entry of fs.readdirSync(PENDING_DIR)) {
      if (entry.endsWith(".mdx")) shipped.add(entry.replace(/\.mdx$/, ""));
    }
  }
  return shipped;
}

async function notifyWebhook(payload: object): Promise<void> {
  const url = process.env.WEEKLY_POST_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn(`[webhook] POST ${url} → HTTP ${res.status} ${res.statusText}`);
    } else {
      console.log(`[webhook] notified ${url}`);
    }
  } catch (err) {
    console.warn(`[webhook] failed: ${(err as Error).message}`);
  }
}

const today = isoToday();
const shipped = listShippedSlugs();

console.log(`[generate] today=${today} shipped-count=${shipped.size}`);

const draft = await generateWeeklyPost({ shippedSlugs: shipped, today });
const outPath = path.join(PENDING_DIR, `${draft.slug}.mdx`);
fs.writeFileSync(outPath, serializeDraft(draft));

const previewUrl = `http://localhost:3000/blog/${draft.slug}`;

console.log("");
console.log("================================================================");
console.log(`  Draft written → ${path.relative(process.cwd(), outPath)}`);
console.log("================================================================");
console.log(`  Title          : ${draft.frontmatter.title}`);
console.log(`  Slug           : ${draft.slug}`);
console.log(`  Target keyword : ${draft.frontmatter.primaryKeyword}`);
console.log(`  Pillar         : /${draft.frontmatter.pillar}`);
console.log(`  Word count     : ${draft.wordCount} body words + ${draft.faq.length} FAQs`);
console.log(`  Preview URL    : ${previewUrl}`);
console.log("");
console.log("  To approve:");
console.log(`    mv ${path.relative(process.cwd(), outPath)} app/blog/posts/${draft.slug}.mdx`);
console.log("  Then: node --experimental-strip-types scripts/refresh-internal-links.ts");
console.log("================================================================");

await notifyWebhook({
  title: draft.frontmatter.title,
  slug: draft.slug,
  pillar: draft.frontmatter.pillar,
  primaryKeyword: draft.frontmatter.primaryKeyword,
  wordCount: draft.wordCount,
  previewUrl,
  draftPath: outPath,
});
