// Daily X engagement-brief cron (ADR-086). READ + DRAFT + DELIVER only — the
// engine NEVER takes an X action. It pulls recent buy/value-intent posts (X
// recent-search, read-only), drafts a real-sold-data reply for each, and posts a
// ranked, deep-linked brief to Discord #content-engine. John reviews + posts
// every reply BY HAND. The human send is the ToS + brand firewall.
//
// SAFE BY DEFAULT: ENGAGEMENT_BRIEF_ENABLED must be "true" or it's a no-op (the
// code can deploy without ever scanning/spending). Auth: Bearer CRON_SECRET.
// Soft-fails everywhere — a bad query, a failed draft, or a Discord outage never
// 500s and never blocks the rest.

import { NextResponse } from "next/server";
import { searchRecent } from "@/lib/social/x-client";
import { getMarketMovers } from "@/lib/deals/market-movers-read";
import { anthropic } from "@/lib/anthropic";
import { CONTENT_MODEL } from "@/lib/seo/content-engine";
import { ENGAGEMENT_QUERIES } from "@/lib/engagement/queries";
import { generateEngagementBrief } from "@/lib/engagement/brief-engine";
import { draftReply, type MoverFact } from "@/lib/engagement/draft";
import { supabaseBriefStore } from "@/lib/engagement/store";
import { renderEngagementBriefChunks } from "@/lib/engagement/render";
import { postWebhook } from "@/lib/notifications/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWN_USERNAME = "Johnnycakx";

/** Claude drafting call — short reply; soft-fail returns "" so draftReply skips. */
async function claudeGenerate(prompt: string): Promise<string> {
  const message = await anthropic().messages.create({
    model: CONTENT_MODEL,
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });
  const block = message.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

/** market_movers → the figures a reply may cite (only rows with real averages). */
function factsFromMovers(rows: Array<{ cardName: string; avg7d: number | null; avg30d: number | null; momentumPct: number; saleCount: number }>): MoverFact[] {
  return rows
    .filter((r) => typeof r.avg7d === "number" && typeof r.avg30d === "number")
    .map((r) => ({
      cardName: r.cardName,
      avg7dUsd: r.avg7d as number,
      avg30dUsd: r.avg30d as number,
      momentumPct: r.momentumPct,
      sampleSize: r.saleCount,
    }));
}

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!expected || header !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if ((process.env.ENGAGEMENT_BRIEF_ENABLED ?? "").trim().toLowerCase() !== "true") {
    return NextResponse.json({ ok: true, reason: "disabled" });
  }

  try {
    const brief = await generateEngagementBrief({
      queries: ENGAGEMENT_QUERIES,
      ownUsername: OWN_USERNAME,
      nowMs: Date.now(),
      maxItems: 20,
      store: supabaseBriefStore(),
      search: async (q) => {
        const r = await searchRecent(q, { maxResults: 30 });
        return r.ok ? r.posts : [];
      },
      getFacts: async () => {
        const m = await getMarketMovers(60);
        return factsFromMovers([...m.down, ...m.up]);
      },
      draft: (post, facts) => draftReply({ post, facts }, { generate: claudeGenerate }),
    });

    const webhook = process.env.DISCORD_WEBHOOK_CONTENT_ENGINE;
    const dateLabel = new Date().toISOString().slice(0, 10);
    const chunks = renderEngagementBriefChunks(brief, { dateLabel });

    if (!webhook) {
      console.warn("[engagement] DISCORD_WEBHOOK_CONTENT_ENGINE unset — brief generated but not delivered");
    } else if (chunks.length === 0) {
      await postWebhook({ webhookUrl: webhook, content: `🧵 X engagement brief — ${dateLabel}: no new qualifying posts today.` });
    } else {
      // Sequential so Discord shows them in order; soft-fail per chunk.
      for (const chunk of chunks) await postWebhook({ webhookUrl: webhook, content: chunk });
    }

    return NextResponse.json({ ok: true, scanned: brief.scanned, candidates: brief.candidates, delivered: brief.items.length });
  } catch (err) {
    console.error("[engagement] cron failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: (err as Error).message });
  }
}
