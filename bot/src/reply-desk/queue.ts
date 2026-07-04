// Reply-desk delivery queue — the BOT (read/drain) half of ADR-107 §1. The
// Vercel cron enqueues inbound (mentions + replies to us) into the isolated,
// service-role-only `reply_desk_items` table; the bot drains undelivered rows,
// posts each to the reply-desk channel with Reply / Edit / Skip buttons, and
// marks them delivered. The DECISION (post/skip) is relayed to the app's
// /api/reply-desk/approve endpoint — the single X boundary lives there; the bot
// never calls the X API itself.
//
// All functions take an injected SupabaseClient so they're unit-tested with a fake.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ReplyDeskItemRow = {
  post_id: string;
  post_url: string;
  post_text: string;
  author_username: string | null;
  author_followers: number | null;
  inbound_kind: string;
  our_context: string | null;
  has_media: boolean;
  mode: "data_cite" | "intake" | "advisory" | "human_look" | string;
  matched_card: string | null;
  matched_slug: string | null;
  reply: string;
  card_page_url: string | null;
  data_cited: string;
  score: number;
  status: string;
};

const TABLE = "reply_desk_items";
const SELECT_COLS =
  "post_id, post_url, post_text, author_username, author_followers, inbound_kind, our_context, has_media, mode, matched_card, matched_slug, reply, card_page_url, data_cited, score, status";

/** Undelivered items (not yet posted to Discord), oldest first. Soft-fail → []. */
export async function fetchUndelivered(client: SupabaseClient, limit = 25): Promise<ReplyDeskItemRow[]> {
  const { data, error } = await client
    .from(TABLE)
    .select(SELECT_COLS)
    .is("posted_to_discord_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.warn("[reply-desk] fetchUndelivered failed:", error.message);
    return [];
  }
  return (data ?? []) as ReplyDeskItemRow[];
}

/** One item by post id (for the Edit modal prefill + card details). Null on miss. */
export async function getItem(client: SupabaseClient, postId: string): Promise<ReplyDeskItemRow | null> {
  const { data, error } = await client.from(TABLE).select(SELECT_COLS).eq("post_id", postId).maybeSingle();
  if (error) {
    console.warn("[reply-desk] getItem failed:", error.message);
    return null;
  }
  return (data ?? null) as ReplyDeskItemRow | null;
}

/** Mark an item posted to Discord (so the poller never re-posts it). */
export async function markPostedToDiscord(client: SupabaseClient, postId: string): Promise<void> {
  const { error } = await client
    .from(TABLE)
    .update({ posted_to_discord_at: new Date().toISOString() })
    .eq("post_id", postId);
  if (error) console.warn("[reply-desk] markPostedToDiscord failed:", error.message);
}

/** Unactioned cards (status pending), highest-reach first — the /pending backstop. */
export async function listPending(client: SupabaseClient, limit = 25): Promise<ReplyDeskItemRow[]> {
  const { data, error } = await client
    .from(TABLE)
    .select(SELECT_COLS)
    .eq("status", "pending")
    .order("score", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[reply-desk] listPending failed:", error.message);
    return [];
  }
  return (data ?? []) as ReplyDeskItemRow[];
}
