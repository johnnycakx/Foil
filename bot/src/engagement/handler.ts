// Engagement-brief button handler + delivery poller (ADR-086 v2).
//
// ============================ THE FIREWALL ============================
// NOTHING in this file posts/replies/likes/follows/DMs on X. The "Post"
// button does NOT post to X — it surfaces the already-drafted reply text +
// a deep link to the source post, and John posts it BY HAND. There is no X
// API call, no x-client import, no X-approval-endpoint relay, and no reply
// payload anywhere in this path. The zero-X-write invariant test reads this
// file as text and fails the build if any X write/engagement reference appears.
// =====================================================================
//
// The bot owns delivery because a standard Discord channel webhook can't carry
// interactive buttons and a click only routes to the app that owns the message.
// The poller drains the Supabase queue the Vercel cron fills, posts each item
// with Skip/Post buttons, and the handler records John's decision (idempotent).

import type { ButtonInteraction, Client, TextChannel } from "discord.js";
import { getClient } from "../db.ts";
import {
  fetchUndelivered,
  getItem,
  markPosted,
  recordDecision,
  type BriefItemRow,
} from "./queue.ts";
import { buildDecidedButtons, buildEngagementButtons, parseEngagementButtonId } from "./buttons.ts";
import { buildBriefEmbed } from "./render.ts";

const POLL_MS = 60_000;
const MAX_PER_DRAIN = 25;

/** Local owner gate (kept inline, NOT imported from the X-posting slash-command
 *  module, so this firewall file has zero coupling to any X-write path). */
function isOwner(userId: string, ownerId: string | undefined): boolean {
  return !!ownerId && userId === ownerId;
}

export type ButtonHandlerDeps = {
  getItem: (postId: string) => Promise<BriefItemRow | null>;
  recordDecision: (
    postId: string,
    decision: "skipped" | "posted_by_hand",
  ) => Promise<{ ok: boolean; alreadyDecided: boolean }>;
  ownerId?: string;
};

function defaultButtonDeps(): ButtonHandlerDeps {
  const db = getClient();
  return {
    getItem: (postId) => getItem(db, postId),
    recordDecision: (postId, decision) => recordDecision(db, postId, decision),
    ownerId: process.env.X_BOT_OWNER_DISCORD_ID,
  };
}

/**
 * Handle a Skip / Post button click on an engagement-brief card.
 *   - Not one of our buttons → ignore (return; another handler may own it).
 *   - Not the configured owner → ephemeral refusal (fail-closed; no owner id set
 *     = no one qualifies).
 *   - Skip  → record 'skipped' (idempotent learning signal), disable the row.
 *   - Post  → surface the copy-ready reply + a deep link (NO X action), record
 *     'posted_by_hand', disable the row. John posts the reply by hand on X.
 * Soft-fail: a DB miss never blocks the response.
 */
export async function handleEngagementButton(
  interaction: ButtonInteraction,
  deps?: ButtonHandlerDeps,
): Promise<void> {
  const parsed = parseEngagementButtonId(interaction.customId);
  if (!parsed) return; // not an engagement button — leave for other handlers
  const d = deps ?? defaultButtonDeps();

  if (!isOwner(interaction.user.id, d.ownerId)) {
    await interaction.reply({
      content: "Only the configured owner can action engagement-brief items.",
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (parsed.action === "skip") {
    const res = await d.recordDecision(parsed.postId, "skipped");
    await interaction.update({ components: [buildDecidedButtons(parsed.postId, "skipped")] }).catch(() => {});
    await interaction.followUp({
      content: res.alreadyDecided
        ? "Already actioned."
        : "Skipped. Recorded as a learning signal; this post won't resurface.",
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
    return;
  }

  // POST (cold lane): ONE TAP opens X's composer prefilled + threaded via the
  // stored intent URL (x-reply-desk §2a); John presses X's own Post. The bot
  // NEVER posts to X — an intent URL is a link a human clicks, not an API call.
  // The copy/paste path is gone. Legacy rows with no intent_url fall back to the
  // reply text + deep link so nothing is ever un-actionable.
  const item = await d.getItem(parsed.postId);
  const intentUrl = item?.intent_url?.trim() ?? "";
  const url = item?.post_url ?? "";
  await d.recordDecision(parsed.postId, "posted_by_hand");
  await interaction.update({ components: [buildDecidedButtons(parsed.postId, "posted_by_hand")] }).catch(() => {});
  const content = intentUrl
    ? `Tap to open X's composer prefilled, then press X's Post (the bot never posts):\n${intentUrl}` +
      (url ? `\n\n(The post you're replying to: ${url})` : "")
    : // legacy fallback (no stored intent URL)
      "Post this on X by hand (no prefilled link stored for this item):\n" +
      (item?.reply?.trim() || "(reply text not found — open the post and write it)") +
      (url ? `\n\nOpen the post: ${url}` : "");
  await interaction.followUp({ content: content.slice(0, 1900), ephemeral: true, allowedMentions: { parse: [] } });
}

export type DrainDeps = {
  fetchUndelivered: () => Promise<BriefItemRow[]>;
  send: (item: BriefItemRow) => Promise<void>;
  markPosted: (postId: string) => Promise<void>;
};

/**
 * Post every undelivered brief item once, marking each delivered. Pure
 * orchestration over injected IO (so it's unit-tested with fakes). Soft-fail per
 * item: a failed post leaves the row undelivered for the next tick. Returns the
 * count posted.
 */
export async function drainAndPostOnce(deps: DrainDeps): Promise<number> {
  const items = await deps.fetchUndelivered();
  let posted = 0;
  for (const item of items) {
    try {
      await deps.send(item);
      await deps.markPosted(item.post_id);
      posted++;
    } catch (err) {
      console.warn("[engagement] post item failed:", (err as Error).message);
    }
  }
  return posted;
}

/**
 * Arm the daily-brief poller. Every POLL_MS it drains the queue into the
 * configured #content-engine channel, posting each item with Skip/Post buttons.
 * No-op (with a log) when ENGAGEMENT_BRIEF_CHANNEL_ID is unset — safe default, so
 * the bot deploys without proactively posting until John sets the channel.
 */
export function startEngagementBriefPoller(client: Client): void {
  const channelId = process.env.ENGAGEMENT_BRIEF_CHANNEL_ID?.trim();
  if (!channelId) {
    console.warn("[engagement] ENGAGEMENT_BRIEF_CHANNEL_ID unset — brief poller disabled");
    return;
  }
  let draining = false;
  const tick = async (): Promise<void> => {
    if (draining) return; // never overlap two drains
    draining = true;
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased() || !("send" in channel)) {
        console.warn("[engagement] target channel is not a sendable text channel");
        return;
      }
      const sendable = channel as TextChannel;
      const db = getClient();
      const n = await drainAndPostOnce({
        fetchUndelivered: () => fetchUndelivered(db, MAX_PER_DRAIN),
        send: async (item) => {
          await sendable.send({
            embeds: [buildBriefEmbed(item)],
            components: [buildEngagementButtons(item.post_id)],
            allowedMentions: { parse: [] },
          });
        },
        markPosted: (postId) => markPosted(db, postId),
      });
      if (n > 0) console.log(`[engagement] posted ${n} brief item(s) to #content-engine`);
    } catch (err) {
      console.warn("[engagement] poll tick failed:", (err as Error).message);
    } finally {
      draining = false;
    }
  };
  setInterval(tick, POLL_MS);
  console.log(`[engagement] brief poller armed (every ${POLL_MS / 1000}s) → channel ${channelId}`);
}
