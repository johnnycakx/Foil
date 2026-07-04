// Engagement-brief delivery queue — the BOT (read/drain/decide) half of ADR-086
// v2. The Vercel cron enqueues drafted items into the isolated, service-role-only
// `engagement_brief_items` table; the bot drains undelivered rows, posts each to
// #content-engine with Skip/Post buttons, marks them posted, and records John's
// button decision (a learning signal).
//
// ZERO-X-WRITE: nothing here touches X. The Post button (handler.ts) only surfaces
// the already-drafted reply text + a deep link; John posts every reply by hand.
//
// All functions take an injected SupabaseClient so they're unit-tested with a fake.

import type { SupabaseClient } from "@supabase/supabase-js";

export type BriefItemRow = {
  post_id: string;
  post_url: string;
  post_text: string;
  author_username: string | null;
  mode: "data_cite" | "advisory" | string;
  matched_card: string | null;
  reply: string;
  data_cited: string;
  score: number;
  /** The prefilled x.com/intent/post URL (x-reply-desk §2a/§3c) — one tap opens
   *  X's composer prefilled + threaded (reply) or quoting the claim (QT). Null on
   *  legacy rows → the handler falls back to the deep link. */
  intent_url: string | null;
};

const TABLE = "engagement_brief_items";
const SELECT_COLS = "post_id, post_url, post_text, author_username, mode, matched_card, reply, data_cited, score, intent_url";

/** Undelivered items (not yet posted to Discord), oldest first. Soft-fail → []. */
export async function fetchUndelivered(client: SupabaseClient, limit = 25): Promise<BriefItemRow[]> {
  const { data, error } = await client
    .from(TABLE)
    .select(SELECT_COLS)
    .is("posted_to_discord_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.warn("[engagement] fetchUndelivered failed:", error.message);
    return [];
  }
  return (data ?? []) as BriefItemRow[];
}

/** Fetch one item by post id (for the Post button's copy-ready text). Null on miss. */
export async function getItem(client: SupabaseClient, postId: string): Promise<BriefItemRow | null> {
  const { data, error } = await client.from(TABLE).select(SELECT_COLS).eq("post_id", postId).maybeSingle();
  if (error) {
    console.warn("[engagement] getItem failed:", error.message);
    return null;
  }
  return (data ?? null) as BriefItemRow | null;
}

/** Mark an item as posted to Discord (so the poller never re-posts it). */
export async function markPosted(client: SupabaseClient, postId: string): Promise<void> {
  const { error } = await client
    .from(TABLE)
    .update({ posted_to_discord_at: new Date().toISOString() })
    .eq("post_id", postId);
  if (error) console.warn("[engagement] markPosted failed:", error.message);
}

export type DecisionResult = { ok: boolean; alreadyDecided: boolean };

/**
 * Record John's button decision ('skipped' | 'posted_by_hand'). IDEMPOTENT: the
 * update is gated on `decision IS NULL`, so a second click flips zero rows and is
 * reported via `alreadyDecided` (never an error, never a double-write). This is a
 * learning signal only — the post is already excluded from future briefs by the
 * cron's `engagement_briefed_posts` write, independent of this decision.
 */
export async function recordDecision(
  client: SupabaseClient,
  postId: string,
  decision: "skipped" | "posted_by_hand",
): Promise<DecisionResult> {
  const { data, error } = await client
    .from(TABLE)
    .update({ decision, decided_at: new Date().toISOString() })
    .eq("post_id", postId)
    .is("decision", null)
    .select("post_id");
  if (error) {
    console.warn("[engagement] recordDecision failed:", error.message);
    return { ok: false, alreadyDecided: false };
  }
  const changed = (data ?? []).length;
  return { ok: true, alreadyDecided: changed === 0 };
}
