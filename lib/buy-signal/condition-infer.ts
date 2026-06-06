// Listing-condition inference (ROADMAP #32.1 / ADR-053 / PATTERN I-009). Pure,
// dependency-free. eBay's Browse V1 surface exposes no structured condition on
// the listing, so the buy signal must INFER the condition from the title before
// it can compare like-for-like against PokeTrace's per-tier sold averages.
//
// THE BUG THIS FIXES: the MVP compared the cheapest live listing (any/unknown
// condition — usually a played/damaged copy, or a lot, or a foreign-market
// card) against the Near-Mint-weighted sold average, so every flagship card
// flashed a large false BELOW. Conservatism is the whole point here: when we
// cannot confidently place the listing on the same axis as the reference, we
// return UNKNOWN and the badge does not render. A missing badge is correct; a
// confident-but-wrong badge is the failure.
//
// INFERENCE TABLE (first match wins, top to bottom):
//
//   Precedence  Trigger (case-insensitive, word-boundary)        -> tier     confidence
//   ----------  ------------------------------------------------    -------    ----------
//   1 market    japanese|japan|korean|chinese|german|french|        UNKNOWN   low
//               italian|spanish|portuguese|"jpn"|"jp "              (wrong market vs the English sold reference)
//   2 not-real  proxy|fake|repro|reproduction|custom|orica|         UNKNOWN   low
//               "art card"|altered                                  (not a comparable real single)
//   3 multi     lot|bundle|playset|"x2".."x99"|"(2)".."(99)"|        UNKNOWN   low
//               "set of"|"lot of"|"cards"|"complete set"             (not a single-card comparison)
//   4 graded    PSA|BGS|CGC|SGC followed by a grade, or isGraded    GRADED    high
//   5 raw full  "near mint"/"nm-mt"/"mint"                          NM        high
//               "lightly played"/"light play"                       LP        high
//               "moderately played"                                 MP        high
//               "heavily played"                                    HP        high
//               "damaged"/"poor condition"                          DMG       high
//   6 raw abbr  \bNM\b / \bLP\b / \bMP\b / \bHP\b / \bDMG\b         (as above) medium
//   7 vague     "played" (no degree) / "pl " / "used" / "wear"      UNKNOWN   low
//   8 default   no condition signal at all                          UNKNOWN   low
//
// Note: market / not-real / multi guards run BEFORE the condition phrases on
// purpose — a "Japanese Charizard NM" is the wrong market regardless of grade,
// and a "lot of 4 NM" is not a single-card comparison.

import { type ListingAspects, marketFromAspects, conditionFromAspects } from "./aspects.ts";

export type ListingConditionTier = "NM" | "LP" | "MP" | "HP" | "DMG" | "GRADED" | "UNKNOWN";
export type InferenceConfidence = "high" | "medium" | "low";

export type ConditionInference = {
  tier: ListingConditionTier;
  confidence: InferenceConfidence;
  evidence: string[];
  /** For GRADED listings with a named grading service: the PokeTrace tier key
   *  to compare against (e.g. "PSA_9", "BGS_9_5"). Undefined when the grade has
   *  no service (e.g. a bare "MT 8") — the reference resolver then returns
   *  UNKNOWN rather than comparing against the wrong grade (ROADMAP #32.3). */
  gradeKey?: string;
};

