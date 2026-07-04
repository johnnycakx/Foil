// Receipts reply drafting (x-reply-desk, ADR-107). For a resolved card with
// real sold figures, draft ONE calm reply in John's Level-4-seller voice that
// attaches the receipts (the exact figures) — link-free PROSE from the model,
// then the engine appends the UTM-tagged card-page link deterministically (the
// model can never fabricate a link or the wrong slug).
//
// THE SAME figure/hedge gates as the engagement engine, verbatim:
//   - validateDraft (lib/engagement/draft.ts): every $ figure must trace to the
//     supplied set, no link, no em dash, no hype, 15..280 chars.
//   - voiceCheck (lib/seo/voice-check.ts): no hedged/vague numbers ("around
//     $X", "~N"), no banned phrases — the L4 voice cites exact figures.
// A draft that fails either is NOT shipped; the engine falls back to a
// deterministic figure-free line + the card link (honest, always gate-clean).
//
// Null over guess: an unresolvable card yields the CLARIFY line (ask for
// set/number, no figures, no link); a resolved card with no data yields the
// FIGURE-FREE line (the card-page link, no numbers).

import type { ReceiptSold } from "./facts.ts";
import { usd, validateDraft } from "../engagement/draft.ts";
import { voiceCheck } from "../seo/voice-check.ts";

/** How many model attempts to spend gating a receipts draft before falling
 *  back to the figure-free line. Two keeps cost bounded for a manual tool
 *  while materially lifting the gate-pass rate over a single shot. */
export const RECEIPTS_DRAFT_ATTEMPTS = 2;

/** Deterministic, always-gate-clean line when the card can't be resolved
 *  (null over guess — never a figure, never a link, John's voice). */
export const CLARIFY_LINE =
  "Happy to check what that one's actually selling for. Which set and number is it? It's in the bottom corner of the card.";

/** Deterministic figure-free line when the card resolves but we have no sold
 *  data we stand behind — the card-page link carries the live data instead. */
export function figureFreeReply(cardPageUrl: string): string {
  return `Pulled it up, here's the live sold data and current listings: ${cardPageUrl}`;
}

/**
 * Build the drafting prompt for a resolved card with real figures. Pure —
 * exposed for tests. `context` is the post John is replying to (empty for a
 * standalone receipts request). The model writes LINK-FREE prose only; the
 * engine appends the card link, so we tell it to leave room for one.
 */
export function buildReceiptsPrompt(context: string, cardLabel: string, sold: ReceiptSold): string {
  const windowLabel = sold.source === "movers" ? "last 30 days" : "recent sales";
  const figures: string[] = [`${usd(sold.avgUsd)} average over the ${windowLabel}`];
  if (sold.recentUsd != null) figures.push(`${usd(sold.recentUsd)} average over the last 7 days`);
  const sampleLine = sold.sampleSize ? ` across ${sold.sampleSize} sales on record` : "";
  const tier = sold.tierLabel ? ` (${sold.tierLabel})` : "";

  const lines = [
    "You are John, a Level-4 TCGplayer seller, drafting ONE short reply on X for Foil (his live Pokemon-card sold-data tool). You will post it BY HAND, so it must read like a knowledgeable seller talking to another collector, never like an ad or a bot.",
    "GOAL: attach the RECEIPTS. Lead with what this exact card actually sells for, calm and specific. A card-page link is appended AFTER your text, so do NOT write any link yourself and leave a little room (aim for under 210 characters).",
    "",
  ];
  if (context.trim()) {
    lines.push("THE POST you are replying to:", `"""${context.slice(0, 400)}"""`, "");
  }
  lines.push(
    `The card is: ${cardLabel}${tier}.`,
    "Its REAL recent sold figures (the ONLY numbers you may use, verbatim, never invented or rounded differently):",
    ...figures.map((f) => `- ${f}${sampleLine}`),
    "",
    "RULES (hard):",
    "- Cite the exact figures above verbatim ($X). Never hedge a number: no 'around', 'about', 'roughly', '~'. State it plainly.",
    "- Frame any market read as a read, not a promise. No hype, no emoji, no exclamation, no em dash.",
    "- Do NOT write any link or URL (one is appended for you).",
    "- Under 210 characters. Sound like John, a seller who knows the card.",
    "",
    'Respond as JSON only: {"skip": true} OR {"reply": "<link-free text>", "confidence": <0..1>}',
  );
  return lines.join("\n");
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
 * Gate a receipts draft's LINK-FREE prose. Reuses the engagement figure/hedge
 * gates verbatim (validateDraft against the supplied figures + voiceCheck for
 * hedged/vague numbers). Returns null when clean, or a reason string.
 */
export function validateReceiptsProse(prose: string, allowedFigures: Set<string>): string | null {
  const base = validateDraft(prose, allowedFigures);
  if (base) return base;
  const vc = voiceCheck(prose);
  if (!vc.passed) return `voice:${vc.violations.map((v) => v.kind).join(",")}`;
  return null;
}

export type ReceiptsProseDeps = { generate: (prompt: string) => Promise<string> };

/**
 * Draft the link-free receipts prose for a resolved card with figures. Up to
 * RECEIPTS_DRAFT_ATTEMPTS model calls, gated each time; returns the first
 * gate-clean prose, or null (the engine then falls back to the figure-free
 * line). Soft-fail: any error/parse miss counts as a failed attempt.
 */
export async function draftReceiptsProse(
  input: { context: string; cardLabel: string; sold: ReceiptSold; allowedFigures: Set<string> },
  deps: ReceiptsProseDeps,
): Promise<string | null> {
  const prompt = buildReceiptsPrompt(input.context, input.cardLabel, input.sold);
  for (let attempt = 0; attempt < RECEIPTS_DRAFT_ATTEMPTS; attempt++) {
    let raw: string;
    try {
      raw = await deps.generate(prompt);
    } catch {
      continue;
    }
    const parsed = parseModelJson(raw);
    if (!parsed || parsed.skip === true || typeof parsed.reply !== "string") continue;
    const prose = parsed.reply.trim();
    if (!validateReceiptsProse(prose, input.allowedFigures)) return prose;
  }
  return null;
}
