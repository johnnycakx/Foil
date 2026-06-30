// Engagement-brief reply drafting (ADR-086). For a candidate post we draft ONE
// calm, numbers-first, on-brand reply that cites REAL Foil sold-data — or skip
// it. The figures come from the injected market-movers facts (never invented),
// and a pure gate enforces the brand voice + honesty BEFORE a draft reaches the
// brief: no link, no em dash, no hype, and every $ figure must trace to the
// supplied data. The draft is text only — the engine never sends it (a human
// posts every reply by hand).

import type { XPost } from "../social/x-client.ts";
import { resolveCardSlug } from "./card-resolver.ts";

/** A real market-mover fact the reply may cite (from market_movers; PokeTrace).
 *  `slug` is the card identity — the engine matches the post's resolved card to
 *  a fact BY SLUG, never by name (the wrong-card-citation fix). */
export type MoverFact = {
  slug: string;
  cardName: string;
  avg7dUsd: number;
  avg30dUsd: number;
  momentumPct: number;
  sampleSize: number;
};

/** Which kind of reply a draft is:
 *  - "data_cite": names a resolvable KNOWN_CARDS mover → cites the EXACT card's
 *    real figures (the v1 behavior; wrong-card-proof via card-resolver).
 *  - "advisory": a high-reach, relevant buying-intent / market-curiosity post with
 *    no resolvable specific card → a value-FIRST reply that carries NO $ figure
 *    (so zero wrong-card risk) and a natural Foil mention, never a bare link. */
export type BriefMode = "data_cite" | "advisory";

export type DraftResult =
  | { ok: true; mode: BriefMode; matchedCard: string; reply: string; dataCited: string; confidence: number }
  | { ok: false; reason: "skip" | "gate_failed" | "error"; detail?: string };

export type DraftDeps = {
  /** LLM call: prompt → raw model text. Injected so the orchestrator is testable. */
  generate: (prompt: string) => Promise<string>;
};

const HYPE = [
  /to the moon/i,
  /🚀|🔥|💎/,
  /\binsane\b/i,
  /\bmust[- ]?(buy|cop|grab)\b/i,
  /\bguaranteed\b/i,
  /you won'?t believe/i,
  /\bhuge\b/i,
  /massive (gains|profit)/i,
  /\bmoonshot\b/i,
  /\bcan'?t lose\b/i,
];

/** Format a USD figure the same way the model is told to, so the trace matches. */
export function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** The exact set of dollar strings the model is allowed to cite (from real data). */
export function suppliedFigures(facts: MoverFact[]): Set<string> {
  const out = new Set<string>();
  for (const f of facts) {
    out.add(usd(f.avg7dUsd));
    out.add(usd(f.avg30dUsd));
  }
  return out;
}

/**
 * Validate a drafted reply against the brand voice + honesty rules. Pure.
 * Returns null when clean, or a reason string when it must be rejected.
 */
export function validateDraft(reply: string, allowedFigures: Set<string>): string | null {
  const text = reply.trim();
  if (text.length < 15) return "too_short";
  if (text.length > 280) return "over_280";
  // No link of any kind — a reply with a link reads as promo + X throttles it.
  if (/(https?:\/\/|x\.com|twitter\.com|t\.co|foiltcg\.com|\.com\/)/i.test(text)) return "contains_link";
  // BRAND-VOICE Gate 12: no em dash.
  if (text.includes("—")) return "em_dash";
  for (const re of HYPE) if (re.test(text)) return "hype";
  // Honesty: every $ figure cited must be one we supplied (no fabrication).
  const cited = text.match(/\$\d[\d,]*/g) ?? [];
  for (const c of cited) {
    if (!allowedFigures.has(c)) return `unsupplied_figure:${c}`;
  }
  return null;
}

/** Build the drafting prompt for a SINGLE, already-resolved card. Pure — exposed
 *  for tests. The post's card identity is resolved deterministically upstream
 *  (resolveCardSlug); the model only writes prose for the supplied card, so it
 *  can never pick a different printing's figure. */
