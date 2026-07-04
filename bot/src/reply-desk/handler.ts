// Reply-desk button + modal handler + delivery poller (ADR-107 §1).
//
// ========================= THE FIREWALL (this lane) =========================
// The reply desk posts to X ONLY for USER-INITIATED CONTACT (the inbound is a
// mention/reply to us — X's automation rules permit an API response). Even so,
// this file NEVER calls the X API itself: "Reply" and the Edit-modal submit
// RELAY the owner's decision to the app's /api/reply-desk/approve endpoint (the
// single X boundary lives there, gated by X_REPLY_DESK_SECRET). Cold replies
// never reach this desk (they are intent-link/human-send; see ADR-107).
// ============================================================================

import type { ButtonInteraction, Client, ModalSubmitInteraction, TextChannel } from "discord.js";
import { getClient } from "../db.ts";
import { fetchUndelivered, getItem, markPostedToDiscord } from "./queue.ts";
import {
  buildReplyDeskButtons,
  buildDecidedReplyDeskButtons,
  buildEditModal,
  parseReplyDeskButtonId,
  parseReplyDeskModalId,
  RD_MODAL_INPUT,
} from "./buttons.ts";
import { buildReplyDeskEmbed } from "./render.ts";

const POLL_MS = 60_000;
const MAX_PER_DRAIN = 25;

function isOwner(userId: string, ownerId: string | undefined): boolean {
  return !!ownerId && userId === ownerId;
}

export type ReplyApproveResult =
  | { ok: true; action: string; postId?: string; permalink?: string }
  | { ok: false; error: string; status?: number };

/**
 * Relay the owner's decision to the app's /api/reply-desk/approve endpoint —
 * the single X boundary. On a post action the app API-posts the reply in-thread.
 * Bearer X_REPLY_DESK_SECRET (dedicated). Injectable for tests.
 */
