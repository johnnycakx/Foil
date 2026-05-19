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
    raw: {
      ebayNearMintAvg: 14.99,
      tcgplayerNearMintAvg: 12.0,
      cardmarketNearMintAvg: 10.0,
    },
    bestGraded: null,
    topPrice: { amount: 14.99, source: "ebay", sourceLabel: "eBay sold (NM)" },
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
    !("topPrice" in out),
    "demoted pricing must not carry a topPrice (no fake price shown to user)",
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
  }
  assert.strictEqual(result.cards[0].status, "identified");
  assert.strictEqual(result.visuallyConfirmed[0], true);
});

test("low-confidence match is demoted on medium confidence too", async () => {
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
  assert.strictEqual(out.matched, false, "medium confidence should NOT pass the gate for lowConfidence cards");
  if (!out.matched) {
    assert.strictEqual(out.failure.code, "low_confidence_unconfirmed");
  }
  assert.strictEqual(result.cards[0].status, "insufficient_information");
});
