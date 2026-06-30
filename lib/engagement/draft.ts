// Engagement-brief reply drafting (ADR-086). For a candidate post we draft ONE
// calm, numbers-first, on-brand reply that cites REAL Foil sold-data — or skip
// it. The figures come from the injected market-movers facts (never invented),
// and a pure gate enforces the brand voice + honesty BEFORE a draft reaches the
// brief: no link, no em dash, no hype, and every $ figure must trace to the
// supplied data. The draft is text only — the engine never sends it (a human
// posts every reply by hand).

import type { XPost } from "../social/x-client.ts";

/** A real market-mover fact the reply may cite (from market_movers; PokeTrace). */
export type MoverFact = {
  cardName: string;
  avg7dUsd: number;
  avg30dUsd: number;
  momentumPct: number;
  sampleSize: number;
};

export type DraftResult =
  | { ok: true; matchedCard: string; reply: string; dataCited: string; confidence: number }
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

/** Build the drafting prompt. Pure — exposed for tests. */
export function buildDraftPrompt(post: XPost, facts: MoverFact[]): string {
  const factLines = facts
    .map((f) => `- ${f.cardName}: 7-day avg ${usd(f.avg7dUsd)}, 30-day avg ${usd(f.avg30dUsd)} (${f.sampleSize} sales, ${f.momentumPct > 0 ? "+" : ""}${f.momentumPct}% vs 30d)`)
    .join("\n");
  return [
    "You draft a single reply to a Pokemon TCG post on X for Foil (a deal-finder + market-insight tool, run by a Level-4 TCGplayer seller).",
    "GOAL: be genuinely helpful with real sold-data — not promotional. A human will post it by hand, so it must read like a knowledgeable person, never a bot.",
    "",
    "THE POST you are replying to:",
    `"""${post.text.slice(0, 400)}"""`,
    "",
    "REAL DATA you may cite (these are the ONLY figures allowed — never invent a number):",
    factLines || "(none)",
    "",
    "RULES (hard):",
    "- Reply ONLY if a specific card in the post matches one of the data rows above AND a sold-data figure genuinely helps. Otherwise SKIP.",
    "- Calm, numbers-first, specific. No hype, no emoji, no exclamation, no em dash.",
    "- NO link of any kind (no x.com, no foiltcg.com, no url).",
    "- Cite at most the supplied figures verbatim ($X). Frame any read as a read, not a fact.",
    "- Under 280 characters. Sound like a helpful collector, not an ad.",
    "",
    'Respond as JSON only: {"skip": true} OR {"matchedCard": "<name>", "reply": "<text>", "dataCited": "<which figure(s)>", "confidence": <0..1>}',
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
 * Draft a reply for one candidate. Soft-fail: any error/parse miss → skip, never
 * throws. Output is gate-validated before it can be returned ok.
 */
export async function draftReply(
  input: { post: XPost; facts: MoverFact[] },
  deps: DraftDeps,
): Promise<DraftResult> {
  if (input.facts.length === 0) return { ok: false, reason: "skip", detail: "no_data" };
  let raw: string;
  try {
    raw = await deps.generate(buildDraftPrompt(input.post, input.facts));
  } catch (err) {
    return { ok: false, reason: "error", detail: (err as Error).message };
  }
  const parsed = parseModelJson(raw);
  if (!parsed) return { ok: false, reason: "error", detail: "unparseable" };
  if (parsed.skip === true || typeof parsed.reply !== "string") return { ok: false, reason: "skip" };

  const reply = parsed.reply.trim();
  const gate = validateDraft(reply, suppliedFigures(input.facts));
  if (gate) return { ok: false, reason: "gate_failed", detail: gate };

  return {
    ok: true,
    matchedCard: typeof parsed.matchedCard === "string" ? parsed.matchedCard : "",
    reply,
    dataCited: typeof parsed.dataCited === "string" ? parsed.dataCited : "",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
  };
}