export function buildDraftPrompt(post: XPost, cardLabel: string, fact: MoverFact): string {
  const factLine = `${fact.cardName}: 7-day avg ${usd(fact.avg7dUsd)}, 30-day avg ${usd(fact.avg30dUsd)} (${fact.sampleSize} sales, ${fact.momentumPct > 0 ? "+" : ""}${fact.momentumPct}% vs 30d)`;
  return [
    "You draft a single reply to a Pokemon TCG post on X for Foil (a deal-finder + market-insight tool, run by a Level-4 TCGplayer seller).",
    "GOAL: be genuinely helpful with real sold-data — not promotional. A human posts it by hand, so it must read like a knowledgeable person, never a bot.",
    "",
    "THE POST you are replying to:",
    `"""${post.text.slice(0, 400)}"""`,
    "",
    `The post is about this EXACT card: ${cardLabel}.`,
    "Its REAL recent sold data (the ONLY figures you may cite — never invent or adjust a number):",
    `- ${factLine}`,
    "",
    "RULES (hard):",
    "- Write a reply ONLY if a sold-data figure for THIS card genuinely helps the post. If it does not fit (off-topic, sarcastic, already answered), SKIP.",
    "- Calm, numbers-first, specific. No hype, no emoji, no exclamation, no em dash.",
    "- NO link of any kind (no x.com, no foiltcg.com, no url).",
    "- Cite at most the supplied figures verbatim ($X). Frame any read as a read, not a fact.",
    "- Under 280 characters. Sound like a helpful collector, not an ad.",
    "",
    'Respond as JSON only: {"skip": true} OR {"reply": "<text>", "dataCited": "<which figure(s)>", "confidence": <0..1>}',
  ].join("\n");
}

function parseModelJson(raw: string): Record<string, unknown> | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Draft a reply for one candidate. The card identity is resolved DETERMINISTICALLY
 * from the post (resolveCardSlug); the cited figure is the data row whose slug
 * equals that — never a name-fuzzy match — so a reply can never carry another
 * printing's price (the Moonbreon -> Umbreon-ex bug). Order: (a) resolve the
 * exact card + find its data -> draft citing THAT; (b) can't resolve, or the
 * resolved card has no data row -> skip (null over guess; no numbered claim).
 * Soft-fail: any error/parse miss/gate failure -> skip/error, never throws; the
 * output is gate-validated against ONLY the resolved card's figures.
 */
export async function draftReply(
  input: { post: XPost; facts: MoverFact[] },
  deps: DraftDeps,
): Promise<DraftResult> {
  // (1) Deterministic exact-card identity — null over guess.
  const resolved = resolveCardSlug(input.post.text);
  if (!resolved) return { ok: false, reason: "skip", detail: "no_card_resolved" };

  // (2) Match the data row BY SLUG (identity), never by name. No data for the
  //     exact card -> skip rather than substitute a different printing's figure.
  const fact = input.facts.find((f) => f.slug === resolved.slug);
  if (!fact) return { ok: false, reason: "skip", detail: "resolved_card_no_data" };

  let raw: string;
  try {
    raw = await deps.generate(buildDraftPrompt(input.post, resolved.displayName, fact));
  } catch (err) {
    return { ok: false, reason: "error", detail: (err as Error).message };
  }
  const parsed = parseModelJson(raw);
  if (!parsed) return { ok: false, reason: "error", detail: "unparseable" };
  if (parsed.skip === true || typeof parsed.reply !== "string") return { ok: false, reason: "skip" };

  const reply = parsed.reply.trim();
  // The gate's allowed figures are ONLY the resolved card's — so a stray figure
  // from any other card is rejected even if the model hallucinated one.
  const gate = validateDraft(reply, suppliedFigures([fact]));
  if (gate) return { ok: false, reason: "gate_failed", detail: gate };

  return {
    ok: true,
    mode: "data_cite",
    matchedCard: resolved.displayName,
    reply,
    dataCited: typeof parsed.dataCited === "string" ? parsed.dataCited : "",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
  };
}

// ---------------------------------------------------------------------------
// ADVISORY reply mode (ADR-086 v2). The highest-reach posts are generic buying
// questions ("I'm 50, what should I buy myself?", "is grading worth it?") that
// name no specific card — v1 threw them away. Advisory drafts a value-FIRST,
// genuinely-helpful reply that carries NO dollar figure (so there is zero
// wrong-card / fabrication risk by construction) and, where it fits naturally,
// mentions that Foil tracks live deals + recent sold data. The ONE real risk is
// link-drop spam: a new low-rep account dropping site links to strangers gets
// spam-flagged, so advisory replies mention Foil by NAME only, never a bare
// link, and the gate rejects "check out my site" / "DM me" / "link in bio"
// promo patterns outright.
// ---------------------------------------------------------------------------

/** Promo / cold-outreach-spam patterns. A reply matching any of these reads as
 *  an ad from a stranger (the spam-flag trigger) and is rejected. */
