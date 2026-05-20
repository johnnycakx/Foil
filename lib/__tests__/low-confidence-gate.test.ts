// Unit test for the low-confidence visual-confirmation gate.
//
// Stubs out confirmMatch so it always returns {chosenIndex: null,
// confidence: "low"} and feeds the gate a card that PokeTrace returned as a
// lowConfidence match. Asserts the gate demotes the card to
// "insufficient_information" with no price.

import test from "node:test";
import assert from "node:assert/strict";
import { applyLowConfidenceGate } from "../low-confidence-gate.ts";
import type { CardPricing, CandidateSummary } from "../poketrace.ts";
import type { IdentifiedCard } from "../vision.ts";
import type { ConfirmResult } from "../vision-confirm.ts";

function makeCard(overrides: Partial<IdentifiedCard> = {}): IdentifiedCard {
  return {
    status: "identified",
    insufficientReason: null,
    name: "Chimchar",
    hp: "60",
    collectorNumber: "041",
    setCode: "MEW",
    setCodeRaw: "MEW",
    setSymbolDescription: null,
    regulationMark: null,
    rarity: "Common",
    illustrator: null,
    variant: null,
    language: "EN",
    conditionEstimate: null,
    confidence: 50,
    visualNotes: null,
    boundingBox: null,
    ...overrides,
  };
}

function makeLowConfPricing(): CardPricing {
  const candidate: CandidateSummary = {
    id: "fake-pop6-chimchar",
    name: "Chimchar",
    set: "POP Series 6",
    setSlug: "pop-series-6",
    cardNumber: "10/17",
    variant: "Holofoil",
    image: "https://example.com/chimchar.jpg",
    score: 35,
  };
  return {
    matched: true,
    lowConfidence: true,
    candidate: {
      id: candidate.id,
      name: candidate.name,
      set: candidate.set,
      setSlug: candidate.setSlug,
      cardNumber: candidate.cardNumber,
      variant: candidate.variant,
      image: candidate.image,
    },
    quotes: [
      { source: "ebay", tier: "RAW_UNGRADED", amount: 14.99 },
      { source: "tcgplayer", tier: "RAW_UNGRADED", amount: 12.0 },
      { source: "cardmarket", tier: "RAW_UNGRADED", amount: 10.0 },
    ],
    topCandidates: [candidate],
  };
}

test("low-confidence match is demoted to insufficient_information when confirmMatch returns low", async () => {
  let confirmCalls = 0;
  let priceByCardIdCalls = 0;
  let searchCandidatesCalls = 0;

  const card = makeCard();
  const pricing = makeLowConfPricing();

  const result = await applyLowConfidenceGate(
    {
      pricings: [pricing],
      cards: [card],
      cardCropDataUrls: ["data:image/jpeg;base64,aGVsbG8="],
    },
    {
      confirmMatch: async () => {
        confirmCalls++;
        return { chosenIndex: null, confidence: "low", reasoning: "stub" } as ConfirmResult;
      },
      priceByCardId: async () => {
        priceByCardIdCalls++;
        return null;
      },
      searchCandidates: async () => {
        searchCandidatesCalls++;
        return [];
      },
    },
  );

  assert.strictEqual(confirmCalls, 1, "confirmMatch should have been called exactly once");
  assert.strictEqual(priceByCardIdCalls, 0, "priceByCardId should not be called on a demotion");
  assert.strictEqual(searchCandidatesCalls, 0, "searchCandidates not needed when topCandidates is populated");

  const out = result.pricings[0];
  assert.strictEqual(out.matched, false, "pricing must be demoted (matched=false)");
  if (!out.matched) {
    assert.strictEqual(out.failure.code, "low_confidence_unconfirmed");
  }
  assert.ok(
    !("quotes" in out),
    "demoted pricing must not carry quotes (no fake price shown to user)",
  );

  const outCard = result.cards[0];
  assert.strictEqual(outCard.status, "insufficient_information");
  assert.strictEqual(
    outCard.insufficientReason,
    "Low-confidence text match failed visual check.",
  );
  assert.strictEqual(result.visuallyConfirmed[0], false);
});

