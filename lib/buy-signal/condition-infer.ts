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

export type ListingConditionTier = "NM" | "LP" | "MP" | "HP" | "DMG" | "GRADED" | "UNKNOWN";
export type InferenceConfidence = "high" | "medium" | "low";

export type ConditionInference = {
  tier: ListingConditionTier;
  confidence: InferenceConfidence;
  evidence: string[];
};

const MARKET_RE = /\b(japanese|japan|korean|korea|chinese|china|german|deutsch|french|fran[cç]ais|italian|italiano|spanish|espa[nñ]ol|portuguese|jpn|jp)\b/i;
const NOT_REAL_RE = /\b(proxy|fake|repro|reproduction|orica|altered|art\s*card|custom)\b/i;
// "lot", "bundle", "playset", "set of", "lot of", "x4", "(4)", "complete set",
// and a bare plural "cards" (a single card is "card").
const MULTI_RE = /\b(lot|bundle|playset|complete\s+set|set\s+of|lot\s+of)\b|\bx\s?\d{1,2}\b|\(\s?\d{1,2}\s?\)|\bcards\b/i;
const GRADED_RE = /\b(PSA|BGS|CGC|SGC)\s*\d{1,2}(?:\.5)?\b/i;

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
}): ConditionInference {
  const title = (input.title ?? "").trim();
  const haystack = `${title} ${input.description ?? ""}`.trim();
  const evidence: string[] = [];

  if (!haystack) {
    return { tier: "UNKNOWN", confidence: "low", evidence: ["empty title"] };
  }

  // 1. Wrong market — a foreign-language listing can't be compared to the
  //    English-card sold reference.
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

  // 4. Graded slab — strongest single-card signal.
  const graded = haystack.match(GRADED_RE);
  if (input.isGraded || graded) {
    pushIf(evidence, !!input.isGraded, "isGraded flag set");
    pushIf(evidence, !!graded, `graded grade: "${graded?.[0]}"`);
    return { tier: "GRADED", confidence: "high", evidence };
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
