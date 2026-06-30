// Engagement-brief delivery queue (ADR-086 v2). The Vercel cron computes the
// brief and ENQUEUES one row per drafted item into the isolated, service-role-only
// Supabase table `engagement_brief_items`; the foil-bot drains + posts each with
// Skip/Post buttons (a standard channel webhook can't carry interactive buttons,
// and a click only routes to the app that owns the message — so the bot, not the
// webhook, must post the brief). This module is the WRITE half (the cron side);
// the bot owns the read/drain/decide half in `bot/src/engagement/queue.ts`.
//
// READ + DRAFT + ENQUEUE only — nothing here (or anywhere in lib/engagement/)
// takes an X action; the zero-X-write invariant test pins that.
//
// Injectable so the cron's enqueue is unit-tested with a fake. Soft-fail: a
// persistence error never throws (the cron falls back to the webhook brief).

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase/admin.ts";
import type { EngagementBriefItem } from "./brief-engine.ts";

export type BriefQueue = {
  /** Insert the drafted items as undelivered queue rows. Idempotent on post_id
   *  (a re-run never duplicates). Returns the number persisted (0 on error). */
  enqueue: (items: EngagementBriefItem[]) => Promise<number>;
};

/** Map a brief item to its queue-row shape (snake_case columns). Pure. */
export function toQueueRow(item: EngagementBriefItem): Record<string, unknown> {
  return {
    post_id: item.postId,
    post_url: item.postUrl,
    post_text: item.postText,
    author_username: item.authorUsername,
    mode: item.mode,
    matched_card: item.matchedCard || null,
    reply: item.reply,
    data_cited: item.dataCited ?? "",
    score: item.score ?? 0,
  };
}

/** Default queue: the isolated Supabase table via the service-role client. */
export function supabaseBriefQueue(): BriefQueue {
  return {
    async enqueue(items) {
      const rows = items.map(toQueueRow);
      if (rows.length === 0) return 0;
      try {
        const db = supabaseAdmin() as unknown as SupabaseClient;
        const { error } = await db
          .from("engagement_brief_items")
          .upsert(rows, { onConflict: "post_id", ignoreDuplicates: true });
        if (error) {
          console.warn(`[engagement] enqueue failed: ${error.message}`);
          return 0;
        }
        return rows.length;
      } catch (err) {
        console.warn(`[engagement] enqueue threw: ${(err as Error).message}`);
        return 0;
      }
    },
  };
}
