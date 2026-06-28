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
import { checkPostStructure } from "./post-structure.ts";
import type { PostAngle } from "./angles.ts";

export const X_CHAR_LIMIT = 280;
const MODEL = "claude-sonnet-4-6";
const SITE = "https://foiltcg.com";

export type DealData = {
  cardName: string;
  setName: string;
  slug: string;
  /** Negative: % below the card's own 30-day sold average (movers momentum, ADR-071
   *  follow-up). The post shows the absolute "% below its 30-day average". */
  deltaPct: number;
  /** The 30-day sold average the % is measured against (an aggregate, not a
   *  single listing — so it can't be a phantom one-listing deal). */
  soldReference: number;
  matchedTier: string | null;
  /** Recent sales behind the average (the movers sample). */
  saleCount: number;
  /** ISO computed-at of the source mover row — drives the freshness guard so a
   *  stale board can never produce a deal post. */
  computedAt: string;
  /** The card's hi-res art URL (for the card-hero image + the board thumbnail).
   *  Empty when no art is on file — the renderer then falls back, never an
   *  artless hero. */
  imageUrl: string;
};
export type SpotlightData = {
  cardName: string;
  setName: string;
  slug: string;
  /** PokeTrace recent sold average (non-eBay, R-008-safe to show). */
  soldReference: number;
  sampleSize: number;
  /** The card's hi-res art URL for the card-hero image (empty → fall back). */
  imageUrl: string;
};

export type PostInput =
  | { angle: "deal_of_day"; date: string; deal: DealData }
  | { angle: "price_spotlight"; date: string; spotlight: SpotlightData }
  | { angle: "educational"; date: string }
  | { angle: "weekly_board"; date: string; deals: DealData[] };

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
  "Brand voice: calm, confident, deadpan, concrete. Exact numbers only, never vague (no 'around', 'about', '~', 'roughly').",
  "HARD RULES: no em dash (use commas, colons, or periods). No hype words (no 'steal', 'must-buy', 'guaranteed', 'to the moon', 'insane', 'amazing deal'). No emoji. No exclamation marks.",
  "Prices move, so anchor the post in the present at least once (e.g. 'right now', 'this week', or 'as of today'); you do not need to repeat it after every figure.",
  `The post MUST be at most ${X_CHAR_LIMIT} characters. Do NOT put any link or URL in the post body: the link is posted separately as the first reply, so the body stays link-free for reach.`,
  "When the angle calls for multiple beats, put each beat on its own line with a BLANK LINE between beats so the post breathes on mobile; keep tightly-coupled sentences together on one line.",
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
  return `${SITE}/deals`; // educational + weekly_board point at the board
}

/** The newsletter landing page (a public route) — the list-growth CTA target. */
export const NEWSLETTER_URL = `${SITE}/newsletter`;
/** Rotate the newsletter CTA into ~1-in-N daily replies. The X algorithm punishes
 *  CTA-heavy accounts, so the ask is 80/20 value-to-CTA (STRATEGY-AUDIENCE-MOAT):
 *  dayIndex % N === 0 → newsletter, else the value-framed link. */
export const NEWSLETTER_REPLY_EVERY = 5;

/** Deterministic: is `dayIndex` a newsletter-CTA reply day? (~20% at N=5.) */
export function isNewsletterReplyDay(dayIndex: number): boolean {
  return ((dayIndex % NEWSLETTER_REPLY_EVERY) + NEWSLETTER_REPLY_EVERY) % NEWSLETTER_REPLY_EVERY === 0;
}

/**
 * The threaded REPLY text (v2.2). The post body is link-free for reach (Fix 3b),
 * so the reply is where the link lives — and the natural home for the value frame
 * + the occasional newsletter ask, because a CTA in the reply doesn't cost the
 * body's reach. Pure + deterministic (`dayIndex` drives the rotation), so it
 * unit-tests without the network and the persisted reply is reproducible.
 *
 *   - weekly_board: a value-framed board link + the ONLY explicit save ask (Fix D
 *     — bookmarks are earned on the genuinely save-worthy weekly board, not begged
 *     daily). No newsletter rotation (the board already carries its own ask).
 *   - daily angles (deal/spotlight/educational): a value-framed link line, with
 *     the newsletter CTA rotating in ~20% of days. NEVER a bookmark/like ask.
 *
 * Voice rules apply (no em dash, no hype, exact) — pinned by the reply test.
 */
export function buildReplyText(input: PostInput, dayIndex: number): string {
  const link = linkFor(input);
  if (input.angle === "weekly_board") {
    return `This week's biggest movers, the full board: ${link}\n\nBookmark the board, it updates every week.`;
  }
  if (isNewsletterReplyDay(dayIndex)) {
    return `I send the week's biggest movers every Sunday. Free: ${NEWSLETTER_URL}`;
  }
  if (input.angle === "price_spotlight") {
    return `Every recent sale and the live listings: ${link}`;
  }
  if (input.angle === "deal_of_day") {
    return `Full sold history and the live listings: ${link}`;
  }
  return `See this week's good buys: ${link}`; // educational → the board, framed as utility
}

