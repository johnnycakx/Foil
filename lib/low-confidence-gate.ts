// Visual-confirmation gate for low-confidence text matches.
//
// A "lowConfidence" CardPricing means PokeTrace matched on name alone (no set
// code, no collector number). That tier is fuzzy enough to land on the wrong
// printing — e.g. a Chimchar misread with collector number "MEW #041" fuzzied
// to POP Series 6, which is the wrong card. To stop those fake matches from
// showing prices to the user, we re-run the visual confirmation pass: ask the
// model to compare the user's crop against the top PokeTrace candidates, and
// demote the card to "needs review" unless the model says high confidence.

import type { CardPricing, CandidateSummary, ClaudeCardLite } from "./poketrace.ts";
import type { IdentifiedCard } from "./vision.ts";
import type { ConfirmCandidate, ConfirmResult } from "./vision-confirm.ts";

const REASON = "Low-confidence text match failed visual check.";

export type GateDeps = {
  confirmMatch: (
    userCropDataUrl: string,
    candidates: ConfirmCandidate[],
  ) => Promise<ConfirmResult>;
  priceByCardId: (candidate: CandidateSummary) => Promise<CardPricing | null>;
  searchCandidates: (claude: ClaudeCardLite, limit?: number) => Promise<CandidateSummary[]>;
};

export type GateInput = {
  pricings: CardPricing[];
  cards: IdentifiedCard[];
  cardCropDataUrls: string[];
};

export type GateOutput = {
  pricings: CardPricing[];
  cards: IdentifiedCard[];
  visuallyConfirmed: boolean[];
};

function demote(pricings: CardPricing[], cards: IdentifiedCard[], i: number): void {
  pricings[i] = {
    matched: false,
    reason: REASON,
    failure: {
      code: "low_confidence_unconfirmed",
      message: REASON,
      topCandidates: [],
    },
  };
  cards[i] = {
    ...cards[i],
    status: "insufficient_information",
    insufficientReason: REASON,
  };
}

export async function applyLowConfidenceGate(
  input: GateInput,
  deps: GateDeps,
): Promise<GateOutput> {
  const pricings = input.pricings.slice();
  const cards = input.cards.slice();
  const visuallyConfirmed = new Array<boolean>(pricings.length).fill(false);

  const indices = pricings
    .map((p, i) => (p.matched && p.lowConfidence ? i : -1))
    .filter((i) => i >= 0);

  await Promise.all(
    indices.map(async (i) => {
      const p = pricings[i];
      if (!p.matched) return;

      let candidates: CandidateSummary[] = (p.topCandidates ?? []).filter((c) => c.image);
      if (candidates.length === 0) {
        const fresh = await deps.searchCandidates({
          name: p.candidate.name,
          setCode: cards[i].setCode,
          collectorNumber: cards[i].collectorNumber,
          rarity: cards[i].rarity,
          regulationMark: cards[i].regulationMark,
        });
        candidates = fresh.filter((c) => c.image);
      }
      candidates = candidates.slice(0, 3);

      if (candidates.length === 0) {
        demote(pricings, cards, i);
        return;
      }

      let result: ConfirmResult;
      try {
        result = await deps.confirmMatch(
          input.cardCropDataUrls[i],
          candidates.map((c) => ({
            image: c.image as string,
            name: c.name,
            set: c.set,
            collectorNumber: c.cardNumber,
          })),
        );
      } catch (err) {
        console.error(
          `[low-confidence-gate] confirmMatch threw for card ${i}: ${err instanceof Error ? err.message : err}`,
        );
        demote(pricings, cards, i);
        return;
      }

      if (result.chosenIndex !== null && result.confidence === "high") {
        const picked = candidates[result.chosenIndex];
        if (picked.id === p.candidate.id) {
          pricings[i] = { ...p, lowConfidence: false };
        } else {
          const repriced = await deps.priceByCardId(picked);
          if (repriced && repriced.matched) {
            pricings[i] = { ...repriced, lowConfidence: false };
          } else {
            pricings[i] = { ...p, lowConfidence: false };
          }
        }
        visuallyConfirmed[i] = true;
        console.log(
          `[low-confidence-gate] card=${i} confirmed picked="${picked.name}" #${picked.cardNumber}`,
        );
      } else {
        demote(pricings, cards, i);
        console.log(
          `[low-confidence-gate] card=${i} demoted (chosenIndex=${result.chosenIndex}, confidence=${result.confidence})`,
        );
      }
    }),
  );

  return { pricings, cards, visuallyConfirmed };
}
