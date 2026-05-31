// Brand-voice check (Goal V / ADR-048).
//
// A *verification lens*, not a runtime gate. It scores text against the tone +
// trust rules in docs/BRAND-VOICE.md and surfaces the writing patterns that
// fabrication-prone or hype-y copy exhibits:
//
//   A. Unsourced proprietary stat — a "Foil's (scan) data" citation co-located
//      with a quantified claim (the §6 fixtures 1 & 3 signature).
//   B. Vague / hedged numbers — "around $120", "roughly 18%", "~270", "2×",
//      "(approximate)" (fixtures 2, 3, 4). The voice demands exact figures.
//   C. Ban phrases — the hype words + AI tells in BANNED_PHRASES.
//
// Honest limit (documented in BRAND-VOICE.md §6): this is a tone/trust-signature
// net, NOT a fact-checker. It cannot know a price is wrong or that "Gardevoir ex
// SAR from 151" is a factual error — only quality-gates 9/10 + human review do
// that. It is deliberately NOT wired as a hard generation gate: detector A would
// false-positive on a *legitimate* sourced Foil-data citation (which gate 10
// validates properly with provenance context). Live enforcement of the ban list
// runs through gate (e) (BANNED_PHRASES); this function is for tests + manual
// voice linting.

import { BANNED_PHRASES, FOIL_DATA_CITATION_TRIGGERS } from "./quality-gates.ts";

export type VoiceViolationKind =
  | "unsourced_proprietary_stat"
  | "vague_number"
  | "banned_phrase";

export type VoiceViolation = {
  kind: VoiceViolationKind;
  detail: string;
};

export type VoiceCheckResult = {
  passed: boolean;
  violations: VoiceViolation[];
};

// A quantified claim: a percentage, a dollar amount, an N× multiplier, or an
// "N cards/items" count. Used to decide whether a proprietary-data citation is
// asserting a statistic (which must be sourced) vs. just naming the product.
const QUANTIFIED_CLAIM =
  /(\b\d[\d,]*\s*%|\$\s?\d|\b\d[\d,]*\s*[×x]\b|\b\d[\d,]*\s+(?:cards?|items?|listings?|scans?)\b)/i;

// Vague / hedged number signatures. The voice rule: numbers are always exact.
const VAGUE_NUMBER_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(?:around|about|roughly|approximately)\s*\$?\s?\d/i, label: "hedged quantity (around/about/roughly + number)" },
  { re: /~\s?\d/, label: "tilde-approximated number (~N)" },
  { re: /\(approx(?:imate|\.)?\)/i, label: "(approximate) tag on a figure" },
  { re: /\b(?:roughly|about|around)\s+\d[\d,]*\s*[×x]\b/i, label: "vague multiplier (roughly N×)" },
  { re: /\b\d[\d,]*\s*[×x]\s+the\s+rate\b/i, label: "unsourced 'N× the rate' claim" },
];

/** Split into rough sentences for the co-location check in detector A. */
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Run the brand-voice check. Returns every violation so a caller (or a retry
 * prompt) sees the full list, not just the first.
 */
export function voiceCheck(text: string): VoiceCheckResult {
  const violations: VoiceViolation[] = [];
  const lower = text.toLowerCase();

  // C. Ban phrases (hype + AI tells).
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      violations.push({ kind: "banned_phrase", detail: `"${phrase}"` });
    }
  }

  // B. Vague / hedged numbers.
  for (const { re, label } of VAGUE_NUMBER_PATTERNS) {
    const m = text.match(re);
    if (m) {
      violations.push({ kind: "vague_number", detail: `${label}: "${m[0].trim()}"` });
    }
  }

  // A. Unsourced proprietary stat: a proprietary-data citation in the same
  // sentence as a quantified claim. The voice/trust rule requires such a number
  // to trace to real pipeline data; the check flags the rhetorical pattern.
  for (const sentence of sentences(text)) {
    const citesFoilData = FOIL_DATA_CITATION_TRIGGERS.some((t) =>
      sentence.toLowerCase().includes(t.toLowerCase()),
    );
    if (citesFoilData && QUANTIFIED_CLAIM.test(sentence)) {
      const snippet = sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence;
      violations.push({ kind: "unsourced_proprietary_stat", detail: `"${snippet}"` });
    }
  }

  return { passed: violations.length === 0, violations };
}
