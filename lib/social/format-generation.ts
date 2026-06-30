// Format-informed X-post generation — the SOUL (ADR-087). Given a mined FORMAT
// pattern (the "container", from lib/engagement/format-mining.ts) and ONE real
// Foil card with real sold-data, produce a post that USES the proven hook/
// structure but in Foil's calm, anti-hype voice with ONLY real figures and the
// correct card. "Steal the container, keep the soul."
//
// The keep-the-soul gate (validateFormatPost) is the guarantee that copying a
// format can NEVER degrade into copying hype or citing wrong/fabricated data:
//   - voiceCheck   — no em dash, no hype/banned phrases, no vague numbers (reused
//                    from the SEO brand-voice lens — the same gate the blog uses).
//   - figures      — every $ figure must trace to THIS card's real data (reuses
//                    the engagement draft's suppliedFigures/usd, the figures-trace
//                    pattern that makes a price un-fabricatable).
//   - correct card — resolveCardSlug(text) must be null OR equal this card's slug
//                    (reuses the engagement card-resolver — so a format-mined hook
//                    can never pull in a DIFFERENT chase card's name/identity).
//   - link-free    — the body carries no URL (the X-bot convention: the link is a
//                    threaded reply for reach).
//   - length       — within the X char limit.
// A draft that fails the gate is rejected/regenerated, never returned. This module
// produces text only; it NEVER posts to X (that is runXBot's live mode, not wired
// here — this ship is dry-run preview only).

import { voiceCheck } from "../seo/voice-check.ts";
import { resolveCardSlug } from "../engagement/card-resolver.ts";
import { suppliedFigures, usd, matchesHype } from "../engagement/draft.ts";
import { X_CHAR_LIMIT } from "./post-text.ts";
import type { FormatCardData, GeneratedFormatPost, MinedPattern } from "../engagement/format-mining.ts";

export type { FormatCardData, GeneratedFormatPost } from "../engagement/format-mining.ts";

/** A link/URL in the body (the body must stay link-free; the link is a reply). */
const LINK_RE = /(https?:\/\/|x\.com|twitter\.com|t\.co|foiltcg\.com|\.com\/)/i;

/** The exact $ strings a post about THIS card may cite (its real averages). */
export function figuresFor(data: FormatCardData): Set<string> {
  return suppliedFigures([
    { slug: data.slug, cardName: data.cardName, avg7dUsd: data.avg7dUsd, avg30dUsd: data.avg30dUsd, momentumPct: data.momentumPct, sampleSize: data.saleCount },
  ]);
}

/**
 * The keep-the-soul gate. Pure; returns null when clean, or a reason string when
 * the draft must be rejected. Order is cheap-checks-first so a retry prompt gets
 * the most actionable reason.
 */
export function validateFormatPost(text: string, data: FormatCardData): string | null {
  const t = text.trim();
  if (t.length < 15) return "too_short";
  if (t.length > X_CHAR_LIMIT) return `over_${X_CHAR_LIMIT}`;
  if (LINK_RE.test(t)) return "contains_link";

  // Anti-hype: the engagement HYPE list (reused) catches the hard-sell phrasing
  // voiceCheck's banned-phrase list doesn't ("insane", "must buy", "guaranteed",
  // "huge"). This is the core of "keep the soul" — a mined hype FORMAT can never
  // post hype copy.
  if (matchesHype(t)) return "hype";

  // Brand voice (em dash, banned phrases/AI-tells, vague/hedged numbers). The SEO
  // lens returns every violation; surface the first for the retry prompt.
  const voice = voiceCheck(t);
  if (!voice.passed) {
    const v = voice.violations[0];
    return `voice:${v.kind}`;
  }

  // Honesty: every $ figure must be one of THIS card's real averages.
  const allowed = figuresFor(data);
  const cited = t.match(/\$\d[\d,]*/g) ?? [];
  for (const c of cited) {
    if (!allowed.has(c)) return `unsupplied_figure:${c}`;
  }

  // Correct card: the post may name THIS card, or name no known chase card at
  // all, but it must NEVER resolve to a DIFFERENT known printing (the format-mined
  // hook pulling in a famous-but-wrong card name).
  const resolved = resolveCardSlug(t);
  if (resolved && resolved.slug !== data.slug) {
    return `wrong_card:${resolved.slug}`;
  }

  return null;
}

