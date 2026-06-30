// Engagement-brief renderer (ADR-086). Pure: turns the brief into Discord-ready
// markdown chunks (each <= the 2000-char message limit). Each item shows the
// post (truncated), the deep link John clicks to open it, the drafted reply to
// post BY HAND, and the data cited. No action is taken — this is a review sheet.

import type { EngagementBrief, EngagementBriefItem } from "./brief-engine.ts";

const DISCORD_MSG_LIMIT = 1900; // headroom under the 2000 hard cap
const ZWSP = "​"; // zero-width space — breaks a Discord mention trigger

/** Neutralize Discord mentions in UNTRUSTED post text so a malicious post can't
 *  @everyone/@here/role-ping the ops server through our webhook. A zero-width
 *  space after @ breaks the @everyone/@here trigger; raw <@id>/<@&id>/<#id>
 *  embeds are defanged to a literal. (Defense-in-depth; channel is founder-only.) */
export function neutralizeMentions(s: string): string {
  return s
    .replace(/@(everyone|here)/gi, `@${ZWSP}$1`)
    .replace(/<(@[!&]?\d+|#\d+)>/g, "[mention]");
}

function renderItem(item: EngagementBriefItem, n: number): string {
  const post = neutralizeMentions(item.postText.replace(/\s+/g, " ").trim()).slice(0, 220);
  const card = item.matchedCard ? ` · ${item.matchedCard}` : "";
  return [
    `**${n}.** ${item.postUrl}${card}`,
    `> ${post}`,
    `**Reply (post by hand):** ${item.reply}`,
    item.dataCited ? `*data: ${item.dataCited}*` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Render the brief as an ordered list of Discord message chunks. The first chunk
 * carries the header; items are packed greedily so each chunk stays under the
 * message limit. Returns [] when there are no items (the cron then posts a short
 * "nothing today" note instead).
 */
export function renderEngagementBriefChunks(brief: EngagementBrief, opts: { dateLabel: string }): string[] {
  if (brief.items.length === 0) return [];
  const header =
    `🧵 **X engagement brief — ${opts.dateLabel}**\n` +
    `${brief.items.length} ranked posts. **Review + post each reply BY HAND on X** (the engine never posts). ` +
    `Scanned ${brief.scanned}, ${brief.candidates} candidates.\n`;

  const chunks: string[] = [];
  let cur = header;
  brief.items.forEach((item, i) => {
    const block = "\n" + renderItem(item, i + 1) + "\n";
    if ((cur + block).length > DISCORD_MSG_LIMIT) {
      chunks.push(cur.trimEnd());
      cur = block.trimStart();
    } else {
      cur += block;
    }
  });
  if (cur.trim()) chunks.push(cur.trimEnd());
  return chunks;
}
