// Per-item reply-desk card (ADR-107 §1). One Discord embed per inbound, posted
// by the bot with Reply / Edit / Skip buttons. Shows the inbound tweet, the
// author + follower count, our post context (when known), the drafted reply to
// post via Approve, and a deep link John clicks to see the thread.
//
// Untrusted X post text flows into the embed. Mentions inside an embed don't
// ping, and the bot sends with allowedMentions:{parse:[]} (the authoritative
// control); we also neutralize defensively here (the bot is a separate package
// so the helper is local, mirroring bot/src/engagement/render.ts).

import { EmbedBuilder } from "discord.js";
import type { ReplyDeskItemRow } from "./queue.ts";

const ZWSP = "​"; // zero-width space — breaks an @everyone/@here trigger
const COLOR_NAVY = 0x0f1e3a;
const COLOR_SAKURA = 0xc9718c; // the human-look accent

/** Defang Discord mentions in untrusted text (defense-in-depth). */
export function neutralizeMentions(s: string): string {
  return (s ?? "")
    .replace(/@(everyone|here)/gi, `@${ZWSP}$1`)
    .replace(/<(@[!&]?\d+|#\d+)>/g, "[mention]");
}

const MODE_TAG: Record<string, string> = {
  data_cite: "data-cite",
  intake: "intake (tracking + hydrating)",
  advisory: "advisory (ask for set/number)",
  human_look: "human-look (identify the card)",
};

/** Build the review embed for one reply-desk item. Pure (no IO). */
export function buildReplyDeskEmbed(item: ReplyDeskItemRow): EmbedBuilder {
  const humanLook = item.mode === "human_look";
  const post = neutralizeMentions((item.post_text ?? "").replace(/\s+/g, " ").trim()).slice(0, 900);
  const author = item.author_username ? `@${item.author_username}` : "unknown";
  const followers = typeof item.author_followers === "number" ? ` · ${item.author_followers.toLocaleString("en-US")} followers` : "";

  const embed = new EmbedBuilder()
    .setColor(humanLook ? COLOR_SAKURA : COLOR_NAVY)
    .setTitle(`Reply desk · ${MODE_TAG[item.mode] ?? item.mode}`)
    .setURL(item.post_url)
    .setDescription(`> ${post}`)
    .addFields({ name: "From", value: `${author}${followers} · ${item.inbound_kind}`, inline: false });

  if (item.our_context) {
    embed.addFields({ name: "Our post they replied to", value: neutralizeMentions(item.our_context).slice(0, 400), inline: false });
  }

  if (humanLook) {
    embed.addFields({
      name: "Image attached — identify the card",
      value: "Open the tweet to see the card, then reply by hand (or reply with the set + number so the desk can track it).",
      inline: false,
    });
  } else {
    embed.addFields({ name: "Drafted reply (Approve to post in-thread)", value: neutralizeMentions(item.reply.trim() || "(empty)").slice(0, 1000), inline: false });
    if (item.matched_card) embed.addFields({ name: "Card", value: item.matched_card.slice(0, 256), inline: true });
    if (item.data_cited) embed.addFields({ name: "Data", value: item.data_cited.slice(0, 256), inline: true });
  }

  embed.setFooter({
    text: humanLook
      ? "Human-look: the desk won't guess from an image. You identify it."
      : "Reply API-posts your response in-thread (user-initiated contact). Edit to revise first.",
  });
  return embed;
}
