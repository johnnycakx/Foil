const BASE_URL = "https://api.poketrace.com/v1";

export type PriceTierKey =
  | "DAMAGED"
  | "HEAVILY_PLAYED"
  | "MODERATELY_PLAYED"
  | "LIGHTLY_PLAYED"
  | "NEAR_MINT"
  | `PSA_${string}`
  | `BGS_${string}`
  | `CGC_${string}`;

export type PriceSource = "ebay" | "tcgplayer" | "cardmarket";

export type PriceSnapshot = {
  avg: number | null;
  low: number | null;
  high: number | null;
  saleCount: number | null;
  lastUpdated: string | null;
};

type RawPriceSnapshot = Partial<PriceSnapshot> & Record<string, unknown>;

export type PokeTraceCard = {
  id: string;
  name: string;
  cardNumber: string;
  set: { slug: string; name: string };
  variant: string;
  rarity: string;
  productType: string;
  productFamily: string;
  image: string | null;
  game: string;
  market: string;
  currency: string;
  refs: { tcgplayerId: string | null; cardmarketId: string | null };
  prices: Partial<Record<PriceSource, Record<string, RawPriceSnapshot>>>;
};

type SearchResponse = {
  data: PokeTraceCard[];
  pagination: { hasMore: boolean; nextCursor: string | null; count: number };
};

export type GradedPrice = {
  tier: string;
  source: PriceSource;
  avg: number;
};

export type TopPrice = {
  amount: number;
  source: PriceSource;
  sourceLabel: string;
};

export type FailureCode =
  | "insufficient_information"
  | "unreadable"
  | "no_candidates"
  | "low_score"
  | "no_prices"
  | "regulation_mismatch"
  | "lookup_error";

export type CandidateSummary = {
  name: string;
  set: string;
  setSlug: string;
  cardNumber: string;
  variant: string;
};

export type Failure = {
  code: FailureCode;
  message: string;
  topCandidates: CandidateSummary[];
};

export type CardPricing =
  | {
      matched: true;
      lowConfidence: boolean;
      candidate: {
        id: string;
        name: string;
        set: string;
        setSlug: string;
        cardNumber: string;
        variant: string;
        image: string | null;
      };
      raw: {
        ebayNearMintAvg: number | null;
        tcgplayerNearMintAvg: number | null;
        cardmarketNearMintAvg: number | null;
      };
      bestGraded: GradedPrice | null;
      topPrice: TopPrice | null;
      topCandidates: CandidateSummary[];
    }
  | { matched: false; reason: string; failure: Failure };

const PRICE_UNAVAILABLE = "Price unavailable — set may be misidentified.";
const PRICE_UNREADABLE = "Price unavailable — card details too unclear to look up.";
const PRICE_INSUFFICIENT = "Couldn't read this card — needs review.";
export const PRICE_NEEDS_REVIEW = "Needs manual review.";

function safeStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function slugifySet(name: string | null | undefined): string {
  const s = safeStr(name);
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Framework set-code → PokeTrace set-slug map. PokeTrace's slugs are full set
// names; set codes are the canonical primary key the new prompt reports.
const SET_CODE_TO_SLUG: Record<string, string> = {
  SVI: "scarlet-violet",
  PAL: "paldea-evolved",
  OBF: "obsidian-flames",
  MEW: "151",
  PAR: "paradox-rift",
  PAF: "paldean-fates",
  TEF: "temporal-forces",
  TWM: "twilight-masquerade",
  SFA: "shrouded-fable",
  SCR: "stellar-crown",
  SSP: "surging-sparks",
  PRE: "prismatic-evolutions",
  JTG: "journey-together",
  DRI: "destined-rivals",
  BLK: "black-bolt",
  WHT: "white-flare",
  MEG: "mega-evolution",
  CRZ: "crown-zenith",
};

// Each modern set code's required regulation mark. If a card has a printed
// mark that doesn't match its claimed set, it can't be from that set.
const SET_CODE_TO_REGULATION_MARK: Record<string, string> = {
  // F-mark era (2022)
  CRZ: "F",
  // G-mark era (2023, SV era opening)
  SVI: "G",
  PAL: "G",
  OBF: "G",
  MEW: "G",
  PAR: "G",
  PAF: "G",
  // H-mark era (2024+)
  TEF: "H",
  TWM: "H",
  SFA: "H",
  SCR: "H",
  SSP: "H",
  PRE: "H",
  // I-mark era (2025+)
  JTG: "I",
  DRI: "I",
  BLK: "I",
  WHT: "I",
  MEG: "I",
};

function regulationCompatible(
  printedMark: string | null | undefined,
  setSlug: string,
): boolean {
  const mark = safeStr(printedMark)?.toUpperCase();
  if (!mark) return true; // No printed mark to check against — don't drop.
  // Resolve PokeTrace slug back to a known framework code (best effort).
  const code = Object.entries(SET_CODE_TO_SLUG).find(([, slug]) => slug === setSlug)?.[0];
  if (!code) return true; // Unknown PokeTrace set; we can't gate confidently.
  const expected = SET_CODE_TO_REGULATION_MARK[code];
  if (!expected) return true;
  return mark === expected;
}

function cardNumberForms(raw: string | null | undefined): string[] {
  const cleaned = safeStr(raw);
  if (!cleaned) return [];
  const m = cleaned.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return [cleaned];
  const [, n, t] = m;
  return Array.from(
    new Set([
      `${n}/${t}`,
      `${n.padStart(3, "0")}/${t.padStart(3, "0")}`,
      `${n.padStart(3, "0")}/${t}`,
    ]),
  );
}

function bareNumber(raw: string | null | undefined): string | null {
  const s = safeStr(raw);
  if (!s) return null;
  const m = s.match(/^(\d+)/);
  return m ? String(parseInt(m[1], 10)) : null;
}

function expectedVariants(rarity: string | null | undefined): string[] {
  const s = safeStr(rarity);
  if (!s) return ["Normal", "Holofoil", "Reverse Holofoil"];
  const r = s.toLowerCase();
  if (r.includes("reverse")) return ["Reverse Holofoil", "Holofoil"];
  if (
    r.includes("holo") ||
    r.includes("ultra") ||
    r.includes("secret") ||
    r.includes("rainbow") ||
    r.includes("gold") ||
    r.includes("full art") ||
    r.includes("alt art") ||
    r.includes("vmax") ||
    r.includes("vstar") ||
    r === "v" ||
    r.includes("gx") ||
    r.includes("ex") ||
    r.includes("illustration") ||
    r.includes("hyper")
  ) {
    return ["Holofoil"];
  }
  return ["Normal", "Holofoil", "Reverse Holofoil"];
}

function hasUsablePrices(card: PokeTraceCard): boolean {
  return !!(card.prices?.ebay || card.prices?.tcgplayer || card.prices?.cardmarket);
}

function score(claude: ClaudeCardLite, card: PokeTraceCard): number {
  let s = 0;

  // Collector-number match is the highest signal (the framework's primary key).
  const claudeNums = cardNumberForms(claude.collectorNumber);
  if (claudeNums.length > 0 && claudeNums.includes(card.cardNumber)) {
    s += 100;
  } else {
    const cb = bareNumber(claude.collectorNumber);
    const cardBare = bareNumber(card.cardNumber);
    if (cb && cardBare && cb === cardBare) s += 60;
  }

  // Set-code exact match via SET_CODE_TO_SLUG.
  const code = safeStr(claude.setCode)?.toUpperCase();
  const expectedSlug = code ? SET_CODE_TO_SLUG[code] : undefined;
  if (expectedSlug && card.set?.slug === expectedSlug) {
    s += 50;
  }

  // Fall back to fuzzy set-name match (older cards, or unknown set codes).
  const claudeSet = safeStr(claude.setName) ?? safeStr(claude.setCode);
  if (claudeSet) {
    const claudeSetLower = claudeSet.toLowerCase();
    const cardSetLower = card.set?.name?.toLowerCase() ?? "";
    if (cardSetLower && cardSetLower === claudeSetLower) s += 30;
    else if (cardSetLower && (cardSetLower.includes(claudeSetLower) || claudeSetLower.includes(cardSetLower))) s += 20;
  }

  if (expectedVariants(claude.rarity).includes(card.variant)) s += 20;
  if (hasUsablePrices(card)) s += 15;

  const claudeName = safeStr(claude.name);
  const cardName = safeStr(card.name);
  if (claudeName && cardName && cardName.toLowerCase() === claudeName.toLowerCase()) s += 10;

  return s;
}

function snapAvg(snap: RawPriceSnapshot | undefined): number | null {
  if (!snap) return null;
  const v = snap.avg;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const GRADED_RE = /^(PSA|BGS|CGC)_/;

function bestGraded(card: PokeTraceCard): GradedPrice | null {
  let best: GradedPrice | null = null;
  for (const source of ["ebay", "tcgplayer", "cardmarket"] as const) {
    const tiers = card.prices?.[source];
    if (!tiers) continue;
    for (const [tier, snap] of Object.entries(tiers)) {
      if (!GRADED_RE.test(tier)) continue;
      const avg = snapAvg(snap);
      if (avg === null) continue;
      if (!best || avg > best.avg) best = { tier, source, avg };
    }
  }
  return best;
}

function topRawPrice(card: PokeTraceCard): TopPrice | null {
  const ebay = snapAvg(card.prices?.ebay?.NEAR_MINT);
  if (ebay !== null) return { amount: ebay, source: "ebay", sourceLabel: "eBay sold (NM)" };
  const tcg = snapAvg(card.prices?.tcgplayer?.NEAR_MINT);
  if (tcg !== null) return { amount: tcg, source: "tcgplayer", sourceLabel: "TCGplayer (NM)" };
  const cmNm = snapAvg(card.prices?.cardmarket?.NEAR_MINT);
  if (cmNm !== null) return { amount: cmNm, source: "cardmarket", sourceLabel: "Cardmarket (NM)" };
  const cmAgg = snapAvg(card.prices?.cardmarket?.AGGREGATED);
  if (cmAgg !== null) return { amount: cmAgg, source: "cardmarket", sourceLabel: "Cardmarket (avg)" };
  const ebayAgg = snapAvg(card.prices?.ebay?.AGGREGATED);
  if (ebayAgg !== null) return { amount: ebayAgg, source: "ebay", sourceLabel: "eBay (avg)" };
  return null;
}

export type ClaudeCardLite = {
  status?: "identified" | "insufficient_information" | null;
  name: string | null | undefined;
  setCode: string | null | undefined;
  setName?: string | null | undefined;
  collectorNumber: string | null | undefined;
  rarity: string | null | undefined;
  regulationMark?: string | null | undefined;
};

async function fetchCards(params: Record<string, string>): Promise<PokeTraceCard[]> {
  const key = process.env.POKETRACE_API_KEY;
  if (!key) throw new Error("POKETRACE_API_KEY is not set");
  const url = new URL(`${BASE_URL}/cards`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { "X-API-Key": key, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PokeTrace ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as SearchResponse;
  return json.data ?? [];
}

function summarize(card: PokeTraceCard): CandidateSummary {
  return {
    name: card.name,
    set: card.set?.name ?? "(unknown set)",
    setSlug: card.set?.slug ?? "",
    cardNumber: card.cardNumber,
    variant: card.variant,
  };
}

function topCandidatesFor(candidates: PokeTraceCard[], claude: ClaudeCardLite, limit = 5): CandidateSummary[] {
  return [...candidates]
    .map((c) => ({ card: c, s: score(claude, c) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ card }) => summarize(card));
}

function buildCandidateLines(top: CandidateSummary[]): string {
  return top.map((c) => `  - "${c.name}" - ${c.set} #${c.cardNumber} (${c.variant})`).join("\n");
}

export async function priceCard(claude: ClaudeCardLite): Promise<CardPricing> {
  // Framework rule: if Vision flagged insufficient_information, skip PokeTrace
  // entirely — the model couldn't read enough fields to disambiguate.
  if (claude.status === "insufficient_information") {
    return {
      matched: false,
      reason: PRICE_INSUFFICIENT,
      failure: {
        code: "insufficient_information",
        message: "Vision flagged this card as unreadable (name and identifying numbers missing).",
        topCandidates: [],
      },
    };
  }

  const claudeName = safeStr(claude.name);
  const claudeNumber = safeStr(claude.collectorNumber);
  const claudeSetCode = safeStr(claude.setCode)?.toUpperCase();
  const setSlug = claudeSetCode ? SET_CODE_TO_SLUG[claudeSetCode] : undefined;

  if (!claudeName && !claudeNumber && !claudeSetCode) {
    return {
      matched: false,
      reason: PRICE_UNREADABLE,
      failure: {
        code: "unreadable",
        message: "Card lacks any usable lookup key (no name, set code, or collector number).",
        topCandidates: [],
      },
    };
  }

  // ---- Lookup priority ladder ----
  //   (a) collectorNumber + setCode (exact)
  //   (b) name + setCode (fuzzy)
  //   (c) name alone (low_confidence)
  // PokeTrace's `/cards` endpoint takes free-text `search` plus optional `set`.
  // We feed name into search and gate set via the slug we resolved from the
  // set code; if we have a collectorNumber we re-rank by it client-side.

  const candidates: PokeTraceCard[] = [];
  const seen = new Set<string>();
  let lookupTier: "exact" | "set_only" | "name_only" = "name_only";

  if (claudeName && setSlug) {
    try {
      const r = await fetchCards({ search: claudeName, set: setSlug, limit: "20" });
      for (const c of r) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          candidates.push(c);
        }
      }
      lookupTier = claudeNumber ? "exact" : "set_only";
    } catch {
      /* fall through */
    }
  } else if (setSlug) {
    try {
      const r = await fetchCards({ set: setSlug, limit: "20" });
      for (const c of r) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          candidates.push(c);
        }
      }
      lookupTier = "set_only";
    } catch {
      /* fall through */
    }
  }

  if (candidates.length === 0 && claudeName) {
    try {
      const r = await fetchCards({ search: claudeName, limit: "20" });
      for (const c of r) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          candidates.push(c);
        }
      }
      lookupTier = "name_only";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        matched: false,
        reason: PRICE_UNAVAILABLE,
        failure: {
          code: "lookup_error",
          message: `PokeTrace lookup failed: ${message}`,
          topCandidates: [],
        },
      };
    }
  }

  // Regulation-mark gate: drop any candidate whose set's required mark doesn't
  // match the printed mark Vision read.
  const filtered = candidates.filter((c) => regulationCompatible(claude.regulationMark, c.set?.slug ?? ""));
  const droppedByMark = candidates.length - filtered.length;
  const pool = filtered.length > 0 ? filtered : candidates;

  const top = topCandidatesFor(pool, claude);

  if (pool.length === 0) {
    return {
      matched: false,
      reason: PRICE_UNAVAILABLE,
      failure: {
        code: droppedByMark > 0 ? "regulation_mismatch" : "no_candidates",
        message:
          droppedByMark > 0
            ? `Regulation mark "${claude.regulationMark}" rules out the matching candidates for set code "${claudeSetCode}".`
            : `PokeTrace has no card named "${claudeName ?? "?"}". The printed name may differ from the canonical English name, or the set code is unknown.`,
        topCandidates: top,
      },
    };
  }

  let bestCard: PokeTraceCard | null = null;
  let bestScore = -Infinity;
  for (const c of pool) {
    const s = score(claude, c);
    if (s > bestScore) {
      bestScore = s;
      bestCard = c;
    }
  }

  const MIN_SCORE = lookupTier === "name_only" ? 40 : 70;
  if (!bestCard || bestScore < MIN_SCORE) {
    const claimedNumber = claudeNumber ?? "(no number)";
    return {
      matched: false,
      reason: PRICE_UNAVAILABLE,
      failure: {
        code: "low_score",
        message: `No "${claudeName ?? "?"}" card in set code "${claudeSetCode ?? "?"}" matches the printed number ${claimedNumber}. Closest PokeTrace candidates:\n${buildCandidateLines(top)}`,
        topCandidates: top,
      },
    };
  }

  const topPrice = topRawPrice(bestCard);
  const graded = bestGraded(bestCard);

  if (!topPrice && !graded) {
    return {
      matched: false,
      reason: PRICE_UNAVAILABLE,
      failure: {
        code: "no_prices",
        message: `Matched "${bestCard.name}" in "${bestCard.set?.name}" but PokeTrace has no eBay/TCGplayer/Cardmarket prices on file for variant "${bestCard.variant}".`,
        topCandidates: top,
      },
    };
  }

  const lowConfidence = lookupTier === "name_only";

  return {
    matched: true,
    lowConfidence,
    candidate: {
      id: bestCard.id,
      name: bestCard.name,
      set: bestCard.set.name,
      setSlug: bestCard.set.slug,
      cardNumber: bestCard.cardNumber,
      variant: bestCard.variant,
      image: bestCard.image,
    },
    raw: {
      ebayNearMintAvg: snapAvg(bestCard.prices?.ebay?.NEAR_MINT),
      tcgplayerNearMintAvg: snapAvg(bestCard.prices?.tcgplayer?.NEAR_MINT),
      cardmarketNearMintAvg: snapAvg(bestCard.prices?.cardmarket?.NEAR_MINT),
    },
    bestGraded: graded,
    topPrice,
    topCandidates: top,
  };
}

export async function priceCards(cards: ClaudeCardLite[]): Promise<CardPricing[]> {
  return Promise.all(cards.map((c) => priceCard(c)));
}

export function collectionTotalRawNm(pricings: CardPricing[]): number {
  let total = 0;
  for (const p of pricings) {
    if (p.matched && p.topPrice) total += p.topPrice.amount;
  }
  return Math.round(total * 100) / 100;
}
