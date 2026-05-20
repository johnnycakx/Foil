// Full-autonomy weekly content generator.
//
// Pipeline:
//   1. Pick next unshipped cluster topic from docs/seo-strategy.md
//   2. Fetch SERP context + Foil data snapshot
//   3. Generate → quality gates → retry up to 3x
//   4. On success:
//      - if AUTO_PUBLISH_WEEKLY_POSTS=true (default): write to app/blog/posts/{slug}.mdx
//      - if false (kill-switch): write to app/blog/posts/_pending/{slug}.mdx
//   5. On 3-strike failure: log + POST to webhook + exit 1 (skip this run)
//
// Usage:
//   node --experimental-strip-types scripts/generate-weekly-post.ts
//   node --experimental-strip-types scripts/generate-weekly-post.ts --slug existing-slug   # retroactive regenerate
//
// Env vars (loaded from .env.local if present):
//   ANTHROPIC_API_KEY                  — required
//   BRAVE_SEARCH_API_KEY               — optional (SERP context degrades silently without)
//   NEXT_PUBLIC_SUPABASE_URL           — optional (data injection skipped without)
//   SUPABASE_SERVICE_ROLE_KEY          — optional (data injection skipped without)
//   AUTO_PUBLISH_WEEKLY_POSTS          — "false" → still write to _pending/; default true
//   WEEKLY_POST_WEBHOOK_URL            — optional; POSTed on success AND on 3-strike failure

import fs from "node:fs";
import path from "node:path";
import {
  GenerationFailedAfterRetries,
  generateWeeklyPost,
  serializeDraft,
} from "../lib/seo/content-engine.ts";
import { parseStrategyDoc } from "../lib/seo/keyword-backlog.ts";

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

const AUTO_PUBLISH = process.env.AUTO_PUBLISH_WEEKLY_POSTS !== "false"; // default true
const POSTS_DIR = path.join(process.cwd(), "app", "blog", "posts");
const PENDING_DIR = path.join(POSTS_DIR, "_pending");
fs.mkdirSync(POSTS_DIR, { recursive: true });
if (!AUTO_PUBLISH) fs.mkdirSync(PENDING_DIR, { recursive: true });

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function listShippedSlugs(): Set<string> {
  const shipped = new Set<string>();
  for (const entry of fs.readdirSync(POSTS_DIR, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".mdx") && !entry.name.startsWith("_")) {
      shipped.add(entry.name.replace(/\.mdx$/, ""));
    }
  }
  return shipped;
}

function uniqueSlug(slug: string, taken: Set<string>): string {
  if (!taken.has(slug)) return slug;
  for (let i = 2; i < 20; i++) {
    const candidate = `${slug}-v${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`Could not find unique slug variant for ${slug}`);
}

async function postWebhook(payload: object): Promise<void> {
  const url = process.env.WEEKLY_POST_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.warn(`[webhook] POST → HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[webhook] failed: ${(err as Error).message}`);
  }
}

// --slug <existing-slug> → force retroactive regeneration of that topic
function parseSlugArg(): string | null {
  const idx = process.argv.indexOf("--slug");
  return idx >= 0 ? process.argv[idx + 1] ?? null : null;
}

async function loadDataClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("[generate] Supabase env vars not set — data injection disabled");
    return undefined;
  }
  const { supabaseAdmin } = await import("../lib/supabase/admin.ts");
  return supabaseAdmin();
}

const today = isoToday();
const forceSlug = parseSlugArg();

console.log(`[generate] today=${today} auto-publish=${AUTO_PUBLISH} force-slug=${forceSlug ?? "(auto-pick)"}`);

const shipped = listShippedSlugs();

let forceCandidate;
if (forceSlug) {
  const strategyDoc = fs.readFileSync(path.join(process.cwd(), "docs", "seo-strategy.md"), "utf8");
  forceCandidate = parseStrategyDoc(strategyDoc).find((c) => c.slug === forceSlug);
  if (!forceCandidate) {
    console.error(`No candidate found in docs/seo-strategy.md with slug "${forceSlug}".`);
    console.error("Available slugs:", parseStrategyDoc(strategyDoc).map((c) => c.slug).slice(0, 20).join(", "), "...");
    process.exit(1);
  }
  // For retroactive regenerate, exclude the slug from shipped so the engine
  // doesn't think it's a duplicate
  shipped.delete(forceSlug);
}

const dataClient = await loadDataClient();

let result;
try {
  result = await generateWeeklyPost({
    shippedSlugs: shipped,
    today,
    forceCandidate,
    braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY,
    dataClient,
  });
} catch (err) {
  if (err instanceof GenerationFailedAfterRetries) {
    console.error("");
    console.error("================================================================");
    console.error(`  FAILED after ${err.attempts} attempts — skipping this run`);
    console.error("================================================================");
    for (const f of err.lastFailures) console.error(`  - ${f}`);
    console.error("================================================================");
    await postWebhook({
      event: "generation_failed",
      attempts: err.attempts,
      failures: err.lastFailures,
      date: today,
    });
    process.exit(2); // 2 = quality-gate exhaustion (workflow doesn't commit)
  }
  throw err;
}

// Resolve final slug (handle conflicts with -v2, -v3 suffix)
const taken = listShippedSlugs();
if (forceSlug) taken.delete(forceSlug); // we're explicitly replacing it
const finalSlug = uniqueSlug(result.draft.slug, taken);
if (finalSlug !== result.draft.slug) {
  console.log(`[generate] slug "${result.draft.slug}" already exists — publishing as "${finalSlug}"`);
  result.draft.slug = finalSlug;
}

const outDir = AUTO_PUBLISH ? POSTS_DIR : PENDING_DIR;
const outPath = path.join(outDir, `${finalSlug}.mdx`);
fs.writeFileSync(outPath, serializeDraft(result.draft));

const previewUrl = `https://foil-rosy.vercel.app/blog/${finalSlug}`;

console.log("");
console.log("================================================================");
console.log(`  Published → ${path.relative(process.cwd(), outPath)}`);
console.log("================================================================");
console.log(`  Title          : ${result.draft.frontmatter.title}`);
console.log(`  Slug           : ${finalSlug}`);
console.log(`  Target keyword : ${result.draft.frontmatter.primaryKeyword}`);
console.log(`  Pillar         : /${result.draft.frontmatter.pillar}`);
console.log(`  Word count     : ${result.draft.wordCount} body words + ${result.draft.faq.length} FAQs`);
console.log(`  Generator      : ${result.attempts} attempt(s), all gates passed`);
console.log(`  SERP context   : ${result.serpContext ? (result.serpContext.degraded ? `degraded (${result.serpContext.degradationReason})` : `${result.serpContext.topResults.length} results, ${result.serpContext.topOutlines.length} outlines`) : "skipped"}`);
console.log(`  Foil data      : scans=${result.dataSnapshot.totalScans?.count ?? "n/a"} waitlist=${result.dataSnapshot.waitlistTotal ?? "n/a"}`);
console.log(`  Preview URL    : ${previewUrl}`);
console.log("================================================================");

await postWebhook({
  event: "post_published",
  title: result.draft.frontmatter.title,
  slug: finalSlug,
  pillar: result.draft.frontmatter.pillar,
  primaryKeyword: result.draft.frontmatter.primaryKeyword,
  wordCount: result.draft.wordCount,
  attempts: result.attempts,
  previewUrl,
  publishedPath: outPath,
});
