// Unit tests for recoverPartialIdentification. Mocks the three external
// dependencies (PokeTrace search, PriceCharting search, confirmMatch) so the
// test pins the *routing* logic — when to short-circuit vs. when to defer
// to visual confirm vs. when to give up.

import test from "node:test";
import assert from "node:assert/strict";
import { recoverPartialIdentification, needsRecovery } from "../identify-recovery.ts";
import type { CandidateSummary } from "../poketrace.ts";
import type { PriceChartingCandidate } from "../pricecharting.ts";
import type { ConfirmResult } from "../vision-confirm.ts";

function ptCandidate(n: string, name = "Mega Lucario ex"): CandidateSummary {
  return {
    id: `pt-${n}`,
    name,
    set: "Mega Evolution",
    setSlug: "mega-evolution",
    cardNumber: `${n}/094`,
    variant: "Holofoil",
    image: `https://example.com/${n}.jpg`,
    score: 80,
  };
}

function pcCandidate(n: string, name = "Mega Lucario ex"): PriceChartingCandidate {
  return {
    id: `pc-${n}`,
    productName: `${name} #${n}`,
    consoleName: "Pokemon Mega Evolution",
    cardNumber: n,
  };
}

test("needsRecovery: identified + name + setCode + null collectorNumber → true", () => {
  assert.strictEqual(
    needsRecovery({ status: "identified", name: "Mega Lucario ex", setCode: "MEG", collectorNumber: null }),
    true,
  );
});

test("needsRecovery: skips if collectorNumber is present", () => {
  assert.strictEqual(
    needsRecovery({ status: "identified", name: "Charizard", setCode: "MEG", collectorNumber: "4" }),
    false,
  );
});

test("needsRecovery: skips insufficient_information", () => {
  assert.strictEqual(
    needsRecovery({ status: "insufficient_information", name: "Charizard", setCode: "MEG", collectorNumber: null }),
    false,
  );
});

test("needsRecovery: skips when name or setCode missing", () => {
  assert.strictEqual(
    needsRecovery({ status: "identified", name: null, setCode: "MEG", collectorNumber: null }),
    false,
  );
  assert.strictEqual(
    needsRecovery({ status: "identified", name: "Charizard", setCode: null, collectorNumber: null }),
    false,
  );
});

test("recovery: 1 unique candidate (PokeTrace) → resolved via single_candidate, no visual confirm", async () => {
  let confirmCalls = 0;
  const result = await recoverPartialIdentification(
    { name: "Mega Lucario ex", setCode: "MEG", cropDataUrl: "data:image/jpeg;base64,xxx" },
    {
      searchPokeTrace: async () => [ptCandidate("024")],
      searchPriceCharting: async () => [],
      confirmMatch: async () => {
        confirmCalls++;
        return { chosenIndex: 0, confidence: "high", reasoning: "" } as ConfirmResult;
      },
    },
  );
  assert.deepStrictEqual(result, {
    resolved: true,
    collectorNumber: "024/094",
    via: "single_candidate",
  });
  assert.strictEqual(confirmCalls, 0, "single-candidate path must not call confirmMatch");
});

test("recovery: 1 unique candidate (PriceCharting only) → resolved via single_candidate", async () => {
  // PC-only hit (e.g. PokeTrace had this card but with different cardNumber
  // formatting that didn't normalize). Should still resolve.
  const result = await recoverPartialIdentification(
    { name: "Mega Lucario ex", setCode: "MEG", cropDataUrl: "data:image/jpeg;base64,xxx" },
    {
      searchPokeTrace: async () => [],
      searchPriceCharting: async () => [pcCandidate("24")],
      confirmMatch: async () => {
        throw new Error("must not be called");
      },
    },
  );
  assert.strictEqual(result.resolved, true);
  if (result.resolved) {
    assert.strictEqual(result.collectorNumber, "24");
    assert.strictEqual(result.via, "single_candidate");
  }
});

test("recovery: cross-source dedup — same normalized number from PokeTrace + PriceCharting counts as 1 unique", async () => {
  // PokeTrace reports "024/094", PriceCharting reports "24". After numeric
  // normalization both reduce to "24" → exactly 1 unique candidate.
  const result = await recoverPartialIdentification(
    { name: "Mega Lucario ex", setCode: "MEG", cropDataUrl: "data:image/jpeg;base64,xxx" },
    {
      searchPokeTrace: async () => [ptCandidate("024")],
      searchPriceCharting: async () => [pcCandidate("24")],
      confirmMatch: async () => {
        throw new Error("must not be called");
      },
    },
  );
  assert.strictEqual(result.resolved, true, "PC + PT pointing at the same number must collapse to 1");
});

