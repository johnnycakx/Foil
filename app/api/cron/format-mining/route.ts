// Content-intelligence sweep cron (ADR-087). READ + RANK + EXTRACT + GENERATE +
// DRY-RUN PREVIEW only — this NEVER posts to X. It reads the niche via the
// read-only recent-search boundary, ranks engagement-RATE outliers, extracts the
// winning FORMATS (the container), generates Foil posts that use those formats in
// Foil's voice with Foil's real sold-data (the soul, gate-validated), and posts a
// "what's working" brief + the dry-run previews to Discord #content-engine. John
// eyeballs them before they could ever enter the live X-post path.
//
// SAFE BY DEFAULT: FORMAT_MINING_ENABLED must be "true" or it's a no-op (the code
// deploys without ever scanning/spending). Auth: Bearer CRON_SECRET. Soft-fails
// everywhere — a bad query, a failed extraction, or a Discord outage never 500s.

import { NextResponse } from "next/server";
import { searchRecent } from "@/lib/social/x-client";
import { getMarketMovers } from "@/lib/deals/market-movers-read";
import { anthropic } from "@/lib/anthropic";
import { CONTENT_MODEL } from "@/lib/seo/content-engine";
import {
  FORMAT_MINING_QUERIES,
  extractPatterns,
  runFormatMiningSweep,
  type FormatCardData,
} from "@/lib/engagement/format-mining";
import { generateFormatPost } from "@/lib/social/format-generation";
import { renderFormatMiningChunks } from "@/lib/engagement/format-brief";
import { postWebhook } from "@/lib/notifications/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWN_USERNAME = "Johnnycakx";

/** Single-prompt Claude call (extraction). Soft-fail → "" so extract returns [].
 *  `max_tokens` is generous: 3-6 patterns × 7 prose fields easily exceeds ~900
 *  tokens, and a truncated array would parse to zero patterns (the parser also
 *  salvages complete objects, but headroom keeps the common case whole). */
async function claudeGenerate(prompt: string): Promise<string> {
  const message = await anthropic().messages.create({
    model: CONTENT_MODEL,
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });
  const block = message.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

/** System+user Claude call (generation). Soft-fail → "" so the gate loop retries. */
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

/** market_movers → the real card data a generated post may cite (rows with real
 *  7d AND 30d averages). Carries the slug as identity so the keep-the-soul gate
 *  enforces the correct card. */
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

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!expected || header !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if ((process.env.FORMAT_MINING_ENABLED ?? "").trim().toLowerCase() !== "true") {
    return NextResponse.json({ ok: true, reason: "disabled" });
  }

  try {
    const result = await runFormatMiningSweep({
      queries: FORMAT_MINING_QUERIES,
      ownUsername: OWN_USERNAME,
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
      // The soul: gate-validated own-post generation. Returns text only; never
      // posts to X (dry-run delivery below is the only output).
      generatePost: (pattern, data) =>
        generateFormatPost(pattern, data, { generate: claudeGenerateSystem }),
    });

    const webhook = process.env.DISCORD_WEBHOOK_CONTENT_ENGINE;
    const dateLabel = new Date().toISOString().slice(0, 10);
    if (webhook) {
      const chunks = renderFormatMiningChunks(result, { dateLabel });
      for (const chunk of chunks) await postWebhook({ webhookUrl: webhook, content: chunk });
    } else {
      console.warn("[format-mining] DISCORD_WEBHOOK_CONTENT_ENGINE unset — sweep ran but not delivered");
    }

    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      outliers: result.outliers.length,
      patterns: result.patterns.length,
      generated: result.generated.length,
    });
  } catch (err) {
    console.error("[format-mining] cron failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: (err as Error).message });
  }
}
