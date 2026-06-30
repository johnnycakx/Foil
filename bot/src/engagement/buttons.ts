// Skip / Post buttons for the engagement brief (ADR-086 v2). The custom_id parse
// + build are PURE strings (unit-tested without discord.js); the action-row
// builder uses discord.js.
//
// FIREWALL: the "Post" button does NOT post to X. It is named Post because John's
// action is "post this reply by hand"; the bot only surfaces the copy-ready text
// + a deep link (handler.ts). No X write/reply call exists in this path — pinned
// by the zero-X-write invariant test.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

/** custom_id namespace so the interaction handler can tell our buttons apart. */
export const ENG_BTN_PREFIX = "eng";
export type EngagementButtonAction = "skip" | "post";

/** Build a button custom_id: `eng:<action>:<postId>`. Pure. */
export function buildCustomId(action: EngagementButtonAction, postId: string): string {
  return `${ENG_BTN_PREFIX}:${action}:${postId}`;
}

/**
 * Parse + VALIDATE a button custom_id. Returns null for anything that isn't one
 * of our buttons or whose post id isn't a plain numeric X id (defense against a
 * malformed / spoofed custom_id reaching a DB query). Pure.
 */
export function parseEngagementButtonId(
  customId: string,
): { action: EngagementButtonAction; postId: string } | null {
  const parts = (customId ?? "").split(":");
  if (parts.length !== 3) return null;
  const [prefix, action, postId] = parts;
  if (prefix !== ENG_BTN_PREFIX) return null;
  if (action !== "skip" && action !== "post") return null;
  if (!/^\d{1,32}$/.test(postId)) return null; // X tweet ids are numeric
  return { action, postId };
}

/** True if a custom_id belongs to the engagement-brief button set. */
export function isEngagementButton(customId: string): boolean {
  return parseEngagementButtonId(customId) !== null;
}

/** The Skip / Post action row for one brief item. */
export function buildEngagementButtons(postId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCustomId("post", postId))
      .setLabel("Post (copy by hand)")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(buildCustomId("skip", postId))
      .setLabel("Skip")
      .setStyle(ButtonStyle.Secondary),
  );
}

/** A disabled clone of the row, shown after a decision so the buttons read as spent. */
export function buildDecidedButtons(
  postId: string,
  decision: "skipped" | "posted_by_hand",
): ActionRowBuilder<ButtonBuilder> {
  const postedLabel = decision === "posted_by_hand" ? "Posted by hand ✓" : "Post (copy by hand)";
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCustomId("post", postId))
      .setLabel(postedLabel)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(buildCustomId("skip", postId))
      .setLabel(decision === "skipped" ? "Skipped ✓" : "Skip")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );
}