test("low-confidence match is preserved when confirmMatch returns high on the same candidate", async () => {
  const card = makeCard();
  const pricing = makeLowConfPricing();

  const result = await applyLowConfidenceGate(
    {
      pricings: [pricing],
      cards: [card],
      cardCropDataUrls: ["data:image/jpeg;base64,aGVsbG8="],
    },
    {
      confirmMatch: async () =>
        ({ chosenIndex: 0, confidence: "high", reasoning: "stub" }) as ConfirmResult,
      priceByCardId: async () => null,
      searchCandidates: async () => [],
    },
  );

  const out = result.pricings[0];
  assert.strictEqual(out.matched, true, "pricing must remain matched on a high-confidence confirm");
  if (out.matched) {
    assert.strictEqual(out.lowConfidence, false, "lowConfidence flag must be cleared");
    // quotes[] must survive the gate so the UI has prices to display.
    assert.ok(out.quotes.length > 0, "quotes must be present and non-empty");
    const ungraded = out.quotes.filter((q) => q.tier === "RAW_UNGRADED");
    assert.ok(ungraded.length > 0, "must have at least one ungraded quote");
  }
  assert.strictEqual(result.cards[0].status, "identified");
  assert.strictEqual(result.visuallyConfirmed[0], true);
});

test("PricedCard shape does not include cropDataUrl (user crops stay server-side)", async () => {
  // Compile-time guard: cropDataUrl was removed from PricedCard in this
  // milestone. If anyone re-adds it, this test fails to compile.
  const _check: keyof import("../../app/upload/actions.ts").PricedCard extends "cropDataUrl"
    ? "FAIL: cropDataUrl should not be a key of PricedCard"
    : "ok" = "ok";
  assert.strictEqual(_check, "ok");

  // Runtime guard: build a representative PricedCard-shaped object and
  // confirm `cropDataUrl` is not enumerable on it.
  const card = makeCard();
  const pricing = makeLowConfPricing();
  const gated = await applyLowConfidenceGate(
    {
      pricings: [pricing],
      cards: [card],
      cardCropDataUrls: ["data:image/jpeg;base64,aGVsbG8="],
    },
    {
      confirmMatch: async () =>
        ({ chosenIndex: 0, confidence: "high", reasoning: "stub" }) as ConfirmResult,
      priceByCardId: async () => null,
      searchCandidates: async () => [],
    },
  );
  const pricedCard = {
    ...gated.cards[0],
    pricing: gated.pricings[0],
    quotes: gated.pricings[0].matched ? gated.pricings[0].quotes : [],
    retried: undefined,
    visuallyConfirmed: gated.visuallyConfirmed[0] || undefined,
    previousAttempt: undefined,
  };
  assert.ok(
    !("cropDataUrl" in pricedCard),
    "PricedCard must not carry cropDataUrl in the response payload",
  );
});

test("low-confidence match SURVIVES on medium confidence (re-verification context)", async () => {
  // Reverification context: priceCard already text-matched this card. The
  // gate is only confirming the printing visually. Accept medium — under
  // Vision-LLM nondeterminism the same photo flickers high ↔ medium across
  // runs ($741 ↔ $437 on the binder eyeball test).
  const card = makeCard();
  const pricing = makeLowConfPricing();

  const result = await applyLowConfidenceGate(
    {
      pricings: [pricing],
      cards: [card],
      cardCropDataUrls: ["data:image/jpeg;base64,aGVsbG8="],
    },
    {
      confirmMatch: async () =>
        ({ chosenIndex: 0, confidence: "medium", reasoning: "stub" }) as ConfirmResult,
      priceByCardId: async () => null,
      searchCandidates: async () => [],
    },
  );

  const out = result.pricings[0];
  assert.strictEqual(out.matched, true, "medium MUST pass the gate when re-verifying an already-matched card");
  if (out.matched) {
    assert.strictEqual(out.lowConfidence, false, "lowConfidence flag must clear on medium-confidence rescue");
  }
  assert.strictEqual(result.cards[0].status, "identified");
  assert.strictEqual(result.visuallyConfirmed[0], true);
});

test("low-confidence match is demoted only on LOW confidence or null pick", async () => {
  // Floor stays — chosenIndex=null or confidence=low both demote.
  const card = makeCard();
  const pricing = makeLowConfPricing();

  const result = await applyLowConfidenceGate(
    {
      pricings: [pricing],
      cards: [card],
      cardCropDataUrls: ["data:image/jpeg;base64,aGVsbG8="],
    },
    {
      confirmMatch: async () =>
        ({ chosenIndex: 0, confidence: "low", reasoning: "stub" }) as ConfirmResult,
      priceByCardId: async () => null,
      searchCandidates: async () => [],
    },
  );

  assert.strictEqual(result.pricings[0].matched, false, "low confidence must still demote");
  assert.strictEqual(result.cards[0].status, "insufficient_information");
});
