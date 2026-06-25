// "Good buys this week" newsletter digest generator (ADR-069).
//
// Reads the precomputed market_movers cache (populated daily by
// /api/cron/market-movers) and writes a paste-ready Markdown digest to
// docs/newsletter-drafts/. This is the source for newsletter issue #1 and the
// recurring digest. DETERMINISTIC: no LLM, every figure is a real PokeTrace
// aggregate (serializeMoversDigest asserts the honesty structurally).
//
// Drafts NEVER auto-send. John copies the body into Beehiiv manually (free-tier
// send API is blocked). This script only writes the artifact.
//
// Run from the repo root:
//   node --experimental-strip-types scripts/generate-movers-digest.ts
//
// Env (loaded from .env.local if present):
//   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  — required (read cache)
//   NEXT_PUBLIC_SITE_URL                                  — optional (link origin)

import fs from "node:fs";
import path from "node:path";

// Inline .env.local loader (same pattern as scripts/seed-watchlists.ts).
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[movers-digest] NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const { getMarketMovers } = await import("../lib/deals/market-movers-read.ts");
const { serializeMoversDigest } = await import("../lib/newsletter/movers-digest.ts");

const movers = await getMarketMovers(50);
const downN = movers.down.length;
const upN = movers.up.length;
console.log(`[movers-digest] read cache: ${downN} down, ${upN} up`);

if (downN === 0 && upN === 0) {
  console.warn(
    "[movers-digest] cache is empty. Run /api/cron/market-movers first (and confirm POKETRACE_API_KEY is live). Writing an honest 'no movers' digest anyway.",
  );
}

const generatedAt = new Date().toISOString();
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://foiltcg.com";
const markdown = serializeMoversDigest({ movers, generatedAt, siteUrl });

const outDir = path.join(process.cwd(), "docs", "newsletter-drafts");
fs.mkdirSync(outDir, { recursive: true });
const dateSlug = generatedAt.slice(0, 10);
const outPath = path.join(outDir, `good-buys-this-week-${dateSlug}.md`);
fs.writeFileSync(outPath, markdown, "utf8");

console.log(`[movers-digest] wrote ${path.relative(process.cwd(), outPath)} (${markdown.length} bytes)`);
