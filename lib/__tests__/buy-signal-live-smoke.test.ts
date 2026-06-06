// Buy-signal LIVE smoke (ROADMAP #32.1 / ADR-053 / PATTERN I-009).
//
// This is the codification of PATTERN I-009: code-passing gates do not catch
// signal-SEMANTICS bugs, and a smoke test that uses reference-derived synthetic
// asks (ask = ref × 0.8) structurally cannot catch a condition mismatch. The
// only thing that can is running the FULL pipeline against the REAL live ask.
//
// It pulls the live eBay best listing (the ask) + the live PokeTrace sold
// history (the reference) for the three flagship cards that flashed the false
// BELOW, runs infer -> condition-matched reference -> classify, and asserts the
// result is sensible: a real tier OR UNKNOWN with a documented reason, and NEVER
// the large-false-BELOW signature (< -50% BELOW) that the I-009 bug produced.
//
// Network + creds gated: skips when POKETRACE_API_KEY / eBay creds are absent
// (so credentialless CI is green). The closure gate runs it WITH creds via
//   node --env-file=.env.local --test lib/__tests__/buy-signal-live-smoke.test.ts
// and it then fails loudly on any flagship regression.

import test from "node:test";
import assert from "node:assert/strict";
import { getCardMetadata } from "../cards/sdk.ts";
import { getBestListing, getListingAspects } from "../affiliate/ebay-browse.ts";
import { inferListingCondition } from "../buy-signal/condition-infer.ts";
import { resolveConditionMatchedReference } from "../buy-signal/reference.ts";
import { classifyConditionMatched } from "../buy-signal/compute.ts";

const HAVE_POKETRACE = !!process.env.POKETRACE_API_KEY;
const HAVE_EBAY = !!(process.env.EBAY_DEVELOPER_APP_ID && process.env.EBAY_DEVELOPER_CERT_ID);
const LIVE = HAVE_POKETRACE && HAVE_EBAY;

// ROADMAP #32.3 / I-009 update: the #32.1 smoke covered only 3 UNKNOWN
// flagships, so the graded + abbreviation paths slipped through ungated. The
// corpus now ALSO includes cards that actually rendered a badge in the
// production hit-rate scan (mixed BELOW / AT / ABOVE / graded) — the exact set
// that exposed the false deltas. Listings rotate, so any card may resolve to
// UNKNOWN on a given run; the invariant being guarded is "never a large false
// delta", which must hold regardless of which listing is live.
const FLAGSHIPS = [
  // Original 3 (no-condition vintage → UNKNOWN path).
  { id: "base1-4", label: "Charizard Base" },
  { id: "base1-15", label: "Venusaur Base" },
  { id: "base1-10", label: "Mewtwo Base" },
  // Cards that rendered a badge in the #32.3 scan (the regression corpus).
  { id: "neo2-1", label: "Espeon Neo (graded-heavy)" },
  { id: "neo2-13", label: "Umbreon Neo ('NM 7' case)" },
  { id: "sm115-31", label: "Mewtwo-GX Hidden Fates (+212% case)" },
  { id: "base6-8", label: "Dark Slowbro (+134% case)" },
  { id: "swsh4-188", label: "Pikachu VMAX Rainbow (-86% case)" },
];

for (const card of FLAGSHIPS) {
  test(`live-smoke: ${card.label} returns a sensible signal, never a large false BELOW (I-009)`, async (t) => {
    if (!LIVE) {
      t.skip(`live creds absent (POKETRACE=${HAVE_POKETRACE}, EBAY=${HAVE_EBAY}) — run with --env-file=.env.local`);
      return;
    }

    const meta = await getCardMetadata({ id: card.id });
    const best = await getBestListing({
      cardName: meta.name,
      setName: meta.setName,
      customId: "foil-live-smoke",
      surface: "page_render",
    });
    if (!best) {
      t.skip(`no live eBay listing for ${card.label} right now (quota/availability)`);
      return;
    }

    // ADR-057: exercise the live aspect-gated path (Card Condition + Language)
    // — the same getItem read production uses, not title-only.
    const listingAspects = best.itemId ? await getListingAspects({ itemId: best.itemId, surface: "page_render" }) : null;
    const inferred = inferListingCondition({ title: best.title, aspects: listingAspects });
    const matched = await resolveConditionMatchedReference(meta.variants, undefined, inferred.tier, inferred.gradeKey);
    const sig = classifyConditionMatched({
      askPrice: best.price,
      listingTier: inferred.tier,
      conditionReference: matched.conditionReference,
      conditionSampleSize: matched.conditionSampleSize,
      lowestRawReference: matched.lowestRawReference,
    });

    console.log(
      `[live-smoke] ${card.label}: ask $${best.price} (${inferred.tier}/${inferred.confidence}) ` +
      `vs ${matched.matchedTier ?? "—"} ref ${matched.conditionReference ?? "—"} ` +
      `-> ${sig.tier}${sig.deltaPercent != null ? ` (${sig.deltaPercent}%)` : ""}` +
      `${sig.reason ? ` [${sig.reason}]` : ""} | title: "${best.title}"`,
    );

    // Valid enum.
    assert.ok(["BELOW", "AT", "ABOVE", "UNKNOWN"].includes(sig.tier), `valid tier, got ${sig.tier}`);
    // UNKNOWN must always carry a documented reason (honesty + debuggability).
    if (sig.tier === "UNKNOWN") {
      assert.ok(typeof sig.reason === "string" && sig.reason.length > 0, "UNKNOWN must document a reason");
    }
    // THE I-009 REGRESSION GUARD (#32.3). The symmetric outlier guard bounds
    // every rendered badge to [0.5x, 2x] of its matched condition's sold avg,
    // i.e. a deltaPercent in [-50, +100]. Anything outside means we either
    // mismatched conditions/grades again or the guard regressed. UNKNOWN is
    // always allowed (the honest output when we can't vouch for a comparison).
    if (sig.tier !== "UNKNOWN") {
      const d = sig.deltaPercent ?? 0;
      assert.ok(
        d >= -50 && d <= 100,
        `${card.label} rendered an out-of-band delta (${sig.tier} ${d}%) — outlier guard regression (I-009)`,
      );
    }
  });
}
