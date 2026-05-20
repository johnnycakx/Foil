// Partial-identification recovery. Vision sometimes reads NAME + SET CODE
// for a card but misses the collector number (typical on Mega ex cards where
// the bottom edge is partly cropped or holo-warped). The framework rule is
// "null over guess", so Vision correctly returns collectorNumber=null — but
// PokeTrace's lookup ladder treats that as low-confidence and the card ends
// up in review with no price.
//
// Recovery: search both pricing sources by name + setCode. If exactly one
// candidate surfaces across the merged result, we've effectively recovered
// the collector number from upstream — no guessing required, just a database
// lookup that Vision couldn't do.
//
// When multiple candidates surface, defer to confirmMatch (visual) — the same
// gate used elsewhere in the pipeline. Anything less than high-confidence
// stays in review.

import type { CandidateSummary, ClaudeCardLite } from "./poketrace.ts";
import type { PriceChartingCandidate } from "./pricecharting.ts";
import type { ConfirmCandidate, ConfirmResult } from "./vision-confirm.ts";

// PokeTrace's set-code → PriceCharting console-name map. Recovery only needs
// to seed the PC search query; the actual console-name on the returned
// product is what counts for ranking.
const SET_CODE_TO_PC_SET_NAME: Record<string, string> = {
  SVI: "Scarlet & Violet",
  PAL: "Paldea Evolved",
  OBF: "Obsidian Flames",
  MEW: "151",
  PAR: "Paradox Rift",
  PAF: "Paldean Fates",
  TEF: "Temporal Forces",
  TWM: "Twilight Masquerade",
  SFA: "Shrouded Fable",
  SCR: "Stellar Crown",
  SSP: "Surging Sparks",
  PRE: "Prismatic Evolutions",
  JTG: "Journey Together",
  DRI: "Destined Rivals",
  BLK: "Black Bolt",
  WHT: "White Flare",
  MEG: "Mega Evolution",
  CRZ: "Crown Zenith",
};

export type RecoveryDeps = {
  searchPokeTrace: (claude: ClaudeCardLite, limit: number) => Promise<CandidateSummary[]>;
  searchPriceCharting: (input: { name: string; setName: string }, limit: number) => Promise<PriceChartingCandidate[]>;
  confirmMatch: (cropUrl: string, candidates: ConfirmCandidate[]) => Promise<ConfirmResult>;
};

export type RecoveryInput = {
  name: string;
  setCode: string;
  cropDataUrl: string;
};

export type RecoveryOutcome =
  | { resolved: true; collectorNumber: string; via: "single_candidate" | "visual_confirm" }
  | { resolved: false; reason: "no_candidates" | "multiple_unconfirmed" | "lookup_error" };

/**
 * Extract the bare numeric prefix from a collector number. "4/102" → "4",
 * "024/093" → "24", "#58" → "58". Used to dedupe across sources.
 */
function normalizeNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d+)/);
  if (!m) return null;
  return String(parseInt(m[1], 10));
}

type MergedCandidate = {
  normalizedNumber: string;
  displayNumber: string;
  poketraceCandidate?: CandidateSummary;
  pricechartingCandidate?: PriceChartingCandidate;
};

export async function recoverPartialIdentification(
  input: RecoveryInput,
  deps: RecoveryDeps,
): Promise<RecoveryOutcome> {
  const setCodeUpper = input.setCode.toUpperCase();
  const pcSetName = SET_CODE_TO_PC_SET_NAME[setCodeUpper] ?? input.setCode;

  let poketrace: CandidateSummary[] = [];
  let pricecharting: PriceChartingCandidate[] = [];
  try {
    [poketrace, pricecharting] = await Promise.all([
      deps.searchPokeTrace(
        { name: input.name, setCode: setCodeUpper, collectorNumber: null, rarity: null },
        5,
      ),
      deps.searchPriceCharting({ name: input.name, setName: pcSetName }, 5),
    ]);
  } catch {
    return { resolved: false, reason: "lookup_error" };
  }

  // Merge by normalized numeric. PokeTrace's cardNumber is "4/102", PC's is
  // a "#4" embedded in product-name. Both reduce to "4" here.
  const merged = new Map<string, MergedCandidate>();
  for (const c of poketrace) {
    const n = normalizeNumber(c.cardNumber);
    if (!n) continue;
    merged.set(n, { normalizedNumber: n, displayNumber: c.cardNumber, poketraceCandidate: c });
  }
  for (const c of pricecharting) {
    const n = normalizeNumber(c.cardNumber);
    if (!n) continue;
    const existing = merged.get(n);
    if (existing) {
      existing.pricechartingCandidate = c;
    } else {
      merged.set(n, {
        normalizedNumber: n,
        displayNumber: c.cardNumber ?? n,
        pricechartingCandidate: c,
      });
    }
  }

  const unique = Array.from(merged.values());

  if (unique.length === 0) {
    return { resolved: false, reason: "no_candidates" };
  }

  if (unique.length === 1) {
    return {
      resolved: true,
      collectorNumber: unique[0].displayNumber,
      via: "single_candidate",
    };
  }

  // Multiple candidates → defer to visual confirm. PokeTrace candidates have
  // image URLs we can pass straight through; PC-only candidates lack images
  // here and get skipped.
  const confirmCandidates: { idx: number; cand: ConfirmCandidate }[] = [];
  for (let i = 0; i < unique.length; i++) {
    const pt = unique[i].poketraceCandidate;
    if (!pt?.image) continue;
    confirmCandidates.push({
      idx: i,
      cand: {
        image: pt.image,
        name: pt.name,
        set: pt.set,
        collectorNumber: pt.cardNumber,
      },
    });
  }

  if (confirmCandidates.length === 0) {
    return { resolved: false, reason: "multiple_unconfirmed" };
  }

  let confirm: ConfirmResult;
  try {
    confirm = await deps.confirmMatch(
      input.cropDataUrl,
      confirmCandidates.map((c) => c.cand),
    );
  } catch {
    return { resolved: false, reason: "lookup_error" };
  }

  // Re-verification context: we already know the name + setCode are right;
  // confirmMatch is only picking the collector number from a short list. That
  // is a safer call than a fresh visual identification from a blank slate, so
  // we accept "medium" here even though the fresh-rescue path in actions.ts
  // stays at "high" only.
  if (confirm.chosenIndex === null) {
    return { resolved: false, reason: "multiple_unconfirmed" };
  }
  if (confirm.confidence !== "high" && confirm.confidence !== "medium") {
    return { resolved: false, reason: "multiple_unconfirmed" };
  }

  const picked = confirmCandidates[confirm.chosenIndex];
  if (!picked) return { resolved: false, reason: "multiple_unconfirmed" };

  return {
    resolved: true,
    collectorNumber: unique[picked.idx].displayNumber,
    via: "visual_confirm",
  };
}

/**
 * Filter predicate: which cards qualify for the recovery pass. Exported so
 * callers can short-circuit when no card needs recovery (avoids spinning up
 * the Promise.all machinery for a no-op pass).
 */
export function needsRecovery(card: {
  status: string;
  name: string | null;
  setCode: string | null;
  collectorNumber: string | null;
}): boolean {
  return (
    card.status === "identified" &&
    !!card.name &&
    !!card.setCode &&
    !card.collectorNumber
  );
}
