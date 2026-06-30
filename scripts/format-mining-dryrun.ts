// Local content-intelligence dry-run (ADR-087). Runs the same sweep as the cron
// — read the niche, rank engagement-RATE outliers, extract winning FORMATS,
// generate gate-valid Foil posts that use those formats with Foil's real data —
// and writes the brief to docs/content-intelligence/{date}.md for review on
// John's machine. NEVER posts to X (there is no X-write path in the sweep) and
// does not require the cron to be enabled.
//
// Run: node --experimental-strip-types --no-warnings --env-file=.env.local scripts/format-mining-dryrun.ts

import fs from "node:fs";
import path from "node:path";
import { searchRecent } from "../lib/social/x-client.ts";
import { getMarketMovers } from "../lib/deals/market-movers-read.ts";
import { anthropic } from "../lib/anthropic.ts";
import { CONTENT_MODEL } from "../lib/seo/content-engine.ts";
import {
  FORMAT_MINING_QUERIES,
  extractPatterns,
  runFormatMiningSweep,
  type FormatCardData,
} from "../lib/engagement/format-mining.ts";
import { generateFormatPost } from "../lib/social/format-generation.ts";
import { renderFormatMiningChunks } from "../lib/engagement/format-brief.ts";

// Fallback .env.local load (so it also works without --env-file).
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function claudeGenerate(prompt: string): Promise<string> {
  const message = await anthropic().messages.create({
    model: CONTENT_MODEL,
    max_tokens: 900,
    messages: [{ role: "user", content: prompt }],
  });
  const block = message.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

async function claudeGenerateSystem(system: string, user: string): Promise<string> {
  const message = await anthropic().messages.create({
    model: CONTENT_MODEL,
    max_tokens: 400,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = message.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

function cardDataFromMovers(
  rows: Array<{ cardSlug: string; cardName: string; setName: string; avg7d: number | null; avg30d: number | null; momentumPct: number; saleCount: number }>,
): FormatCardData[] {
  return rows
    .filter((r) => typeof r.avg7d === "number" && typeof r.avg30d === "number")
    .map((r) => ({
      slug: r.cardSlug,
      cardName: r.cardName,
      setName: r.setName,
      avg7dUsd: r.avg7d as number,
      avg30dUsd: r.avg30d as number,
      momentumPct: r.momentumPct,
      saleCount: r.saleCount,
    }));
}

const result = await runFormatMiningSweep({
  queries: FORMAT_MINING_QUERIES,
  ownUsername: "Johnnycakx",
  maxOutliers: 12,
  maxGenerated: 3,
  search: async (q) => {
    const r = await searchRecent(q, { maxResults: 50 });
    return r.ok ? r.posts : [];
  },
  extract: (outliers) => extractPatterns(outliers, { generate: claudeGenerate }),
  getCardData: async () => {
    const m = await getMarketMovers(60);
    return cardDataFromMovers([...m.down, ...m.up]);
  },
  generatePost: (pattern, data) => generateFormatPost(pattern, data, { generate: claudeGenerateSystem }),
});

const dateLabel = new Date().toISOString().slice(0, 10);
const chunks = renderFormatMiningChunks(result, { dateLabel });
const outDir = path.join("docs", "content-intelligence");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${dateLabel}.md`);
fs.writeFileSync(outPath, chunks.join("\n\n---\n\n") + "\n", "utf8");

console.log(
  `[format-mining] scanned ${result.scanned}, outliers ${result.outliers.length}, patterns ${result.patterns.length}, generated ${result.generated.length}`,
);
console.log(`[format-mining] brief written to ${outPath} (DRY-RUN — nothing posted to X)`);
