// X post-text generator (ADR-058). One Sonnet call per day, brand-voice gated.
//
// Pure `buildUserPrompt` (angle selection + real numbers) + `generatePostText`
// (model call + voiceCheck loop). The model is injected so tests exercise the
// rotation + the Gate-12/13 retry without hitting the API.
//
// Voice: BRAND-VOICE.md — calm, exact numbers, no em dash (Gate 12), no hype
// (Gate 13). Any price carries "as of today". Posts link to foiltcg.com (our
// own site, which carries the affiliate disclosure near its CTAs); the tweet is
// informational, not a direct affiliate buy-link, so no in-tweet FTC disclosure
// is required — the destination page is the disclosure surface.

import { anthropic } from "../anthropic.ts";
import { voiceCheck, type VoiceViolation } from "../seo/voice-check.ts";
import type { PostAngle } from "./angles.ts";

export const X_CHAR_LIMIT = 280;
const MODEL = "claude-sonnet-4-6";
const SITE = "https://foiltcg.com";

export type DealData = {
  cardName: string;
  setName: string;
  slug: string;
  /** Negative (ask below sold). The post shows the absolute "% below". */
  deltaPct: number;
  soldReference: number;
  matchedTier: string | null;
};
export type SpotlightData = {
  cardName: string;
  setName: string;
  slug: string;
  /** PokeTrace recent sold average (non-eBay, R-008-safe to show). */
  soldReference: number;
  sampleSize: number;
};

export type PostInput =
  | { angle: "deal_of_day"; date: string; deal: DealData }
  | { angle: "price_spotlight"; date: string; spotlight: SpotlightData }
  | { angle: "educational"; date: string };

export type GeneratedPost = {
  text: string;
  angle: PostAngle;
  /** The page the post links to (deals board or a spotlight card). */
  link: string;
  attempts: number;
};

export type GenerateFn = (system: string, user: string) => Promise<string>;

const SYSTEM = [
  "You write a single X (Twitter) post for Foil, a Pokemon TCG deal-finder built by a TCGplayer seller.",
  "Brand voice: calm, confident, concrete. Exact numbers only, never vague (no 'around', 'about', '~', 'roughly').",
  "HARD RULES: no em dash (use commas, colons, or periods). No hype words (no 'steal', 'must-buy', 'guaranteed', 'to the moon', 'insane', 'amazing deal'). No emoji. No exclamation marks.",
  "Any price or percentage you state must be followed by 'as of today' (prices move).",
  `The post MUST be at most ${X_CHAR_LIMIT} characters INCLUDING the link, and MUST end with the provided link on its own line.`,
  "Output ONLY the post text. No preamble, no quotes, no hashtags unless they read naturally (at most one).",
].join("\n");

function below(deal: DealData): number {
  return Math.round(Math.abs(deal.deltaPct));
}
function usd(n: number): string {
  return `$${n >= 100 ? Math.round(n) : n.toFixed(2)}`;
}
function humanTier(t: string | null): string {
  if (!t) return "";
  const raw: Record<string, string> = { NEAR_MINT: "Near Mint", LIGHTLY_PLAYED: "Lightly Played", MODERATELY_PLAYED: "Moderately Played", HEAVILY_PLAYED: "Heavily Played", DAMAGED: "Damaged" };
  return raw[t] ?? t.replace(/_/g, " ");
}

/** The page a post links to for its angle. */
export function linkFor(input: PostInput): string {
  if (input.angle === "deal_of_day") return `${SITE}/cards/${input.deal.slug}`;
  if (input.angle === "price_spotlight") return `${SITE}/cards/${input.spotlight.slug}`;
  return `${SITE}/deals`;
}

/** Pure: the per-angle instruction + the real figures the model must use verbatim. */
export function buildUserPrompt(input: PostInput): string {
  const link = linkFor(input);
  if (input.angle === "deal_of_day") {
    const d = input.deal;
    return [
      "ANGLE: deal of the day. State the card, that it is currently listed below its recent condition-matched sold price, with these EXACT figures:",
      `- Card: ${d.cardName} (${d.setName})`,
      `- ${below(d)}% below recent sold (as of today)`,
      `- recent ${humanTier(d.matchedTier)} sold around ${usd(d.soldReference)} (you may state this as the sold reference, with 'as of today')`,
      "Frame it as a found deal a buyer can verify, not hype.",
      `Link (end the post with this): ${link}`,
    ].join("\n");
  }
  if (input.angle === "price_spotlight") {
    const s = input.spotlight;
    return [
      "ANGLE: price spotlight (utility framing: 'here is what this card is actually worth right now').",
      `- Card: ${s.cardName} (${s.setName})`,
      `- recent sold around ${usd(s.soldReference)} across ${s.sampleSize} sales (as of today)`,
      "Position Foil as the fast way to see any card's real price. No deal claim, just the number + the utility.",
      `Link (end the post with this): ${link}`,
    ].join("\n");
  }
  return [
    "ANGLE: educational / trust. No specific prices. Explain ONE differentiator in plain terms:",
    "Foil matches like-for-like before calling anything a deal: same condition, and English-vs-Japanese matched via the listing's item specifics (a Japanese card is never compared to English sold prices). Built by a TCGplayer seller.",
    `Link (end the post with this): ${link}`,
  ].join("\n");
}

function withinLimit(text: string): boolean {
  return text.trim().length <= X_CHAR_LIMIT;
}

/**
 * Generate one gated post. Calls the model, runs voiceCheck (Gates 12/13) +
 * the char limit, and re-prompts with the violations up to `maxAttempts`. Throws
 * if it can't produce a clean post (caller soft-fails the run). The model is
 * injected (default: Sonnet) so tests drive the retry loop deterministically.
 */
export async function generatePostText(
  input: PostInput,
  opts: { generate?: GenerateFn; maxAttempts?: number } = {},
): Promise<GeneratedPost> {
  const generate = opts.generate ?? defaultGenerate;
  const maxAttempts = opts.maxAttempts ?? 3;
  const link = linkFor(input);
  const baseUser = buildUserPrompt(input);

  let lastIssues: string[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const user = lastIssues.length
      ? `${baseUser}\n\nYour previous attempt was rejected for: ${lastIssues.join("; ")}. Rewrite to fix ALL of these.`
      : baseUser;
    const raw = (await generate(SYSTEM, user)).trim();

    const issues: string[] = [];
    const vc = voiceCheck(raw);
    if (!vc.passed) issues.push(...vc.violations.map(describe));
    if (!withinLimit(raw)) issues.push(`over ${X_CHAR_LIMIT} chars (${raw.length})`);
    if (!raw.includes(link)) issues.push("missing the required link");

    if (issues.length === 0) {
      return { text: raw, angle: input.angle, link, attempts: attempt };
    }
    lastIssues = issues;
  }
  throw new Error(`post-text failed voice/format gates after ${maxAttempts} attempts: ${lastIssues.join("; ")}`);
}

function describe(v: VoiceViolation): string {
  return `${v.kind} (${v.detail})`;
}

const defaultGenerate: GenerateFn = async (system, user) => {
  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 400,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = res.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
};