test("recovery: 3 candidates, visual confirm picks one with HIGH → resolved via visual_confirm", async () => {
  let confirmCalls = 0;
  let lastCandidateCount = 0;
  const result = await recoverPartialIdentification(
    { name: "Mega Gardevoir ex", setCode: "MEG", cropDataUrl: "data:image/jpeg;base64,xxx" },
    {
      searchPokeTrace: async () => [ptCandidate("037"), ptCandidate("085"), ptCandidate("092")],
      searchPriceCharting: async () => [],
      confirmMatch: async (_url, candidates) => {
        confirmCalls++;
        lastCandidateCount = candidates.length;
        return { chosenIndex: 1, confidence: "high", reasoning: "" } as ConfirmResult;
      },
    },
  );
  assert.strictEqual(confirmCalls, 1, "multi-candidate path must call confirmMatch once");
  assert.strictEqual(lastCandidateCount, 3, "all 3 unique candidates must be sent to confirmMatch");
  assert.strictEqual(result.resolved, true);
  if (result.resolved) {
    assert.strictEqual(result.collectorNumber, "085/094");
    assert.strictEqual(result.via, "visual_confirm");
  }
});

test("recovery: 5 candidates, visual confirm returns MEDIUM → stays unresolved", async () => {
  const result = await recoverPartialIdentification(
    { name: "Mega Lopunny ex", setCode: "MEG", cropDataUrl: "data:image/jpeg;base64,xxx" },
    {
      searchPokeTrace: async () => [
        ptCandidate("001"),
        ptCandidate("020"),
        ptCandidate("030"),
        ptCandidate("040"),
        ptCandidate("050"),
      ],
      searchPriceCharting: async () => [],
      confirmMatch: async () =>
        ({ chosenIndex: 0, confidence: "medium", reasoning: "" }) as ConfirmResult,
    },
  );
  assert.deepStrictEqual(result, { resolved: false, reason: "multiple_unconfirmed" });
});

test("recovery: 5 candidates, visual confirm returns chosenIndex=null → stays unresolved", async () => {
  const result = await recoverPartialIdentification(
    { name: "Charizard", setCode: "MEG", cropDataUrl: "data:image/jpeg;base64,xxx" },
    {
      searchPokeTrace: async () => [ptCandidate("100"), ptCandidate("101"), ptCandidate("102"), ptCandidate("103"), ptCandidate("104")],
      searchPriceCharting: async () => [],
      confirmMatch: async () =>
        ({ chosenIndex: null, confidence: "high", reasoning: "no match in references" }) as ConfirmResult,
    },
  );
  assert.deepStrictEqual(result, { resolved: false, reason: "multiple_unconfirmed" });
});

test("recovery: 0 candidates across both sources → unresolved with no_candidates", async () => {
  const result = await recoverPartialIdentification(
    { name: "Imaginary Card", setCode: "XYZ", cropDataUrl: "data:image/jpeg;base64,xxx" },
    {
      searchPokeTrace: async () => [],
      searchPriceCharting: async () => [],
      confirmMatch: async () => {
        throw new Error("must not be called");
      },
    },
  );
  assert.deepStrictEqual(result, { resolved: false, reason: "no_candidates" });
});

test("recovery: lookup throwing returns lookup_error (degrades gracefully)", async () => {
  const result = await recoverPartialIdentification(
    { name: "Mega Lucario ex", setCode: "MEG", cropDataUrl: "data:image/jpeg;base64,xxx" },
    {
      searchPokeTrace: async () => {
        throw new Error("PokeTrace 503");
      },
      searchPriceCharting: async () => [],
      confirmMatch: async () => {
        throw new Error("must not be called");
      },
    },
  );
  assert.deepStrictEqual(result, { resolved: false, reason: "lookup_error" });
});

test("recovery: multiple candidates but none have PokeTrace images → unresolved (no images for confirmMatch)", async () => {
  // Edge case: PriceCharting-only candidates have no images, so confirmMatch
  // can't disambiguate. Should bail instead of running confirmMatch on an
  // empty candidate list.
  const result = await recoverPartialIdentification(
    { name: "Mega Sharpedo ex", setCode: "MEG", cropDataUrl: "data:image/jpeg;base64,xxx" },
    {
      searchPokeTrace: async () => [],
      searchPriceCharting: async () => [pcCandidate("020"), pcCandidate("021"), pcCandidate("022")],
      confirmMatch: async () => {
        throw new Error("must not be called when no images are available");
      },
    },
  );
  assert.deepStrictEqual(result, { resolved: false, reason: "multiple_unconfirmed" });
});
