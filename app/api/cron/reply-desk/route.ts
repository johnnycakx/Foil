// Reply-desk cron (x-reply-desk, ADR-107 §1 — the eve-detector). 3x/day at
// collector-active hours: poll X for USER-INITIATED CONTACT (mentions of
// @FoilTCG + replies in our threads), dedupe against reply_desk_items, draft a
// reply for each fresh inbound reusing the receipts engine's guardrails, and
// enqueue it. The foil-bot drains the queue and posts each with Reply / Edit /
// Skip buttons; the API-post happens only on Approve (app/api/reply-desk/approve).
//
// READ + DRAFT + ENQUEUE only — this route NEVER posts to X. SAFE BY DEFAULT:
// REPLY_DESK_ENABLED must be "true" or it's a no-op. Auth: Bearer CRON_SECRET.
// Soft-fails everywhere.

import { NextResponse } from "next/server";
import { searchRecent } from "@/lib/social/x-client";
import { getMoverBySlug } from "@/lib/deals/market-movers-read";
import { getSnapshotSold } from "@/lib/vault-seeds";
import { getReceiptFacts } from "@/lib/receipts/facts";
import { draftReceiptsProse } from "@/lib/receipts/draft";
import { REPLY_DESK_UTM } from "@/lib/receipts/intent";
import type { ReceiptsEngineDeps } from "@/lib/receipts/engine";
import { resolveCardSlug } from "@/lib/engagement/card-resolver";
import { enqueueHydrationIfNeeded } from "@/lib/poketrace/hydration";
import { runReplyDesk } from "@/lib/reply-desk/desk";
import { draftInboundReply, type DraftInboundDeps } from "@/lib/reply-desk/draft";
import { supabaseReplyDeskQueue } from "@/lib/reply-desk/queue";
import { anthropic } from "@/lib/anthropic";
import { CONTENT_MODEL } from "@/lib/seo/content-engine";
import { postWebhook } from "@/lib/notifications/discord";
import { siteUrl } from "@/lib/seo/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The account our X creds authenticate as — never surface our OWN posts as
// inbound (verified 2026-06-30 via GET /2/users/me → "FoilTCG").
const OWN_USERNAME = "FoilTCG";

async function claudeGenerate(prompt: string): Promise<string> {
  const message = await anthropic().messages.create({
    model: CONTENT_MODEL,
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });
  const block = message.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!expected || header !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if ((process.env.REPLY_DESK_ENABLED ?? "").trim().toLowerCase() !== "true") {
    return NextResponse.json({ ok: true, reason: "disabled" });
  }

  const receipts: ReceiptsEngineDeps = {
    resolve: resolveCardSlug,
    getFacts: (slug, displayName) =>
      getReceiptFacts(slug, displayName, {
        mover: (s) => getMoverBySlug(s),
        snapshot: (s) => getSnapshotSold(s),
      }),
    draftProse: (input) => draftReceiptsProse(input, { generate: claudeGenerate }),
    origin: siteUrl(),
    utm: REPLY_DESK_UTM,
  };
  const draftDeps: DraftInboundDeps = {
    receipts,
    enqueueHydration: async (slug) => {
      await enqueueHydrationIfNeeded(slug);
    },
  };

  try {
    const run = await runReplyDesk({
      search: async (q) => {
        const r = await searchRecent(q, { maxResults: 30 });
        return r.ok ? r.posts : [];
      },
      queue: supabaseReplyDeskQueue(),
      draftInbound: draftInboundReply,
      draftDeps,
      ownUsername: OWN_USERNAME,
    });

    const webhook = process.env.DISCORD_WEBHOOK_CONTENT_ENGINE;
    const dateLabel = new Date().toISOString().slice(0, 10);
    if (webhook) {
      if (run.queued > 0) {
        await postWebhook({
          webhookUrl: webhook,
          content:
            `📮 **Reply desk — ${dateLabel}** · ${run.queued} inbound queued ` +
            `(scanned ${run.scanned}). Posting to this channel with **Reply / Edit / Skip** buttons. ` +
            `Reply API-posts your Approve'd response in-thread (user-initiated contact only).`,
        });
      } else {
        await postWebhook({ webhookUrl: webhook, content: `📮 Reply desk — ${dateLabel}: no new mentions or replies.` });
      }
    }

    return NextResponse.json({ ok: true, scanned: run.scanned, fresh: run.fresh, drafted: run.drafted, queued: run.queued });
  } catch (err) {
    console.error("[reply-desk] cron failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: (err as Error).message });
  }
}