export async function callReplyDeskApprove(
  action: "post" | "skip",
  id: string,
  text: string | null,
  deps: { appUrl?: string; secret?: string; fetchImpl?: typeof fetch } = {},
): Promise<ReplyApproveResult> {
  const appUrl = (deps.appUrl ?? process.env.FOIL_APP_URL ?? "https://foiltcg.com").replace(/\/+$/, "");
  const secret = deps.secret ?? process.env.X_REPLY_DESK_SECRET;
  if (!secret) return { ok: false, error: "X_REPLY_DESK_SECRET not configured" };
  const fetchFn = deps.fetchImpl ?? fetch;
  try {
    const res = await fetchFn(`${appUrl}/api/reply-desk/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ id, action, ...(text ? { text } : {}) }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && json.ok === true) {
      return { ok: true, action: String(json.action ?? action), postId: json.postId as string | undefined, permalink: json.permalink as string | undefined };
    }
    return { ok: false, error: String(json.error ?? `http_${res.status}`), status: res.status };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Handle a Reply / Edit / Skip button click. Not ours → return (another handler
 * may own it). Not the owner → ephemeral refusal (fail-closed). Reply → relay a
 * post; Edit → show the prefilled modal; Skip → relay a skip. Soft-fail.
 */
export async function handleReplyDeskButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseReplyDeskButtonId(interaction.customId);
  if (!parsed) return; // not a reply-desk button

  if (!isOwner(interaction.user.id, process.env.X_BOT_OWNER_DISCORD_ID)) {
    await interaction.reply({ content: "Only the configured owner can action reply-desk items.", ephemeral: true, allowedMentions: { parse: [] } });
    return;
  }

  const db = getClient();

  if (parsed.action === "edit") {
    const item = await getItem(db, parsed.postId);
    await interaction.showModal(buildEditModal(parsed.postId, item?.reply ?? ""));
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const relayAction = parsed.action === "reply" ? "post" : "skip";
  const res = await callReplyDeskApprove(relayAction, parsed.postId, null);

  if (res.ok && res.action !== "skipped") {
    await interaction.message.edit({ components: [buildDecidedReplyDeskButtons(parsed.postId, "posted")] }).catch(() => {});
    await interaction.editReply(`Replied on X in-thread.${res.permalink ? ` ${res.permalink}` : ""}`);
    return;
  }
  if (res.ok) {
    await interaction.message.edit({ components: [buildDecidedReplyDeskButtons(parsed.postId, "skipped")] }).catch(() => {});
    await interaction.editReply("Skipped. It won't be posted.");
    return;
  }
  await interaction.editReply(`Could not ${relayAction} this reply: ${res.error}`);
}

/** Handle the Edit modal submit: post the revised text via the approve relay. */
export async function handleReplyDeskModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parsed = parseReplyDeskModalId(interaction.customId);
  if (!parsed) return; // not our modal

  if (!isOwner(interaction.user.id, process.env.X_BOT_OWNER_DISCORD_ID)) {
    await interaction.reply({ content: "Only the configured owner can action reply-desk items.", ephemeral: true, allowedMentions: { parse: [] } });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const text = interaction.fields.getTextInputValue(RD_MODAL_INPUT).trim();
  const res = await callReplyDeskApprove("post", parsed.postId, text);
  if (res.ok) {
    await interaction.message?.edit({ components: [buildDecidedReplyDeskButtons(parsed.postId, "posted")] }).catch(() => {});
    await interaction.editReply(`Replied on X in-thread (edited).${res.permalink ? ` ${res.permalink}` : ""}`);
    return;
  }
  await interaction.editReply(`Could not post the edited reply: ${res.error}`);
}

export type DrainDeps = {
  fetchUndelivered: () => Promise<Awaited<ReturnType<typeof fetchUndelivered>>>;
  send: (item: Awaited<ReturnType<typeof fetchUndelivered>>[number]) => Promise<void>;
  markPosted: (postId: string) => Promise<void>;
};

/** Post every undelivered reply-desk item once, marking each delivered. Soft-fail
 *  per item. Returns the count posted. */
export async function drainAndPostOnce(deps: DrainDeps): Promise<number> {
  const items = await deps.fetchUndelivered();
  let posted = 0;
  for (const item of items) {
    try {
      await deps.send(item);
      await deps.markPosted(item.post_id);
      posted++;
    } catch (err) {
      console.warn("[reply-desk] post item failed:", (err as Error).message);
    }
  }
  return posted;
}

/**
 * Arm the reply-desk delivery poller. Every POLL_MS it drains the queue into the
 * configured channel, posting each item with Reply / Edit / Skip buttons. No-op
 * (with a log) when REPLY_DESK_CHANNEL_ID is unset — the bot deploys without
 * proactively posting until John sets the channel.
 */
export function startReplyDeskPoller(client: Client): void {
  const channelId = process.env.REPLY_DESK_CHANNEL_ID?.trim();
  if (!channelId) {
    console.warn("[reply-desk] REPLY_DESK_CHANNEL_ID unset — reply-desk poller disabled");
    return;
  }
  let draining = false;
  const tick = async (): Promise<void> => {
    if (draining) return;
    draining = true;
    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased() || !("send" in channel)) {
        console.warn("[reply-desk] target channel is not a sendable text channel");
        return;
      }
      const sendable = channel as TextChannel;
      const db = getClient();
      const n = await drainAndPostOnce({
        fetchUndelivered: () => fetchUndelivered(db, MAX_PER_DRAIN),
        send: async (item) => {
          await sendable.send({
            embeds: [buildReplyDeskEmbed(item)],
            components: [buildReplyDeskButtons(item.post_id, { humanLook: item.mode === "human_look" })],
            allowedMentions: { parse: [] },
          });
        },
        markPosted: (postId) => markPostedToDiscord(db, postId),
      });
      if (n > 0) console.log(`[reply-desk] posted ${n} card(s)`);
    } catch (err) {
      console.warn("[reply-desk] poll tick failed:", (err as Error).message);
    } finally {
      draining = false;
    }
  };
  setInterval(tick, POLL_MS);
  console.log(`[reply-desk] poller armed (every ${POLL_MS / 1000}s) → channel ${channelId}`);
}
