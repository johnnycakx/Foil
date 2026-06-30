// Per-item brief card (ADR-086 v2). One Discord embed per brief item, posted by
// the bot with the Skip/Post buttons. Shows the source post, the drafted reply to
// post BY HAND, the data cited (data-cite mode), and a deep link John clicks.
//
// Untrusted X post text flows into the embed. Mentions inside an embed do not
// ping, and the bot sends with allowedMentions:{parse:[]} (the authoritative
// control), but we also neutralize defensively here (mirrors the renderer fix in
// lib/engagement/render.ts; the bot is a separate package so the helper is local).

import { EmbedBuilder } from "discord.js";
import type { BriefItemRow } from "./queue.ts";

const ZWSP = "​"; // zero-width space — breaks an @everyone/@here trigger
const COLOR_NAVY = 0x0f1e3a;

/** Defang Discord mentions in untrusted text (defense-in-depth). */
export function neutralizeMentions(s: string): string {
  return (s ?? "")
    .replace(/@(everyone|here)/gi, `@${ZWSP}$1`)
    .replace(/<(@[!&]?\d+|#\d+)>/g, "[mention]");
}

/** Build the review embed for one brief item. Pure (no IO). */
export function buildBriefEmbed(item: BriefItemRow): EmbedBuilder {
  const advisory = item.mode === "advisory";
  const post = neutralizeMentions(item.post_text.replace(/\s+/g, " ").trim()).slice(0, 900);
  const reply = neutralizeMentions(item.reply.trim()).slice(0, 1000);
  const tag = advisory ? "advisory" : "data-cite";
  const author = item.author_username ? `@${item.author_username}` : "unknown";

  const embed = new EmbedBuilder()
    .setColor(COLOR_NAVY)
    .setTitle(`X engagement · ${tag}`)
    .setURL(item.post_url)
    .setDescription(`> ${post}`)
    .addFields(
      { name: "Reply (post by hand)", value: reply || "(empty)", inline: false },
      { name: "Author", value: author, inline: true },
    );

  if (!advisory && item.matched_card) {
    embed.addFields({ name: "Card", value: item.matched_card.slice(0, 256), inline: true });
  }
  if (!advisory && item.data_cited) {
    embed.addFields({ name: "Data", value: item.data_cited.slice(0, 256), inline: false });
  }
  embed.setFooter({
    text: advisory
      ? "Advisory: helpful-first, no figures. The bot never posts; you post by hand."
      : "Data-cite: figures are for the exact card. The bot never posts; you post by hand.",
  });
  return embed;
}
