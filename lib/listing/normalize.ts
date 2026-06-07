// Identity-aspect normalizers for the verified-listing resolver.
// Pure, dependency-free, heavily unit-tested. Implements the value-format
// findings from build-step-0 (docs/probe-findings-listing-aspects-2026-06-06.md):
// eBay's Set / Card Number / Finish item-specific VALUES are eBay's own strings,
// not SDK/catalog values, so matching needs normalization — NEVER raw equality.
//
// These are deliberately a FIRST CUT calibrated by the resolver calibration
// sweep (docs/calibration-resolver-2026-06.md). The 50-reject audit tunes the
// thresholds/alias map; keep the knobs centralized here.

// ---------------------------------------------------------------------------
// Set
// ---------------------------------------------------------------------------

/** Tokens that are noise when comparing set names (don't disambiguate a set). */
const SET_NOISE_TOKENS = new Set(["the", "pokemon", "pokémon", "tcg", "ccg", "trading", "card", "game"]);

/** Known SDK-setName → canonical eBay-set aliases for cases the generic
 *  normalizer can't bridge. Extend from the calibration audit, not by guess.
 *  (Calibration 2026-06: the former "base"→"base set" alias was REMOVED — it was
 *  redundant with the token-subset match ("base" ⊆ "base set") AND it broke legit
 *  Base Set variant names like "Base Unlimited Shadow" by forcing the "set"
 *  token. Empty until a case genuinely needs one.) */
const SET_ALIASES: Record<string, string> = {};

/**
 * Normalize a set name to a comparable token string: lowercase, '&'→'and', strip
 * a leading 4-digit year ("2000 Neo Genesis"→"neo genesis"), strip a leading
 * set-code prefix ("SV01: Scarlet & Violet…"→"scarlet and violet…"), drop
 * punctuation, collapse whitespace.
 */
