// Content-intelligence brief renderer (ADR-087). Pure: turns a format-mining
// sweep into Discord-ready markdown chunks for #content-engine. Two sections:
//   A. "What's working in the niche" — the mined FORMAT patterns + the engagement
//      rate of the outlier each was derived from (John's awareness signal).
//   B. "Foil posts using these formats (DRY-RUN)" — the gate-valid generated
//      previews. These are NOT posted; John eyeballs them before they could ever
//      enter the live X-post path.
//
// No action is taken here — this is a review sheet. The renderer takes no X step
// (the zero-X-write invariant reads this file as text). Untrusted outlier text is
// mention-neutralized (reusing the engagement renderer's neutralizeMentions) so a
// malicious post can't @everyone the ops server through our webhook.

import type { FormatMiningResult, MinedPattern } from "./format-mining.ts";
import { neutralizeMentions } from "./render.ts";

const DISCORD_MSG_LIMIT = 1900; // headroom under the 2000 hard cap

function postUrl(id: string, username: string | null): string {
  return username ? `https://x.com/${username}/status/${id}` : `https://x.com/i/web/status/${id}`;
}

function renderPattern(p: MinedPattern, n: number, sourceUrl: string | null): string {
  const lines = [
    `**${n}. ${neutralizeMentions(p.angle)}** \`rate ${p.sourceRate.toFixed(2)}\``,
    `> Hook: ${neutralizeMentions(p.hook)}`,
    `> Format: ${neutralizeMentions(p.format)} · ${p.lengthBucket} · media: ${p.mediaType}`,
  ];
  if (p.cta) lines.push(`> CTA: ${neutralizeMentions(p.cta)}`);
  if (p.whyItWorks) lines.push(`> Why it works: ${neutralizeMentions(p.whyItWorks)}`);
  if (sourceUrl) lines.push(`> Source format: ${sourceUrl}`);
  return lines.join("\n");
}

function renderGenerated(text: string, cardName: string, angle: string, n: number): string {
  return [
    `**${n}.** \`${angle}\` · ${cardName}`,
    "```",
    text.replace(/```/g, "ʼʼʼ"), // can't break the fence
    "```",
  ].join("\n");
}

/**
 * Render the sweep into Discord message chunks (each <= the message limit). The
 * first chunk carries the header + the "what's working" patterns; generated
 * previews follow. Returns a short "nothing today" line when the sweep is empty.
 * `dateLabel` + the username map are injected (provenance links).
 */
export function renderFormatMiningChunks(
  result: FormatMiningResult,
  opts: { dateLabel: string },
): string[] {
  if (result.patterns.length === 0 && result.generated.length === 0) {
    return [
      `🧪 **Content intelligence — ${opts.dateLabel}**: scanned ${result.scanned} posts, no usable format patterns surfaced today.`,
    ];
  }

  // Provenance: map a pattern's source post id → its deep link via the outliers.
  const urlById = new Map(result.outliers.map((o) => [o.post.id, postUrl(o.post.id, o.post.authorUsername)]));

  const chunks: string[] = [];
  let cur =
    `🧪 **Content intelligence — ${opts.dateLabel}**\n` +
    `Mined ${result.patterns.length} winning format${result.patterns.length === 1 ? "" : "s"} from ${result.scanned} scanned posts (ranked by engagement RATE, not absolute likes). ` +
    `Generated ${result.generated.length} Foil post${result.generated.length === 1 ? "" : "s"} using these formats. ` +
    `**DRY-RUN — nothing posted to X.** Engagement is reach, not signups; the Sunday review is the conversion check.\n`;

  const push = (block: string) => {
    if ((cur + "\n" + block).length > DISCORD_MSG_LIMIT) {
      if (cur.trim()) chunks.push(cur.trimEnd());
      cur = block;
    } else {
      cur += "\n" + block;
    }
  };

  if (result.patterns.length > 0) {
    push("__**What's working in the niche (the container):**__");
    result.patterns.forEach((p, i) => {
      push(renderPattern(p, i + 1, p.sourcePostId ? urlById.get(p.sourcePostId) ?? null : null));
    });
  }

  if (result.generated.length > 0) {
    push("__**Foil posts using these formats (review before any go live):**__");
    result.generated.forEach((g, i) => {
      push(renderGenerated(g.text, g.data.cardName, g.pattern.angle, i + 1));
    });
  }

  if (cur.trim()) chunks.push(cur.trimEnd());
  return chunks;
}
