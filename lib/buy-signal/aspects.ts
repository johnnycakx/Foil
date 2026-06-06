// eBay Browse getItem `localizedAspects` reader (ADR-057). Pure, dependency-free.
//
// The buy signal must compare like-for-like. eBay's item_summary/search surface
// exposes NO item specifics (verified live 2026-06-05), only a coarse top-level
// `condition` enum. The full `localizedAspects` array — Card Condition, Language,
// Graded/Grade, Country/Region — is only on getItem. This module parses that
// array and answers two questions structurally (preferred over title parsing):
//   1. market: is this an English-language card? (false cross-market deals — a
//      Japanese listing whose TITLE has no language word but whose Language
//      specific says "Japanese" — were the bug this fixes)
//   2. condition: the seller's stated Card Condition / graded grade.
//
// Aspect names + values are the EXACT strings eBay returns (probe 2026-06-05):
//   Card Condition = "Near Mint or Better" | "Lightly Played (Excellent)" |
//     "Moderately Played (Very Good)" | "Heavily Played (Poor)" | "Damaged"
//   Language = "English" | "Japanese" | …
//   Graded = "Yes" | "No"; (graded slabs add "Professional Grader" + "Grade")
//   Country/Region of Manufacture / Country of Origin = "Japan" | …

/** Inferred listing condition tier (mirrors condition-infer's union; kept local
 *  to avoid a circular import — condition-infer imports FROM this module). */
export type AspectTier = "NM" | "LP" | "MP" | "HP" | "DMG" | "GRADED" | "UNKNOWN";

/** Flattened name→value map (names lowercased). */
export type ListingAspects = Record<string, string>;

/** Build the flattened map from eBay's raw localizedAspects array. Exported so
 *  ebay-browse.ts and the unit tests share one parser. */
export function aspectsFromLocalized(
  localized: ReadonlyArray<Record<string, unknown>> | null | undefined,
): ListingAspects {
  const out: ListingAspects = {};
  for (const a of localized ?? []) {
    if (typeof a?.name === "string" && typeof a?.value === "string") {
      const name = a.name.trim().toLowerCase();
      const value = a.value.trim();
      if (name && value) out[name] = value;
    }
  }
  return out;
}

function get(aspects: ListingAspects, name: string): string | null {
  const v = aspects[name.toLowerCase()];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export type MarketCheck = {
  /** v1 gate: only English-language cards match the English sold reference. */
  isEnglish: boolean;
  language: string | null;
  region: string | null;
  reason: string;
};

/**
 * v1 market gate. The listing must be an explicitly English-language card to be
 * compared against the (English/US) PokeTrace sold reference. Missing or
 * non-English Language → not English (exclude). Region is captured for evidence
 * but language is the decisive signal (English cards ship from many regions).
 */
export function marketFromAspects(aspects: ListingAspects): MarketCheck {
  const language = get(aspects, "Language");
  const region = get(aspects, "Country/Region of Manufacture") ?? get(aspects, "Country of Origin");
  const isEnglish = language != null && language.toLowerCase() === "english";
  const reason = isEnglish
    ? `Language: ${language}`
    : language
      ? `non-English market (Language: ${language})`
      : "no Language item specific";
  return { isEnglish, language, region, reason };
}

const RAW_CARD_CONDITION: Array<[RegExp, Exclude<AspectTier, "GRADED" | "UNKNOWN">]> = [
  [/near\s*mint|mint or better/i, "NM"],
  [/lightly\s*played|excellent/i, "LP"],
  [/moderately\s*played|very\s*good/i, "MP"],
  [/heavily\s*played|\bpoor\b/i, "HP"],
  [/damaged/i, "DMG"],
  // Bare "Mint" last so it doesn't shadow "Near Mint" / "Heavily Played (Poor)".
  [/\bmint\b/i, "NM"],
];

const GRADER_SERVICE: Array<[RegExp, string]> = [
  [/psa|professional sports authenticator/i, "PSA"],
  [/bgs|beckett/i, "BGS"],
  [/\bcgc\b/i, "CGC"],
  [/\bsgc\b/i, "SGC"],
];

export type AspectCondition = { tier: AspectTier; gradeKey?: string; evidence: string };

/**
 * Condition from item specifics. Graded slabs (Graded=Yes / a Grade / a
 * Professional Grader) resolve to a grade-SPECIFIC PokeTrace key (PSA_10) when
 * service + grade parse, else GRADED-without-gradeKey (the caller emits UNKNOWN
 * — no blended fallback, per PATTERN I-009). Raw cards map the Card Condition
 * enum. Returns UNKNOWN when nothing is determinable.
 */
export function conditionFromAspects(aspects: ListingAspects): AspectCondition {
  const graded = get(aspects, "Graded");
  const grade = get(aspects, "Grade");
  const grader = get(aspects, "Professional Grader") ?? get(aspects, "Grader");
  const isGraded = (graded != null && /^yes$/i.test(graded)) || grade != null || grader != null;
  if (isGraded) {
    const svc = grader ? GRADER_SERVICE.find(([re]) => re.test(grader))?.[1] : undefined;
    const g = grade?.match(/\b(10|[1-9](?:\.5)?)\b/)?.[1];
    if (svc && g) return { tier: "GRADED", gradeKey: `${svc}_${g.replace(".", "_")}`, evidence: `graded ${svc} ${g}` };
    return { tier: "GRADED", evidence: `graded, service/grade not parseable (Graded=${graded ?? "?"}, Grader=${grader ?? "?"}, Grade=${grade ?? "?"})` };
  }
  const cc = get(aspects, "Card Condition");
  if (cc) {
    const hit = RAW_CARD_CONDITION.find(([re]) => re.test(cc));
    if (hit) return { tier: hit[1], evidence: `Card Condition: ${cc}` };
    return { tier: "UNKNOWN", evidence: `unrecognized Card Condition: ${cc}` };
  }
  return { tier: "UNKNOWN", evidence: "no Card Condition item specific" };
}