const MARKET_RE = /\b(japanese|japan|korean|korea|chinese|china|german|deutsch|french|fran[cç]ais|italian|italiano|spanish|espa[nñ]ol|portuguese|jpn|jp)\b/i;
const NOT_REAL_RE = /\b(proxy|fake|repro|reproduction|orica|altered|art\s*card|custom)\b/i;
// "lot", "bundle", "playset", "set of", "lot of", "x4", "(4)", "complete set",
// and a bare plural "cards" (a single card is "card").
const MULTI_RE = /\b(lot|bundle|playset|complete\s+set|set\s+of|lot\s+of)\b|\bx\s?\d{1,2}\b|\(\s?\d{1,2}\s?\)|\bcards\b/i;
// Named grading service + grade -> a SPECIFIC PokeTrace tier (PSA_9 ≠ PSA_10).
const GRADED_RE = /\b(PSA|BGS|CGC|SGC)\s*(10|\d(?:\.5)?)\b/i;
// A bare numeric grade attached to a raw/mint abbreviation but with NO grading
// service ("NM 7", "MT 8", "GEM MINT 10", "NM-MT 8.5"). The seller is denoting
// a GRADE, not a clean raw condition — so we must NOT infer NM/MT. Without a
// service we can't pick the right PokeTrace graded tier, so this routes to
// UNKNOWN (ROADMAP #32.3, fixing the "NM 7" -> Near Mint false-positive). The
// negative lookahead `(?!\s*\/)` keeps a collector number like "LP 6/102" from
// matching (the 6 is a card number, not a grade).
const BARE_GRADE_RE = /\b(?:GEM[\s-]*)?(?:NM[\s-]*MT|NEAR[\s-]*MINT|MINT|NM|MT|LP|MP|HP)\s*(?:10|[1-9](?:\.5)?)(?!\s*\/)\b/i;

/** Build the PokeTrace graded tier key from a service + grade ("PSA","9.5" -> "PSA_9_5"). */
function gradeKeyFor(service: string, grade: string): string {
  return `${service.toUpperCase()}_${grade.replace(".", "_")}`;
}

function pushIf(ev: string[], cond: boolean, note: string): void {
  if (cond) ev.push(note);
}

/**
 * Infer the condition tier of a single eBay/TCGplayer listing from its title
 * (and optional description / graded flag). Conservative by construction:
 * anything we can't confidently place returns UNKNOWN/low so the caller emits
 * no signal rather than a wrong one.
 */
