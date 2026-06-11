// Identity gates for the verified-listing resolver. Pure, dependency-free.
//
// THE ARCHITECTURAL FIX (DESIGN-VERIFIED-LISTING-RESOLVER.md): this is the SINGLE
// admission gate. A listing is shown to a user ONLY if it passes identity here —
// title parsing may pre-filter candidates upstream, but it never admits one.
// Replaces the split where the picker (title-only) decided what users saw while
// only the buy-signal classifier checked language/condition (ADR-057). The
// Japanese-Typhlosion production bug (item 117223259644) is rejected here.
//
// GATE TAXONOMY (build plan #1.4 — corroborating semantics, precisely):
//   - HARD gates (failure = reject): language, finish (when a variant is
//     requested), graded-vs-raw + condition.
//   - CORROBORATING gates: set, number. ABSENCE is NOT fatal (the listing can
//     still pass on the hard gates), but PRESENCE-WITH-MISMATCH is ALWAYS a hard
//     reject — 17 vs 18 are different cards. (Probe: Set/Number present 75-100%
//     of the time, so corroboration fires often; absence is the minority.)
//
// Probe-driven specifics (docs/probe-findings-listing-aspects-2026-06-06.md):
//   - Set/Number values are eBay strings → normalize (lib/listing/normalize.ts).
//   - Graded detection must NOT rely on `Graded: Yes` alone (blank on real
//     slabs) → also check Grading Company / Grade / Professional Grader / the
//     top-level condition == "Graded".
//   - Language item-specific is absent on a slice (esp. graded) → hard-exclude
//     when present-and-non-English, else fall back to the title market marker.

import { type ListingAspects, marketFromAspects } from "../buy-signal/aspects.ts";
import { titleSuggestsForeignMarket } from "../buy-signal/condition-infer.ts";
import { inferListingCondition, type ListingConditionTier } from "../buy-signal/condition-infer.ts";
import { setMatches, numberMatches, finishForVariantKey, normalizeFinish } from "./normalize.ts";

/** Raw tiers (NM..DMG), ANY_RAW (any non-graded), ANY_GRADED (any slab — the
 *  wishlist "Any (Graded)" token; goal #3), or a specific graded grade. */
export type ResolveCondition =
  | "NM" | "LP" | "MP" | "HP" | "DMG"
  | "ANY_RAW"
  | "ANY_GRADED"
  | { graded: { service: "PSA" | "BGS" | "CGC" | "SGC"; grade: string } };

/** What the card IS — the expected identity, from catalog + SDK metadata. */
export type IdentityTarget = {
  setName: string;
  setId: string;
  number: string;
  name: string;
  /** PokeTrace variantKey the caller pinned (the page's ?v=); undefined → the
   *  Finish gate is a no-op (an un-targeted resolve accepts any finish of the
   *  right card). */
  requestedVariant?: string;
};

export type GateName = "language" | "set" | "number" | "finish" | "graded_condition";

export type GateDecision = {
  gate: GateName;
  /** A hard gate fails the whole verdict; a corroborating gate fails only on
   *  present-and-mismatched. */
  hard: boolean;
  /** Was the relevant aspect present to evaluate? (presence-rate telemetry) */
  present: boolean;
  pass: boolean;
  reason: string;
};

export type IdentityVerdict = {
  pass: boolean;
  gates: GateDecision[];
  /** First failing reason (for the trace), or "all gates passed". */
  reason: string;
  /** Derived condition tier of the listing (for display + the buy signal). */
  condition: ListingConditionTier;
  /** The evidence values read off the listing — DERIVED/transient, never
   *  persisted as listing data (R-008). */
  verifiedAspects: { set: string | null; number: string | null; finish: string | null; language: string | null; graded: boolean };
};

