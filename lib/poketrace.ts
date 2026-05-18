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
  | "unreadable"
  | "no_candidates"
  | "low_score"
  | "no_prices"
  | "lookup_error";

export type Failure = {
  code: FailureCode;
  message: string;
  topCandidates?: { name: string; set: string; cardNumber: string; variant: string }[];
};

export type CardPricing =
  | {
      matched: true;
      candidate: {
        id: string;
        name: string;
        set: string;
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
    }
  | { matched: false; reason: string; failure: Failure };

const PRICE_UNAVAILABLE = "Price unavailable — set may be misidentified.";
const PRICE_UNREADABLE = "Price unavailable — card details too unclear to look up.";
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
  if (!s) return ["Normal", "Holofoil"];
  const r = s.toLowerCase();
  if (r.includes("reverse")) return ["Reverse Holofoil", "Holofoil"];
  if (r.includes("holo") || r.includes("ultra") || r.includes("secret") || r.includes("rainbow") || r.includes("gold") || r.includes("full art") || r.includes("alt art") || r.includes("vmax") || r.includes("vstar") || r === "v" || r.includes("gx") || r.includes("ex")) {
    return ["Holofoil"];
  }
  return ["Normal", "Holofoil"];
}

function hasUsablePrices(card: PokeTraceCard): boolean {
  return !!(card.prices?.ebay || card.prices?.tcgplayer);
}

function score(claude: ClaudeCardLite, card: PokeTraceCard): number {
  let s = 0;
  const claudeNums = cardNumberForms(claude.cardNumber);
  if (claudeNums.length > 0 && claudeNums.includes(card.cardNumber)) {
    s += 100;
  } else {
    const cb = bareNumber(claude.cardNumber);
    const cardBare = bareNumber(card.cardNumber);
    if (cb && cardBare && cb === cardBare) s += 60;
  }
  const claudeSet = safeStr(claude.set);
  if (claudeSet) {
    const claudeSetLower = claudeSet.toLowerCase();
    const cardSetLower = card.set?.name?.toLowerCase() ?? "";
    if (cardSetLower && cardSetLower === claudeSetLower) s += 40;
    else if (cardSetLower && (cardSetLower.includes(claudeSetLower) || claudeSetLower.includes(cardSetLower))) s += 25;
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
  // Newer sets (e.g. Prismatic Evolutions) often expose only an aggregated
  // cardmarket tier rather than per-condition splits. Use it as the last
  // raw-price fallback so we surface *something* instead of "no prices".
  const cmAgg = snapAvg(card.prices?.cardmarket?.AGGREGATED);
  if (cmAgg !== null) return { amount: cmAgg, source: "cardmarket", sourceLabel: "Cardmarket (avg)" };
  const ebayAgg = snapAvg(card.prices?.ebay?.AGGREGATED);
  if (ebayAgg !== null) return { amount: ebayAgg, source: "ebay", sourceLabel: "eBay (avg)" };
  return null;
}

export type ClaudeCardLite = {
  name: string | null | undefined;
  set: string | null | undefined;
  cardNumber: string | null | undefined;
  rarity: string | null | undefined;
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

function topCandidatesFor(candidates: PokeTraceCard[], claude: ClaudeCardLite, limit = 5) {
  return [...candidates]
    .map((c) => ({ card: c, s: score(claude, c) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ card }) => ({
      name: card.name,
      set: card.set?.name ?? "(unknown set)",
      cardNumber: card.cardNumber,
      variant: card.variant,
    }));
}

export async function priceCard(claude: ClaudeCardLite): Promise<CardPricing> {
  const claudeName = safeStr(claude.name);
  if (!claudeName) {
    return {
      matched: false,
      reason: PRICE_UNREADABLE,
      failure: { code: "unreadable", message: "Name field was empty or unreadable." },
    };
  }

  const candidates: PokeTraceCard[] = [];
  const seen = new Set<string>();

  const slug = slugifySet(claude.set);
  try {
    if (slug) {
      const setMatches = await fetchCards({ search: claudeName, set: slug, limit: "20" });
      for (const c of setMatches) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          candidates.push(c);
        }
      }
    }
  } catch {
    // Fall through to the unfiltered search.
  }

  if (candidates.length === 0) {
    try {
      const open = await fetchCards({ search: claudeName, limit: "20" });
      for (const c of open) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          candidates.push(c);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        matched: false,
        reason: PRICE_UNAVAILABLE,
        failure: { code: "lookup_error", message: `PokeTrace lookup failed: ${message}` },
      };
    }
  }

  if (candidates.length === 0) {
    return {
      matched: false,
      reason: PRICE_UNAVAILABLE,
      failure: {
        code: "no_candidates",
        message: `PokeTrace has no card named "${claudeName}". The Pokémon name is likely wrong, OR the printed name differs from the canonical English name.`,
      },
    };
  }

  let bestCard: PokeTraceCard | null = null;
  let bestScore = -Infinity;
  for (const c of candidates) {
    const s = score(claude, c);
    if (s > bestScore) {
      bestScore = s;
      bestCard = c;
    }
  }

  if (!bestCard || bestScore < 70) {
    const top = topCandidatesFor(candidates, claude);
    const claimedSet = safeStr(claude.set) ?? "(no set)";
    const claimedNumber = safeStr(claude.cardNumber) ?? "(no number)";
    const candidateLines = top
      .map((c) => `  - "${c.name}" - ${c.set} #${c.cardNumber} (${c.variant})`)
      .join("\n");
    return {
      matched: false,
      reason: PRICE_UNAVAILABLE,
      failure: {
        code: "low_score",
        message: `No "${claudeName}" card in "${claimedSet}" matches the printed number ${claimedNumber}. Closest PokeTrace candidates by name:\n${candidateLines}\nThe Pokémon name is likely correct, but the set or card number is wrong - look at the set symbol and the N/T denominator again.`,
        topCandidates: top,
      },
    };
  }

  const top = topRawPrice(bestCard);
  const graded = bestGraded(bestCard);

  if (!top && !graded) {
    return {
      matched: false,
      reason: PRICE_UNAVAILABLE,
      failure: {
        code: "no_prices",
        message: `Matched "${bestCard.name}" in "${bestCard.set?.name}" but PokeTrace has no eBay/TCGplayer/Cardmarket prices on file for variant "${bestCard.variant}".`,
      },
    };
  }

  return {
    matched: true,
    candidate: {
      id: bestCard.id,
      name: bestCard.name,
      set: bestCard.set.name,
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
    topPrice: top,
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