export function inferListingCondition(input: {
  title: string | undefined | null;
  description?: string | null;
  isGraded?: boolean;
  /** eBay getItem item-specifics (ADR-057). When present (a record), they are
   *  AUTHORITATIVE for market + condition, preferred over title parsing. `null`
   *  means getItem was attempted but returned nothing → UNKNOWN (never a false
   *  cross-market deal). `undefined` = aspects not supplied → title-only path
   *  (back-compat for legacy callers + tests). */
  aspects?: ListingAspects | null;
}): ConditionInference {
  const title = (input.title ?? "").trim();
  const haystack = `${title} ${input.description ?? ""}`.trim();
  const evidence: string[] = [];

  if (!haystack && input.aspects == null) {
    return { tier: "UNKNOWN", confidence: "low", evidence: ["empty title"] };
  }

  // 1. Wrong market — a foreign-language listing can't be compared to the
  //    English-card sold reference. (Title-level catch; the aspect Language gate
  //    below catches the harder case where the title has no language word.)
  const market = haystack.match(MARKET_RE);
  if (market) {
    return { tier: "UNKNOWN", confidence: "low", evidence: [`non-English market marker: "${market[0]}"`] };
  }

  // 2. Not a real comparable single.
  const notReal = haystack.match(NOT_REAL_RE);
  if (notReal) {
    return { tier: "UNKNOWN", confidence: "low", evidence: [`not a real single: "${notReal[0]}"`] };
  }

  // 3. Multi-card listing — not a single-card comparison.
  const multi = haystack.match(MULTI_RE);
  if (multi) {
    return { tier: "UNKNOWN", confidence: "low", evidence: [`multi-card / lot marker: "${multi[0]}"`] };
  }

  // 3.5 ASPECT-FIRST PATH (ADR-057). When eBay item specifics are available they
  // are authoritative for BOTH market (language) and condition — preferred over
  // the title heuristics below. This is the like-for-like correctness gate.
  if (input.aspects !== undefined) {
    if (input.aspects === null) {
      // getItem attempted but returned nothing — we can't verify market/condition.
      return { tier: "UNKNOWN", confidence: "low", evidence: ["item specifics unavailable (getItem failed)"] };
    }
    const mkt = marketFromAspects(input.aspects);
    if (!mkt.isEnglish) {
      // The core fix: a Japanese listing whose title has no language word still
      // excludes here via Language: Japanese.
      return { tier: "UNKNOWN", confidence: "high", evidence: [`market gate: ${mkt.reason}`] };
    }
    const cond = conditionFromAspects(input.aspects);
    if (cond.tier !== "UNKNOWN" && !(cond.tier === "GRADED" && !cond.gradeKey)) {
      return { tier: cond.tier, confidence: "high", evidence: [mkt.reason, cond.evidence], gradeKey: cond.gradeKey };
    }
    // English confirmed, but the listing has no structured Card Condition/Grade
    // aspect (common on vintage listings). Fall THROUGH to the title-based
    // condition logic below — the market gate is already satisfied, so a
    // title-derived condition is still same-market like-for-like (PREFER aspects,
    // don't lose coverage when they're absent).
  }

  // 4. Graded slab with a NAMED service — strongest single-card signal, and we
  //    capture the SPECIFIC grade so the reference resolver compares PSA 9 vs
  //    PSA 9 (not vs a PSA-10-inflated blend). ROADMAP #32.3.
  const graded = haystack.match(GRADED_RE);
  if (graded) {
    const key = gradeKeyFor(graded[1], graded[2]);
    return { tier: "GRADED", confidence: "high", evidence: [`graded grade: "${graded[0]}" -> ${key}`], gradeKey: key };
  }
  if (input.isGraded) {
    // Flagged graded but no parseable grade in the title — we can't pick a
    // specific tier, so downstream resolves to UNKNOWN (no blended fallback).
    return { tier: "GRADED", confidence: "medium", evidence: ["isGraded flag set, no parseable grade"] };
  }

  // 4b. A bare numeric grade with NO grading service ("NM 7", "GEM MINT 10").
  //     Ambiguous — could be a slab grade or seller shorthand, but it is NOT a
  //     clean raw condition. Conservative: UNKNOWN (no service -> no comparable
  //     PokeTrace grade tier). This kills the "NM 7" -> Near Mint mis-inference.
  const bareGrade = haystack.match(BARE_GRADE_RE);
  if (bareGrade) {
    return { tier: "UNKNOWN", confidence: "low", evidence: [`numeric grade with no grading service: "${bareGrade[0].trim()}"`] };
  }

  const t = haystack.toUpperCase();

  // 5. Explicit raw condition phrases (high confidence).
  if (/\bNEAR[\s-]?MINT\b|\bNM[\s-]?MT\b|\bMINT\b/.test(t)) return { tier: "NM", confidence: "high", evidence: ["explicit near mint / mint"] };
  if (/\bLIGHTLY[\s-]?PLAYED\b|\bLIGHT[\s-]?PLAY\b/.test(t)) return { tier: "LP", confidence: "high", evidence: ["explicit lightly played"] };
  if (/\bMODERATELY[\s-]?PLAYED\b/.test(t)) return { tier: "MP", confidence: "high", evidence: ["explicit moderately played"] };
  if (/\bHEAVILY[\s-]?PLAYED\b/.test(t)) return { tier: "HP", confidence: "high", evidence: ["explicit heavily played"] };
  if (/\bDAMAGED\b|\bPOOR\s+CONDITION\b/.test(t)) return { tier: "DMG", confidence: "high", evidence: ["explicit damaged / poor"] };

  // 6. Raw abbreviations (medium — abbreviations are noisier than phrases).
  if (/\bNM\b/.test(t)) return { tier: "NM", confidence: "medium", evidence: ['abbreviation "NM"'] };
  if (/\bLP\b/.test(t)) return { tier: "LP", confidence: "medium", evidence: ['abbreviation "LP"'] };
  if (/\bMP\b/.test(t)) return { tier: "MP", confidence: "medium", evidence: ['abbreviation "MP"'] };
  if (/\bHP\b/.test(t)) return { tier: "HP", confidence: "medium", evidence: ['abbreviation "HP"'] };
  if (/\bDMG\b/.test(t)) return { tier: "DMG", confidence: "medium", evidence: ['abbreviation "DMG"'] };

  // 7. Vague wear words with no degree — can't place on the tier axis.
  const vague = t.match(/\bPLAYED\b|\bUSED\b|\bWEAR\b|\bCREASE/);
  if (vague) {
    return { tier: "UNKNOWN", confidence: "low", evidence: [`vague wear, no degree: "${vague[0].toLowerCase()}"`] };
  }

  // 8. No condition signal at all (typical of vintage holo titles).
  return { tier: "UNKNOWN", confidence: "low", evidence: ["no condition keyword in title"] };
}