function aspect(a: ListingAspects, name: string): string | null {
  const v = a[name.toLowerCase()];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Numeric grade shape: 1-10, optional .5, optional "GEM MINT" prefix. A bare
 *  "Grade" aspect only counts as a slab signal when it looks like THIS — not a
 *  card number ("9") that happens to be numeric is fine, but a condition phrase
 *  ("Heavily Played (Poor)") or other stray text is not a grade. (The card-number
 *  collision is handled by the explicit-raw veto below, which fires first.) */
const NUMERIC_GRADE_RE = /^(?:gem[\s-]*mint[\s-]*)?(?:10|[1-9](?:\.5)?)$/i;

/**
 * Graded detection per the probe: ANY of the graded signals, not just
 * `Graded: Yes`. CALIBRATION 2026-06 refinement (false-positive fix, NOT a
 * loosening — real slabs are still detected by every strong signal): an explicit
 * `Graded: No` or a top-level condition of `Ungraded` VETOES a bare/noisy `Grade`
 * aspect. Raw listings were observed carrying a stray `Grade` holding the CARD
 * NUMBER ("9") or a CONDITION phrase ("Heavily Played (Poor)") while the listing
 * said `Graded: No` / `Ungraded` — those are raw cards and must NOT read as
 * slabs (the neo2-9-poliwrath false-reject). The veto only ever overrides the
 * weak bare-`Grade` signal; the strong signals (top `Graded`, `Graded: Yes`,
 * Grading Company / Professional Grader / Grader) are authoritative and win
 * outright, so a real slab can never be vetoed into "raw" (zero false-accept).
 */
export function detectGraded(aspects: ListingAspects, topCondition: string | null): boolean {
  const top = (topCondition ?? "").toLowerCase();
  const gradedAspect = aspect(aspects, "Graded");
  // STRONG, authoritative slab signals — never vetoed.
  if (top === "graded") return true;
  if (gradedAspect && /^yes$/i.test(gradedAspect)) return true;
  if (aspect(aspects, "Grading Company")) return true;
  if (aspect(aspects, "Professional Grader")) return true;
  if (aspect(aspects, "Grader")) return true;
  // EXPLICIT RAW signals veto the weak bare-`Grade` aspect below.
  if ((gradedAspect && /^no$/i.test(gradedAspect)) || top === "ungraded") return false;
  // A bare `Grade` with no grading service is a slab signal only when it is a
  // real numeric grade (the probe's blank-`Graded` slab case).
  const grade = aspect(aspects, "Grade");
  if (grade && NUMERIC_GRADE_RE.test(grade.trim())) return true;
  return false;
}

const GRADER_SERVICE_RE = /\b(PSA|BGS|CGC|SGC)\b|beckett/i;

/** Resolve the grade-SPECIFIC PokeTrace key (e.g. "PSA_9", "BGS_9_5") from the
 *  graded aspects. Reads the service from Grading Company / Professional Grader /
 *  Grader (the probe found the service lives in "Grading Company" on many slabs,
 *  which the buy-signal `conditionFromAspects` does NOT check — so the resolver
 *  computes it locally rather than mutating that shared classifier this goal).
 *  null when service + grade can't both be parsed (→ a graded-condition resolve
 *  returns UNKNOWN, never a cross-grade blend). */
export function gradedGradeKey(aspects: ListingAspects): string | null {
  const svcRaw = aspect(aspects, "Grading Company") ?? aspect(aspects, "Professional Grader") ?? aspect(aspects, "Grader");
  const gradeRaw = aspect(aspects, "Grade");
  if (!svcRaw || !gradeRaw) return null;
  const m = svcRaw.match(GRADER_SERVICE_RE);
  const svc = m ? (/beckett/i.test(m[0]) ? "BGS" : m[0].toUpperCase()) : null;
  const g = gradeRaw.match(/\b(10|[1-9](?:\.5)?)\b/)?.[1];
  if (!svc || !g) return null;
  return `${svc}_${g.replace(".", "_")}`;
}

type RawCondition = "NM" | "LP" | "MP" | "HP" | "DMG" | "ANY_RAW";
function conditionIsRaw(c: ResolveCondition): c is RawCondition {
  return typeof c === "string" && c !== "ANY_GRADED";
}

/**
 * Verify a candidate listing's identity against the card it claims to be.
 * Returns a verdict + per-gate decisions (the resolver's telemetry trace).
 */
export function verifyIdentity(input: {
  target: IdentityTarget;
  aspects: ListingAspects;
  topCondition: string | null;
  title: string;
  condition: ResolveCondition;
}): IdentityVerdict {
  const { target, aspects, topCondition, title, condition } = input;
  const gates: GateDecision[] = [];

  const language = aspect(aspects, "Language");
  const setVal = aspect(aspects, "Set") ?? aspect(aspects, "Set Name");
  const numberVal = aspect(aspects, "Card Number") ?? aspect(aspects, "Number");
  const finishVal = aspect(aspects, "Finish") ?? aspect(aspects, "Features");
  const graded = detectGraded(aspects, topCondition);

  // --- 1. Language (HARD). Present → must be English; absent → title fallback.
  {
    const mkt = marketFromAspects(aspects);
    if (language) {
      gates.push({ gate: "language", hard: true, present: true, pass: mkt.isEnglish, reason: mkt.reason });
    } else {
      // Aspect absent → fall back to the title market marker (single source:
      // condition-infer) + the foreign-Set tell. Presumed-English only when
      // neither fires.
      const foreignTitle = titleSuggestsForeignMarket(`${title} ${setVal ?? ""}`);
      gates.push({
        gate: "language",
        hard: true,
        present: false,
        pass: !foreignTitle,
        reason: foreignTitle ? "no Language aspect; title/set suggests non-English market" : "no Language aspect; title presumed English",
      });
    }
  }

  // --- 2. Set (CORROBORATING: absence ok, present-mismatch is a hard reject).
  {
    if (setVal) {
      const m = setMatches(target.setName, setVal);
      gates.push({ gate: "set", hard: true, present: true, pass: m.match, reason: m.reason });
    } else {
      gates.push({ gate: "set", hard: false, present: false, pass: true, reason: "no Set aspect (corroboration unavailable)" });
    }
  }

  // --- 3. Number (CORROBORATING: absence ok, present-mismatch is a hard reject).
  {
    if (numberVal) {
      const m = numberMatches(target.number, numberVal);
      gates.push({ gate: "number", hard: true, present: true, pass: m.match, reason: m.reason });
    } else {
      gates.push({ gate: "number", hard: false, present: false, pass: true, reason: "no Card Number aspect (corroboration unavailable)" });
    }
  }

  // --- 4. Finish (HARD only when a specific variant was requested).
  {
    const want = finishForVariantKey(target.requestedVariant);
    if (!target.requestedVariant || !want) {
      gates.push({ gate: "finish", hard: false, present: !!finishVal, pass: true, reason: "no variant requested → finish unconstrained" });
    } else if (!finishVal) {
      gates.push({ gate: "finish", hard: false, present: false, pass: true, reason: "no Finish aspect (corroboration unavailable)" });
    } else {
      const got = normalizeFinish(finishVal);
      const pass = got == null || got === want;
      gates.push({ gate: "finish", hard: true, present: true, pass, reason: pass ? `finish ${got ?? "?"} ~ ${want}` : `finish mismatch: ${got} vs ${want}` });
    }
  }

  // --- 5. Graded-vs-raw + condition (HARD).
  let listingCondition: ListingConditionTier = "UNKNOWN";
  {
    if (conditionIsRaw(condition)) {
      if (graded) {
        gates.push({ gate: "graded_condition", hard: true, present: true, pass: false, reason: "raw condition requested but listing is graded" });
      } else {
        // Raw listing. Infer its tier (aspect-first via inferListingCondition).
        const inf = inferListingCondition({ title, aspects });
        listingCondition = inf.tier;
        if (condition === "ANY_RAW") {
          gates.push({ gate: "graded_condition", hard: true, present: true, pass: true, reason: `raw (any) — inferred ${inf.tier}` });
        } else {
          const pass = inf.tier === condition;
          gates.push({ gate: "graded_condition", hard: true, present: inf.tier !== "UNKNOWN", pass, reason: pass ? `raw tier ${inf.tier} == ${condition}` : `raw tier ${inf.tier} != requested ${condition}` });
        }
      }
    } else if (condition === "ANY_GRADED") {
      // Any slab qualifies — the listing must BE graded (same detectGraded
      // signal stack as the specific-grade path; identity gates unchanged).
      if (!graded) {
        gates.push({ gate: "graded_condition", hard: true, present: true, pass: false, reason: "graded condition requested but listing is not graded" });
      } else {
        listingCondition = "GRADED";
        gates.push({ gate: "graded_condition", hard: true, present: true, pass: true, reason: "graded (any service/grade)" });
      }
    } else {
      // Graded condition requested.
      const want = condition.graded;
      if (!graded) {
        gates.push({ gate: "graded_condition", hard: true, present: true, pass: false, reason: "graded condition requested but listing is not graded" });
      } else {
        listingCondition = "GRADED";
        const gotKey = gradedGradeKey(aspects); // resolver-local (reads Grading Company)
        const wantKey = `${want.service}_${want.grade.replace(".", "_")}`.toUpperCase();
        const pass = (gotKey ?? "").toUpperCase() === wantKey;
        gates.push({ gate: "graded_condition", hard: true, present: !!gotKey, pass, reason: pass ? `graded ${wantKey}` : `graded ${gotKey ?? "?"} != requested ${wantKey}` });
      }
    }
  }

  // A gate fails the verdict when it does NOT pass AND it is hard (corroborating
  // gates are marked hard=true only when the aspect was present-and-mismatched).
  const failing = gates.find((g) => !g.pass && g.hard);
  return {
    pass: !failing,
    gates,
    reason: failing ? `${failing.gate}: ${failing.reason}` : "all gates passed",
    condition: listingCondition,
    verifiedAspects: { set: setVal, number: numberVal, finish: finishVal, language, graded },
  };
}
