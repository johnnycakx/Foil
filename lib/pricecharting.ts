// PriceCharting API client. Provides the GRADED LADDER for cards (PSA 7/8/9/9.5/10,
// CGC 10, SGC 10, BGS 10) plus a 4th ungraded cross-reference. PokeTrace remains
// authoritative for identification + the eBay/TCGplayer/Cardmarket ungraded view.
//
// API shape (verified via scripts/probe-pricecharting.ts on 2026-05-19):
//   - GET /api/products?t=<key>&q=<text>  → search, returns up to 20 hits
//   - GET /api/product?t=<key>&id=<id>    → single product detail
//   - All prices are integer pennies. 0 means "no data" (NOT null).
//   - Card field-to-tier mapping is PriceCharting's overloaded card schema
//     (see PRICE_FIELD_TO_TIER below). Verified empirically against the
//     monotonic price ladder for 3 probe cards.
//
// We cache the PokeTrace-id → PriceCharting-id mapping in Supabase
// (public.pricecharting_id_map) so subsequent scans skip the search call. The
// cache table is server-side only; clients can't read or write it (RLS denies
// all). Cache writes/reads are best-effort: if the table doesn't exist or
// Supabase is unavailable, the integration falls back to live search.

import { supabaseAdmin } from "./supabase/admin.ts";
import type { GradeTier, PriceQuote } from "./pricing.ts";

const BASE_URL = "https://www.pricecharting.com/api";

// PriceCharting overloads its video-game CSV column names for cards. See
// scripts/PRICECHARTING_API_FINDINGS.md for the empirical derivation.
const PRICE_FIELD_TO_TIER: Record<string, GradeTier> = {
  "loose-price": "RAW_UNGRADED",
  "cib-price": "PSA_7",
  "new-price": "PSA_8",
  "graded-price": "PSA_9",
  "box-only-price": "PSA_9_5",
  "manual-only-price": "PSA_10",
  "condition-17-price": "CGC_10",
  "condition-18-price": "SGC_10",
  "bgs-10-price": "BGS_10",
};

type PriceFieldKey = keyof typeof PRICE_FIELD_TO_TIER;

type RawProduct = {
  id?: string | number;
  "product-name"?: string;
  "console-name"?: string;
  status?: "success" | "error";
  "error-message"?: string;
} & Partial<Record<PriceFieldKey, number>>;

type ProductsResponse = {
  status: "success" | "error";
  products?: RawProduct[];
  "error-message"?: string;
};

type ProductResponse = RawProduct & {
  status: "success" | "error";
};

export type PriceChartingLookupInput = {
  poketraceId: string;
  name: string;
  setName: string;          // e.g. "Base Set" — for console disambiguation
  collectorNumber: string | null;
};

export type PriceChartingResult = {
  pricechartingId: string;
  productName: string;
  consoleName: string;
  quotes: PriceQuote[];
};