export function normalizeSetName(raw: string): string {
  let s = (raw ?? "").toLowerCase().trim();
  s = s.replace(/&/g, " and ");
  s = s.replace(/^\d{4}\s+/, ""); // leading year
  s = s.replace(/^[a-z0-9]+:\s*/i, ""); // leading set-code "sv01: "
  s = s.replace(/[^a-z0-9\s]+/g, " "); // punctuation → space
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function meaningfulTokens(norm: string): string[] {
  return norm.split(" ").filter((t) => t && !SET_NOISE_TOKENS.has(t));
}

/** A set-DISAMBIGUATING version token — the arabic "2" in "Base Set 2" OR the
 *  roman "ii" in "Base II" / "Pokemon Game Base II" (calibration 2026-06 found
 *  eBay labels Base Set 2 both ways). Its presence in the superset's extra
 *  tokens blocks a subset match so a Base Set 2 listing never matches Base Set. */
function isVersionToken(t: string): boolean {
  return /^\d{1,2}$/.test(t) || /^(ii|iii|iv|v|vi)$/.test(t);
}

export type SetMatch = { match: boolean; reason: string };

/**
 * Does the eBay Set string identify the same set as the SDK setName?
 * Corroborating semantics: the caller treats ABSENCE as non-fatal, but a
 * PRESENT-and-MISMATCHED set as a hard reject — so this must avoid both
 * false-rejecting ("Neo Genesis" vs "2000 Neo Genesis") and false-accepting
 * ("Base Set" vs "Base Set 2").
 */
export function setMatches(sdkSetName: string, ebaySet: string): SetMatch {
  const a0 = normalizeSetName(sdkSetName);
  const b0 = normalizeSetName(ebaySet);
  const a = SET_ALIASES[a0] ?? a0;
  const b = SET_ALIASES[b0] ?? b0;
  if (!a || !b) return { match: false, reason: "empty set name" };
  if (a === b) return { match: true, reason: `exact: "${b0}"` };

  const ta = meaningfulTokens(a);
  const tb = meaningfulTokens(b);
  const sa = new Set(ta);
  const sb = new Set(tb);
  const subset = (small: string[], big: Set<string>) => small.length > 0 && small.every((t) => big.has(t));

  // Token-subset match in either direction (handles "base" ⊆ "base set",
  // "scarlet and violet" ⊆ "scarlet and violet base set").
  if (subset(ta, sb)) {
    const extra = tb.filter((t) => !sa.has(t));
    if (extra.some(isVersionToken)) return { match: false, reason: `version-token mismatch: "${b0}" vs "${a0}"` };
    return { match: true, reason: `subset: "${a0}" ⊆ "${b0}"` };
  }
  if (subset(tb, sa)) {
    const extra = ta.filter((t) => !sb.has(t));
    if (extra.some(isVersionToken)) return { match: false, reason: `version-token mismatch: "${a0}" vs "${b0}"` };
    return { match: true, reason: `subset: "${b0}" ⊆ "${a0}"` };
  }
  return { match: false, reason: `set mismatch: "${a0}" vs "${b0}"` };
}

// ---------------------------------------------------------------------------
// Collector number
// ---------------------------------------------------------------------------

export type ParsedNumber = { token: string; numeric: number | null };

/**
 * Extract the collector number from an eBay Card Number value. Handles the
 * observed formats: "No. 157"→157, "18/111"→18, "004/102"→4 (zero-pad), "DP46"
 * (alphanumeric promo, kept whole), "136/135"→136 (secret-rare left>right —
 * passed VERBATIM, never "corrected"), bare "4"→4.
 */
export function parseCollectorNumber(raw: string): ParsedNumber {
  let s = (raw ?? "").trim();
  if (!s) return { token: "", numeric: null };
  s = s.replace(/^no\.?\s*/i, ""); // "No. 157" → "157"
  const beforeSlash = s.split("/")[0].trim(); // "18/111" → "18"
  const token = beforeSlash.toUpperCase();
  if (/^\d+$/.test(beforeSlash)) return { token, numeric: parseInt(beforeSlash, 10) };
  return { token, numeric: null }; // alphanumeric promo (DP46, SWSH284, etc.)
}

export type NumberMatch = { match: boolean; reason: string };

/**
 * Does the eBay card number identify the same print as the SDK number?
 * Numeric values compare with zero-pad tolerance (parseInt); alphanumeric
 * promos compare as case-insensitive tokens. 17 vs 18 → MISMATCH (different
 * cards — the production wrong-print bug).
 */
export function numberMatches(sdkNumber: string, ebayNumber: string): NumberMatch {
  const a = parseCollectorNumber(sdkNumber);
  const b = parseCollectorNumber(ebayNumber);
  if (!a.token || !b.token) return { match: false, reason: "empty number" };
  if (a.numeric != null && b.numeric != null) {
    return a.numeric === b.numeric
      ? { match: true, reason: `numeric: ${a.numeric}` }
      : { match: false, reason: `number mismatch: ${a.numeric} vs ${b.numeric}` };
  }
  return a.token === b.token
    ? { match: true, reason: `token: ${a.token}` }
    : { match: false, reason: `number mismatch: "${a.token}" vs "${b.token}"` };
}

// ---------------------------------------------------------------------------
// Finish
// ---------------------------------------------------------------------------

export type Finish = "holo" | "reverse-holo" | "normal" | null;

/** Normalize an eBay Finish/Features value to a canonical finish, or null when
 *  it carries no finish signal (e.g. "Unlimited" is an edition, not a finish). */
export function normalizeFinish(raw: string | null | undefined): Finish {
  const s = (raw ?? "").toLowerCase();
  if (!s) return null;
  if (/reverse/.test(s)) return "reverse-holo"; // before holo ("reverse holo" contains "holo")
  if (/non-?holo|regular|normal/.test(s)) return "normal"; // before holo ("non-holo" contains "holo")
  if (/holo|foil/.test(s)) return "holo";
  return null;
}

/** Expected finish for a PokeTrace variantKey ("holofoil"→holo,
 *  "reverse-holofoil"→reverse-holo, "non-holo"→normal). null for unknowns. */
export function finishForVariantKey(variantKey: string | undefined | null): Finish {
  const v = (variantKey ?? "").toLowerCase();
  if (!v) return null;
  if (/reverse/.test(v)) return "reverse-holo"; // before holo
  if (/non-?holo|normal/.test(v)) return "normal"; // before holo ("non-holo" contains "holo")
  if (/holo|foil/.test(v)) return "holo";
  return null;
}
