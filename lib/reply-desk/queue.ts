// Reply-desk queue — the WRITE + dedupe half (the cron side) of ADR-107 §1.
// The Vercel cron polls X, dedupes against `reply_desk_items` (post_id PK), and
// enqueues one row per inbound; the foil-bot drains undelivered rows and posts
// each with Reply / Edit / Skip buttons. The bot owns the read/drain/decide half
// (bot/src/reply-desk/queue.ts) + the approve endpoint owns the API-post.
//
// READ + DRAFT + ENQUEUE only — nothing here posts to X. Injectable client so
// the cron's dedupe/enqueue is unit-tested with a fake. Soft-fail throughout.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase/admin.ts";
import type { ReplyDeskMode, InboundKind } from "./draft.ts";

export type ReplyDeskItem = {
  postId: string;
  postUrl: string;
  postText: string;
  authorUsername: string | null;
  authorFollowers: number | null;
  inboundKind: InboundKind;
  ourContext: string | null;
  hasMedia: boolean;
  mode: ReplyDeskMode;
  matchedCard: string | null;
  matchedSlug: string | null;
  reply: string;
  cardPageUrl: string | null;
  dataCited: string;
  score: number;
};

const TABLE = "reply_desk_items";

/** Map a queue item to its DB row (snake_case columns). Pure. */
export function toReplyDeskRow(item: ReplyDeskItem): Record<string, unknown> {
  return {
    post_id: item.postId,
    post_url: item.postUrl,
    post_text: item.postText,
    author_username: item.authorUsername,
    author_followers: item.authorFollowers,
    inbound_kind: item.inboundKind,
    our_context: item.ourContext,
    has_media: item.hasMedia,
    mode: item.mode,
    matched_card: item.matchedCard,
    matched_slug: item.matchedSlug,
    reply: item.reply,
    card_page_url: item.cardPageUrl,
    data_cited: item.dataCited ?? "",
    score: item.score ?? 0,
  };
}

export type ReplyDeskQueue = {
  /** Of the given inbound ids, which are ALREADY queued (to skip re-drafting). */
  seenIds: (postIds: string[]) => Promise<Set<string>>;
  /** Insert the drafted items (idempotent on post_id). Returns count persisted. */
  enqueue: (items: ReplyDeskItem[]) => Promise<number>;
};

/** Default queue: the isolated Supabase table via the service-role client. */
export function supabaseReplyDeskQueue(): ReplyDeskQueue {
  return {
    async seenIds(postIds) {
      const ids = [...new Set(postIds.filter(Boolean))];
      if (ids.length === 0) return new Set();
      try {
        const db = supabaseAdmin() as unknown as SupabaseClient;
        const { data, error } = await db.from(TABLE).select("post_id").in("post_id", ids);
        if (error) {
          console.warn(`[reply-desk] seenIds failed: ${error.message}`);
          return new Set();
        }
        return new Set((data ?? []).map((r) => (r as { post_id: string }).post_id));
      } catch (err) {
        console.warn(`[reply-desk] seenIds threw: ${(err as Error).message}`);
        return new Set();
      }
    },
    async enqueue(items) {
      const rows = items.map(toReplyDeskRow);
      if (rows.length === 0) return 0;
      try {
        const db = supabaseAdmin() as unknown as SupabaseClient;
        const { error } = await db.from(TABLE).upsert(rows, { onConflict: "post_id", ignoreDuplicates: true });
        if (error) {
          console.warn(`[reply-desk] enqueue failed: ${error.message}`);
          return 0;
        }
        return rows.length;
      } catch (err) {
        console.warn(`[reply-desk] enqueue threw: ${(err as Error).message}`);
        return 0;
      }
    },
  };
}