function token(): string {
  const t = process.env.PRICECHARTING_API_KEY;
  if (!t) throw new Error("PRICECHARTING_API_KEY is not set");
  return t;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

function quotesFromProduct(product: RawProduct): PriceQuote[] {
  const quotes: PriceQuote[] = [];
  for (const [field, tier] of Object.entries(PRICE_FIELD_TO_TIER)) {
    const cents = product[field as PriceFieldKey];
    if (typeof cents !== "number" || cents <= 0) continue;
    quotes.push({
      source: "pricecharting",
      tier,
      amount: centsToDollars(cents),
    });
  }
  return quotes;
}

// --- Cache (Supabase-backed) ---------------------------------------------
// All operations are best-effort. A missing table or transient outage MUST
// degrade to live search rather than throwing — pricing is non-blocking.

const _memo = new Map<string, { id: string; name: string; console: string } | null>();

async function getCachedId(poketraceId: string): Promise<{ id: string; name: string; console: string } | null> {
  if (_memo.has(poketraceId)) return _memo.get(poketraceId)!;
  try {
    const { data } = await supabaseAdmin()
      .from("pricecharting_id_map")
      .select("pricecharting_id, pricecharting_name, console_name")
      .eq("poketrace_id", poketraceId)
      .maybeSingle();
    if (data) {
      const entry = {
        id: data.pricecharting_id,
        name: data.pricecharting_name,
        console: data.console_name,
      };
      _memo.set(poketraceId, entry);
      return entry;
    }
  } catch (err) {
    // Cache miss path. Most likely cause: migration hasn't been pushed yet.
    console.warn(
      `[pricecharting] cache read failed (table missing?): ${err instanceof Error ? err.message : err}`,
    );
  }
  _memo.set(poketraceId, null);
  return null;
}

async function setCachedId(
  poketraceId: string,
  product: { id: string; name: string; console: string },
): Promise<void> {
  _memo.set(poketraceId, product);
  try {
    await supabaseAdmin()
      .from("pricecharting_id_map")
      .upsert(
        {
          poketrace_id: poketraceId,
          pricecharting_id: product.id,
          pricecharting_name: product.name,
          console_name: product.console,
          last_synced: new Date().toISOString(),
        },
        { onConflict: "poketrace_id" },
      );
  } catch (err) {
    console.warn(
      `[pricecharting] cache write failed: ${err instanceof Error ? err.message : err}`,
    );
  }
}

// --- Public surface ------------------------------------------------------

/**
 * Compose the search query for PriceCharting's `q` parameter. PriceCharting's
 * relevance ranker weights name and console-name. We seed with "pokemon" so
 * the search stays in the TCG namespace and a normalized set token + the
 * collector number so the right printing surfaces in the top 3.
 */
function buildSearchQuery(input: PriceChartingLookupInput): string {
  const parts = ["pokemon", input.name, input.setName];
  if (input.collectorNumber) {
    const m = input.collectorNumber.match(/^(\d+)/);
    if (m) parts.push(m[1]);
  }
  return parts
    .map((p) => p.toLowerCase().trim())
    .filter((p) => p.length > 0)
    .join(" ");
}

/**
 * Resolve a PokeTrace match to a PriceCharting product, then return the full
 * tier ladder as PriceQuote[]. Returns null when the API returns nothing
 * usable for this card; callers must treat that as "no PriceCharting data"
 * rather than as an error.
 */
export async function lookupPriceCharting(
  input: PriceChartingLookupInput,
): Promise<PriceChartingResult | null> {
  // 1) Cache hit short-circuit: skip search, go straight to detail.
  const cached = await getCachedId(input.poketraceId);
  if (cached) {
    const detailUrl = `${BASE_URL}/product?t=${encodeURIComponent(token())}&id=${encodeURIComponent(cached.id)}`;
    const detail = await fetchJson<ProductResponse>(detailUrl);
    if (detail && detail.status === "success") {
      return {
        pricechartingId: cached.id,
        productName: cached.name,
        consoleName: cached.console,
        quotes: quotesFromProduct(detail),
      };
    }
    // Cached id was invalid or detail failed — fall through to search.
  }

  // 2) Live search.
  const query = buildSearchQuery(input);
  const searchUrl = `${BASE_URL}/products?t=${encodeURIComponent(token())}&q=${encodeURIComponent(query)}`;
  const search = await fetchJson<ProductsResponse>(searchUrl);
  if (!search || search.status !== "success" || !search.products?.length) {
    return null;
  }

  // 3) Pick the best hit. Prefer the candidate whose product-name contains the
  // collector number ("#<n>") AND whose console-name contains the set name.
  // PriceCharting search is fuzzy; a naive "first hit" frequently picks the
  // wrong printing (1st edition vs. shadowless vs. unlimited).
  const ranked = [...search.products].sort((a, b) => rank(input, b) - rank(input, a));
  const winner = ranked[0];
  const winnerId = winner?.id != null ? String(winner.id) : null;
  if (!winnerId) return null;

  await setCachedId(input.poketraceId, {
    id: winnerId,
    name: winner["product-name"] ?? "",
    console: winner["console-name"] ?? "",
  });

  return {
    pricechartingId: winnerId,
    productName: winner["product-name"] ?? "",
    consoleName: winner["console-name"] ?? "",
    quotes: quotesFromProduct(winner),
  };
}

function rank(input: PriceChartingLookupInput, product: RawProduct): number {
  let score = 0;
  const productName = (product["product-name"] ?? "").toLowerCase();
  const consoleName = (product["console-name"] ?? "").toLowerCase();

  // Collector number in product-name is the strongest signal — PriceCharting
  // includes "#<number>" in the title for nearly every card.
  if (input.collectorNumber) {
    const m = input.collectorNumber.match(/^(\d+)/);
    if (m && productName.includes(`#${m[1]}`)) score += 100;
  }

  // Set-name overlap on console-name.
  const setLower = input.setName.toLowerCase();
  if (setLower && consoleName.includes(setLower)) score += 50;

  // Name overlap on product-name.
  const nameLower = input.name.toLowerCase();
  if (nameLower && productName.includes(nameLower)) score += 30;

  // Penalize 1st edition / shadowless / japanese unless the user's set name
  // suggested those — generic "Base Set" should match the plain "Charizard #4",
  // not "[1st Edition]" or "[Shadowless]" variants.
  if (!setLower.includes("1st") && productName.includes("1st edition")) score -= 40;
  if (!setLower.includes("shadowless") && productName.includes("shadowless")) score -= 40;
  if (!consoleName.includes("japanese") && productName.includes("japanese")) score -= 30;

  return score;
}

export async function lookupMany(
  inputs: PriceChartingLookupInput[],
): Promise<Array<PriceChartingResult | null>> {
  return Promise.all(inputs.map((i) => lookupPriceCharting(i).catch(() => null)));
}

export type PriceChartingCandidate = {
  id: string;
  productName: string;
  consoleName: string;
  cardNumber: string | null;     // parsed from "#N" in product-name
};

/**
 * Multi-candidate search variant used by the partial-ID recovery pass.
 * Returns up to `limit` ranked candidates without committing to a single
 * winner. Skips the detail call (and the cache write) — recovery only needs
 * cardNumbers to disambiguate, not full price ladders.
 */
export async function searchPriceCharting(
  input: { name: string; setName: string },
  limit = 5,
): Promise<PriceChartingCandidate[]> {
  const query = ["pokemon", input.name, input.setName]
    .map((p) => p.toLowerCase().trim())
    .filter((p) => p.length > 0)
    .join(" ");
  const url = `${BASE_URL}/products?t=${encodeURIComponent(token())}&q=${encodeURIComponent(query)}`;
  const search = await fetchJson<ProductsResponse>(url);
  if (!search || search.status !== "success" || !search.products?.length) return [];

  return search.products
    .slice(0, limit)
    .map((p) => {
      const name = p["product-name"] ?? "";
      const m = name.match(/#(\d+)/);
      return {
        id: p.id != null ? String(p.id) : "",
        productName: name,
        consoleName: p["console-name"] ?? "",
        cardNumber: m ? m[1] : null,
      };
    })
    .filter((c) => c.id.length > 0);
}
