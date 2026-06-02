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
import { getBestListing } from "../affiliate/ebay-browse.ts";
import { inferListingCondition } from "../buy-signal/condition-infer.ts";
import { resolveConditionMatchedReference } from "../buy-signal/reference.ts";
import { classifyConditionMatched } from "../buy-signal/compute.ts";

const HAVE_POKETRACE = !!process.env.POKETRACE_API_KEY;
const HAVE_EBAY = !!(process.env.EBAY_DEVELOPER_APP_ID && process.env.EBAY_DEVELOPER_CERT_ID);
const LIVE = HAVE_POKETRACE && HAVE_EBAY;

const FLAGSHIPS = [
  { id: "base1-4", label: "Charizard Base" },
  { id: "base1-15", label: "Venusaur Base" },
  { id: "base1-10", label: "Mewtwo Base" },
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

    const inferred = inferListingCondition({ title: best.title });
    const matched = await resolveConditionMatchedReference(meta.variants, undefined, inferred.tier);
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
    // THE I-009 REGRESSION GUARD: a large BELOW is the junk-comparison signature.
    // A legitimate BELOW (condition-matched, above the outlier floor) is fine;
    // a < -50% BELOW means we compared across conditions again.
    assert.ok(
      !(sig.tier === "BELOW" && (sig.deltaPercent ?? 0) < -50),
      `${card.label} flashed a large false BELOW (${sig.deltaPercent}%) — I-009 regression`,
    );
  });
}