/** Pure: the per-angle instruction + the real figures the model must use verbatim. */
export function buildUserPrompt(input: PostInput): string {
  const link = linkFor(input);
  if (input.angle === "deal_of_day") {
    const d = input.deal;
    const tier = humanTier(d.matchedTier) || "Near Mint";
    return [
      "ANGLE: good buy of the day. Write a SHORT multi-beat post about this card cooling below its OWN 30-day sold average (an aggregate, not a single listing). The branded image already shows the % drop, the dollar average, and the sale count, so do NOT just restate those three numbers: your job is the interpretation the image cannot give.",
      "Card facts (use these EXACT figures, never hedge with around/about/~):",
      `- ${d.cardName} (${d.setName}), ${tier}`,
      `- ${below(d)}% below its 30-day sold average right now`,
      `- 30-day sold average ${usd(d.soldReference)} across ${d.saleCount} recent sales`,
      "Write it as FOUR beats, each on its own line with a BLANK LINE between beats:",
      "1. HOOK: lead with the single most scroll-stopping concrete fact (the move itself). Not a card-name-plus-stat readout. The first line is most of the battle.",
      `2. THE VOLUME READ (the insight the image cannot show): the number that matters is the ${d.saleCount} sales behind the move, not the %. A large sale count means a real trend across many sellers, not one lowball listing.`,
      "3. TEACH ONE MECHANIC in one plain line: why the sale count matters, or what 'below its own 30-day average' actually means. One, not a lecture.",
      "4. A light, honest, forward-looking close that invites a reply (for example: now we watch whether it bounces or keeps sliding). Never a prediction stated as fact, never hype.",
      "Stay calm and deadpan. Frame it as a candidate worth a look, not a guaranteed deal. Do not claim a single listing is below sold.",
      `Do NOT include a link in the body; the link (${link}) is posted as the first reply.`,
    ].join("\n");
  }
  if (input.angle === "price_spotlight") {
    const s = input.spotlight;
    return [
      "ANGLE: price spotlight. Write a SHORT multi-beat post answering 'what is this card actually worth right now'. The branded image already shows the headline price and the sale count, so do NOT just restate them: add the interpretation.",
      "Card facts (use these EXACT figures, no hedging):",
      `- ${s.cardName} (${s.setName})`,
      `- recent sold average ${usd(s.soldReference)} across ${s.sampleSize} sales`,
      "Write it as THREE or FOUR beats, each on its own line with a BLANK LINE between beats:",
      "1. HOOK: lead with what it is actually worth right now, the concrete number that stops the scroll.",
      `2. THE READ the image cannot give: what ${s.sampleSize} sales means. A price backed by many recent sales is a real market read, not one outlier ask.`,
      "3. TEACH ONE MECHANIC in a plain line: for example, why a sold-price average beats a listing's asking price.",
      "4. A light, honest close that invites a reply (for example: higher or lower than you would have guessed). No prediction stated as fact, no hype.",
      "Position Foil as the fast way to see any card's real price.",
      `Do NOT include a link in the body; the link (${link}) is posted as the first reply.`,
    ].join("\n");
  }
  if (input.angle === "weekly_board") {
    const top = input.deals.slice(0, 3);
    return [
      "ANGLE: weekly good-buys digest. A short roundup of cards trading below their OWN 30-day sold average this week (aggregates, not single listings), with these EXACT cards + figures:",
      ...top.map((d) => `- ${d.cardName} (${d.setName}): Near Mint ${below(d)}% below its 30-day average`),
      "One tight line naming a couple of them, framed as candidates worth a look not guarantees, then point readers to the full board. Do not invent any card or number not listed above.",
      `Do NOT include a link in the body; the link (${link}) is posted as the first reply.`,
    ].join("\n");
  }
  return [
    "ANGLE: educational / trust. No specific prices. Explain ONE differentiator in plain terms:",
    "Foil matches like-for-like before calling anything a deal: same condition, and English-vs-Japanese matched via the listing's item specifics (a Japanese card is never compared to English sold prices). Built by a TCGplayer seller.",
    `Do NOT include a link in the body; the link (${link}) is posted as the first reply.`,
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

  // Card-hero angles get the full beat structure (Fix 3); the others stay tight.
  const requireBeats = input.angle === "deal_of_day" || input.angle === "price_spotlight";

  let lastIssues: string[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const user = lastIssues.length
      ? `${baseUser}\n\nYour previous attempt was rejected for: ${lastIssues.join("; ")}. Rewrite to fix ALL of these.`
      : baseUser;
    const raw = (await generate(SYSTEM, user)).trim();

    // The single post-text quality gate: brand voice + a link-free body, plus
    // the beat-structure + interpretation requirement on the card-hero angles.
    const issues = [...checkPostStructure(raw, { requireBeats }).issues];
    if (!withinLimit(raw)) issues.push(`over ${X_CHAR_LIMIT} chars (${raw.length})`);

    if (issues.length === 0) {
      return { text: raw, angle: input.angle, link, attempts: attempt };
    }
    lastIssues = issues;
  }
  throw new Error(`post-text failed quality gate after ${maxAttempts} attempts: ${lastIssues.join("; ")}`);
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