const SPAM = [
  /check (it |this |my |us )?out/i,
  /link in (bio|profile)/i,
  /\bdm me\b/i,
  /\bfollow (me|us|back)\b/i,
  /sign ?up/i,
  /\bsubscribe\b/i,
  /\bmy (site|page|tool|app|link|profile)\b/i,
  /click (here|the link|below)/i,
  /smash (that|the) /i,
  /\bvisit\b[^.]{0,30}\b(site|page|link|us)\b/i,
  /\bcheck out\b/i,
];

/**
 * Validate an ADVISORY reply. Same calm-voice + no-link + no-em-dash + no-hype
 * bar as data-cite, PLUS: it must carry NO $ figure at all (advisory is
 * figure-free by design — that is what makes it wrong-card-proof) and must not
 * match a cold-outreach-spam pattern. Pure; returns null when clean or a reason
 * string when it must be rejected.
 */
export function validateAdvisoryDraft(reply: string): string | null {
  const text = reply.trim();
  if (text.length < 15) return "too_short";
  if (text.length > 280) return "over_280";
  if (/(https?:\/\/|x\.com|twitter\.com|t\.co|foiltcg\.com|\.com\/)/i.test(text)) return "contains_link";
  if (text.includes("—")) return "em_dash";
  for (const re of HYPE) if (re.test(text)) return "hype";
  // Advisory carries NO numbers — any $ figure means the model tried to cite
  // data this path deliberately doesn't supply (so it can't be wrong-card).
  if (/\$\d/.test(text)) return "advisory_has_figure";
  for (const re of SPAM) if (re.test(text)) return "spam_pattern";
  return null;
}

/** Build the advisory drafting prompt. Pure — exposed for tests. No figures are
 *  ever supplied, so the model physically cannot cite a (possibly wrong) price. */
export function buildAdvisoryPrompt(post: XPost): string {
  return [
    "You draft a single reply to a Pokemon TCG post on X for Foil (a deal-finder + market-data tool, run by a Level-4 TCGplayer seller).",
    "This post asks a general buying / collecting / market question and does NOT name one specific card we have data for.",
    "GOAL: be genuinely, specifically helpful FIRST — the kind of reply a knowledgeable collector leaves. A human posts it by hand, so it must never read like an ad or a bot.",
    "",
    "THE POST you are replying to:",
    `"""${post.text.slice(0, 400)}"""`,
    "",
    "RULES (hard):",
    "- Lead with a genuine, useful take on THEIR question. If you have nothing useful to add, SKIP.",
    "- You MAY mention, only where it fits naturally, that Foil tracks live deals and recent sold data so you can check what something actually sells for before buying. Mention it by name as a passing aside, not a pitch. Do NOT force it; a purely helpful reply with no mention is fine.",
    "- NEVER include a link or URL of any kind. NEVER say 'check out', 'DM me', 'link in bio', 'follow me', 'sign up', or anything that reads like promotion.",
    "- Cite NO dollar figures and NO specific prices (you have no data for this post). Speak qualitatively.",
    "- Calm, specific, no hype, no emoji, no exclamation, no em dash. Under 280 characters. Sound like a helpful collector, not an ad.",
    "",
    'Respond as JSON only: {"skip": true} OR {"reply": "<text>", "mentionsFoil": <true|false>, "confidence": <0..1>}',
  ].join("\n");
}

/**
 * Draft an ADVISORY reply for one candidate (no specific card / no data needed).
 * Soft-fail: any error/parse miss/gate failure → skip/error, never throws. The
 * output is gate-validated to carry no figure, no link, and no spam pattern, so
 * an advisory reply is wrong-card-proof and spam-safe by construction.
 */
export async function draftAdvisoryReply(
  input: { post: XPost },
  deps: DraftDeps,
): Promise<DraftResult> {
  let raw: string;
  try {
    raw = await deps.generate(buildAdvisoryPrompt(input.post));
  } catch (err) {
    return { ok: false, reason: "error", detail: (err as Error).message };
  }
  const parsed = parseModelJson(raw);
  if (!parsed) return { ok: false, reason: "error", detail: "unparseable" };
  if (parsed.skip === true || typeof parsed.reply !== "string") return { ok: false, reason: "skip" };

  const reply = parsed.reply.trim();
  const gate = validateAdvisoryDraft(reply);
  if (gate) return { ok: false, reason: "gate_failed", detail: gate };

  return {
    ok: true,
    mode: "advisory",
    matchedCard: "",
    reply,
    dataCited: "",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
  };
}