const SYSTEM = [
  "You write a single X (Twitter) post for Foil, a Pokemon TCG deal-finder built by a TCGplayer seller.",
  "You are given a PROVEN FORMAT mined from a high-performing post in the niche. Reuse its STRUCTURE and HOOK SHAPE only. Do NOT copy its tone, its hype, its emoji, or any specific claim or number from it.",
  "Brand voice: calm, confident, deadpan, concrete. Exact numbers only, never vague (no 'around', 'about', '~', 'roughly').",
  "HARD RULES: no em dash (use commas, colons, or periods). No hype words (no 'steal', 'must-buy', 'guaranteed', 'to the moon', 'insane', 'amazing', 'huge'). No emoji. No exclamation marks.",
  "Anchor the post in the present at least once ('right now', 'this week', or 'as of today').",
  `At most ${X_CHAR_LIMIT} characters. Put NO link or URL in the body; the link is posted separately as the first reply, so the body stays link-free.`,
  "Cite ONLY the exact figures you are given, verbatim. Never invent, round, or adjust a number. Never name a different card.",
  "Output ONLY the post text. No preamble, no quotes.",
].join("\n");

/** Build the generation prompt: the container (mined pattern) + the soul (real
 *  card + figures). Pure — exposed for tests. */
export function buildFormatPrompt(pattern: MinedPattern, data: FormatCardData): { system: string; user: string } {
  const dir = data.momentumPct < 0 ? "below" : "above";
  const user = [
    "THE PROVEN FORMAT to reuse (the container, NOT the content):",
    `- Hook mechanic: ${pattern.hook}`,
    `- Structure: ${pattern.format}`,
    `- Angle: ${pattern.angle}`,
    `- Length: ${pattern.lengthBucket}`,
    `- CTA style: ${pattern.cta || "soft, invites a reply"}`,
    `- Why it works: ${pattern.whyItWorks}`,
    "",
    "Write the post in FOIL'S calm voice using this format, about this EXACT card with these EXACT figures (the only numbers you may cite, verbatim):",
    `- ${data.cardName} (${data.setName})`,
    `- 7-day sold average ${usd(data.avg7dUsd)}, 30-day sold average ${usd(data.avg30dUsd)} (${data.saleCount} recent sales)`,
    `- currently ${Math.abs(Math.round(data.momentumPct))}% ${dir} its 30-day average`,
    "",
    "These are aggregate sold averages (many sales), not a single listing, so frame any read as a market read, not a guaranteed deal. Do not name any other card. Do not invent a figure.",
    "Use the format's HOOK and STRUCTURE, but keep Foil's calm, numbers-first, no-hype voice.",
  ].join("\n");
  return { system: SYSTEM, user };
}

export type FormatGenerateDeps = {
  /** LLM call: (system, user) → raw model text. Injected so the gate loop is
   *  testable without the network. */
  generate: (system: string, user: string) => Promise<string>;
  /** Gate-retry budget (default 3). */
  maxAttempts?: number;
};

/**
 * Generate ONE gate-valid Foil post for a (pattern, card) pair, or null if it
 * can't pass the keep-the-soul gate within the retry budget. Re-prompts with the
 * rejection reason each attempt. Soft-fail: an LLM error returns null. NEVER posts
 * to X — returns text only.
 */
export async function generateFormatPost(
  pattern: MinedPattern,
  data: FormatCardData,
  deps: FormatGenerateDeps,
): Promise<GeneratedFormatPost | null> {
  const maxAttempts = deps.maxAttempts ?? 3;
  const { system, user } = buildFormatPrompt(pattern, data);
  let lastReason: string | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const u = lastReason
      ? `${user}\n\nYour previous attempt was rejected for: ${lastReason}. Rewrite to fix it. Keep Foil's calm voice, cite only the given figures, name only this card, no link, no em dash, no hype.`
      : user;
    let raw: string;
    try {
      raw = (await deps.generate(system, u)).trim();
    } catch {
      return null;
    }
    if (!raw) {
      lastReason = "empty_output";
      continue;
    }
    const reason = validateFormatPost(raw, data);
    if (!reason) return { pattern, data, text: raw };
    lastReason = reason;
  }
  return null;
}
