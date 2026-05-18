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
  | { matched: false; reason: string };

const PRICE_UNAVAILABLE = "Price unavailable — set may be misidentified.";

function slugifySet(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cardNumberForms(raw: string): string[] {
  const cleaned = raw.trim();
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

function bareNumber(raw: string): string | null {
  const m = raw.match(/^(\d+)/);
  return m ? String(parseInt(m[1], 10)) : null;
}

function expectedVariants(rarity: string): string[] {
  const r = rarity.toLowerCase();
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
  if (claudeNums.includes(card.cardNumber)) s += 100;
  else {
    const cb = bareNumber(claude.cardNumber);
    const cardBare = bareNumber(card.cardNumber);
    if (cb && cardBare && cb === cardBare) s += 60;
  }
  const claudeSetLower = claude.set.toLowerCase();
  const cardSetLower = card.set.name.toLowerCase();
  if (cardSetLower === claudeSetLower) s += 40;
  else if (cardSetLower.includes(claudeSetLower) || claudeSetLower.includes(cardSetLower)) s += 25;
  if (expectedVariants(claude.rarity).includes(card.variant)) s += 20;
  if (hasUsablePrices(card)) s += 15;
  if (card.name.toLowerCase() === claude.name.toLowerCase()) s += 10;
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
  const cm = snapAvg(card.prices?.cardmarket?.NEAR_MINT);
  if (cm !== null) return { amount: cm, source: "cardmarket", sourceLabel: "Cardmarket (NM)" };
  return null;
}

export type ClaudeCardLite = {
  name: string;
  set: string;
  cardNumber: string;
  rarity: string;
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

export async function priceCard(claude: ClaudeCardLite): Promise<CardPricing> {
  const candidates: PokeTraceCard[] = [];
  const seen = new Set<string>();

  const slug = slugifySet(claude.set);
  try {
    if (slug) {
      const setMatches = await fetchCards({ search: claude.name, set: slug, limit: "20" });
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
      const open = await fetchCards({ search: claude.name, limit: "20" });
      for (const c of open) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          candidates.push(c);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { matched: false, reason: `Lookup failed: ${message}` };
    }
  }

  if (candidates.length === 0) {
    return { matched: false, reason: PRICE_UNAVAILABLE };
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
    return { matched: false, reason: PRICE_UNAVAILABLE };
  }

  const top = topRawPrice(bestCard);
  const graded = bestGraded(bestCard);

  if (!top && !graded) {
    return { matched: false, reason: PRICE_UNAVAILABLE };
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
