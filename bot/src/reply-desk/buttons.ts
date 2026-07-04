// Reply / Edit / Skip buttons + the Edit modal for the reply desk (ADR-107 §1).
// The custom_id parse + build are PURE strings (unit-tested without discord.js).
//
// Unlike the engagement "Post" button (copy-by-hand, zero X write), the reply
// desk's "Reply" DOES post to X — but ONLY via the app's /api/reply-desk/approve
// endpoint (the single X boundary), and ONLY for user-initiated contact. The bot
// never calls the X API itself; it relays the owner's decision.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

export const RD_BTN_PREFIX = "rd";
export const RD_MODAL_PREFIX = "rd-edit-modal";
export const RD_MODAL_INPUT = "reply";
export type ReplyDeskButtonAction = "reply" | "edit" | "skip";

/** Build a button custom_id: `rd:<action>:<postId>`. Pure. */
export function buildReplyDeskCustomId(action: ReplyDeskButtonAction, postId: string): string {
  return `${RD_BTN_PREFIX}:${action}:${postId}`;
}

/** Parse + VALIDATE a button custom_id (numeric X id guard). Null if not ours. */
export function parseReplyDeskButtonId(customId: string): { action: ReplyDeskButtonAction; postId: string } | null {
  const parts = (customId ?? "").split(":");
  if (parts.length !== 3) return null;
  const [prefix, action, postId] = parts;
  if (prefix !== RD_BTN_PREFIX) return null;
  if (action !== "reply" && action !== "edit" && action !== "skip") return null;
  if (!/^\d{1,32}$/.test(postId)) return null;
  return { action, postId };
}

/** Parse the Edit modal's custom_id: `rd-edit-modal:<postId>`. Null if not ours. */
export function parseReplyDeskModalId(customId: string): { postId: string } | null {
  const parts = (customId ?? "").split(":");
  if (parts.length !== 2 || parts[0] !== RD_MODAL_PREFIX) return null;
  if (!/^\d{1,32}$/.test(parts[1])) return null;
  return { postId: parts[1] };
}

/** The Reply / Edit / Skip action row. For a human_look card there is no
 *  drafted reply, so Reply is omitted (John writes his own by hand). */
export function buildReplyDeskButtons(postId: string, opts: { humanLook?: boolean } = {}): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (!opts.humanLook) {
    row.addComponents(
      new ButtonBuilder().setCustomId(buildReplyDeskCustomId("reply", postId)).setLabel("Reply (post as drafted)").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(buildReplyDeskCustomId("edit", postId)).setLabel("Edit").setStyle(ButtonStyle.Primary),
    );
  }
  row.addComponents(
    new ButtonBuilder().setCustomId(buildReplyDeskCustomId("skip", postId)).setLabel("Skip").setStyle(ButtonStyle.Secondary),
  );
  return row;
}

/** A disabled row shown after a decision so the buttons read as spent. */
export function buildDecidedReplyDeskButtons(postId: string, decision: "posted" | "skipped"): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildReplyDeskCustomId("reply", postId))
      .setLabel(decision === "posted" ? "Replied ✓" : "Reply (post as drafted)")
      .setStyle(ButtonStyle.Success)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(buildReplyDeskCustomId("skip", postId))
      .setLabel(decision === "skipped" ? "Skipped ✓" : "Skip")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );
}

/** The Edit modal, prefilled with the drafted reply for the owner to revise. */
export function buildEditModal(postId: string, currentReply: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${RD_MODAL_PREFIX}:${postId}`)
    .setTitle("Edit reply, then post")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(RD_MODAL_INPUT)
          .setLabel("Reply text (posts to X in-thread)")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(280)
          .setValue((currentReply ?? "").slice(0, 280))
          .setRequired(true),
      ),
    );
}
