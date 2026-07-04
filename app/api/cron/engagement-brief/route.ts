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
import { draftReply, draftAdvisoryReply, type MoverFact } from "@/lib/engagement/draft";
import { supabaseBriefStore } from "@/lib/engagement/store";
import { supabaseBriefQueue } from "@/lib/engagement/brief-queue";
import { renderEngagementBriefChunks } from "@/lib/engagement/render";
import { isPriceClaim } from "@/lib/engagement/candidate-filter";
import { resolveCardSlug } from "@/lib/engagement/card-resolver";
import { buildReplyIntentUrl, buildQuoteIntentUrl, buildCardPageUrl, tweetLength, REPLY_DESK_UTM } from "@/lib/receipts/intent";
import { postWebhook } from "@/lib/notifications/discord";
import { siteUrl } from "@/lib/seo/site-url";
import type { EngagementBriefItem } from "@/lib/engagement/brief-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Self-exclusion username: must equal the account the X API creds authenticate
// as (so the sweep never surfaces our OWN posts as reply candidates). Verified
// 2026-06-30 via GET /2/users/me on the live tokens → "FoilTCG" (the account
// formerly @Johnnycakx, renamed once the X handle review cleared; same user id).
const OWN_USERNAME = "FoilTCG";

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

/** market_movers → the figures a reply may cite (only rows with real averages).
 *  Carries `cardSlug` as the identity so the draft step matches the post's
 *  resolved card BY SLUG, never by name (the wrong-card-citation fix). */
function factsFromMovers(
  rows: Array<{ cardSlug: string; cardName: string; avg7d: number | null; avg30d: number | null; momentumPct: number; saleCount: number }>,
): MoverFact[] {
  return rows
    .filter((r) => typeof r.avg7d === "number" && typeof r.avg30d === "number")
    .map((r) => ({
      slug: r.cardSlug,
      cardName: r.cardName,
      avg7dUsd: r.avg7d as number,
      avg30dUsd: r.avg30d as number,
      momentumPct: r.momentumPct,
      sampleSize: r.saleCount,
    }));
}

/** The one-tap composer URL for a brief item (§2a/§3c). A price-claim data-cite
 *  → a QUOTE tweet carrying the reply + the card link (receipts on the claim);
 *  everything else → a threaded reply-intent. Cold lane: the human posts it. */
function buildItemIntentUrl(it: EngagementBriefItem): string {
  if (it.mode === "data_cite" && isPriceClaim(it.postText)) {
    const resolved = resolveCardSlug(it.postText);
    const cardUrl = resolved ? buildCardPageUrl(resolved.slug, { origin: siteUrl(), utm: REPLY_DESK_UTM }) : null;
    // Append the card link (the receipts) when it still fits a tweet; else the
    // bare reply (never a truncated figure).
    const qtText = cardUrl && tweetLength(`${it.reply} ${cardUrl}`) <= 280 ? `${it.reply} ${cardUrl}` : it.reply;
    return buildQuoteIntentUrl(qtText, it.postUrl);
  }
  return buildReplyIntentUrl(it.reply, it.postId);
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
      // Advisory fallback (ADR-086 v2): a high-reach post with no resolvable
      // specific card gets a value-first, figure-free reply (a natural Foil
      // mention, never a bare link). Carries no $ figure → wrong-card-proof.
      draftAdvisory: (post) => draftAdvisoryReply({ post }, { generate: claudeGenerate }),
    });

    const webhook = process.env.DISCORD_WEBHOOK_CONTENT_ENGINE;
    const dateLabel = new Date().toISOString().slice(0, 10);

    // DELIVERY (ADR-086 v2): the bot posts the actionable cards (with Skip/Post
    // buttons) by draining this queue — a standard channel webhook can't carry
    // interactive buttons. Persist the items; on success post a one-line webhook
    // summary (visibility). If the queue write fails, FALL BACK to the full
    // rendered webhook brief so John still gets actionable content (no buttons)
    // — graceful degradation, never a silent loss.
    // Cold-lane friction fix (§2a/§3c): attach a one-tap intent URL to each item.
    // A price-claim data-cite becomes a QT-with-receipts (quote the claim + the
    // card link); everything else is a threaded reply-intent. The human still
    // presses X's Post — the intent URL only opens the composer prefilled.
    const withIntent: EngagementBriefItem[] = brief.items.map((it) => ({
      ...it,
      intentUrl: buildItemIntentUrl(it),
    }));

    let queued = 0;
    if (withIntent.length > 0) {
      queued = await supabaseBriefQueue().enqueue(withIntent);
    }

    if (!webhook) {
      console.warn("[engagement] DISCORD_WEBHOOK_CONTENT_ENGINE unset — brief generated but not delivered");
    } else if (brief.items.length === 0) {
      await postWebhook({ webhookUrl: webhook, content: `🧵 X engagement brief — ${dateLabel}: no new qualifying posts today.` });
    } else if (queued > 0) {
      await postWebhook({
        webhookUrl: webhook,
        content:
          `🧵 **X engagement brief — ${dateLabel}** · ${queued} ranked post${queued === 1 ? "" : "s"} ` +
          `posting to this channel with **Skip / Post** buttons. **Post replies BY HAND on X** (the engine never posts). ` +
          `Scanned ${brief.scanned}, ${brief.candidates} candidates.`,
      });
    } else {
      // Queue write failed → degrade to the full text brief (no buttons).
      console.warn("[engagement] queue enqueue returned 0 — falling back to webhook brief");
      const chunks = renderEngagementBriefChunks(brief, { dateLabel });
      for (const chunk of chunks) await postWebhook({ webhookUrl: webhook, content: chunk });
    }

    return NextResponse.json({ ok: true, scanned: brief.scanned, candidates: brief.candidates, delivered: brief.items.length, queued });
  } catch (err) {
    console.error("[engagement] cron failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: (err as Error).message });
  }
}
