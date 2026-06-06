// Deals leaderboard refresh batch (ROADMAP B.4 / ADR-054). Pure orchestrator —
// the cron route (app/api/cron/deals-refresh/route.ts) injects the live deps;
// tests inject fakes of the same shape (mirrors lib/wishlist/scan-batch.ts).
//
// Responsibilities — and ONLY these:
//   1. For each CURATED card: fetch catalog metadata + the live eBay best
//      listing, compute the condition-matched buy signal.
//   2. Build a DERIVED cache row (R-008: no eBay listing field — the live ask
//      is used to classify, then discarded; only the signal + delta + the
//      PokeTrace sold reference + SDK catalog display fields persist).
//   3. Cap the number of Browse calls per run (one per card) to protect the
//      eBay quota (R-012). Bounded concurrency so the run fits the function
//      timeout.
//   4. Soft-fail per card — one bad card never aborts the batch.
//
// Out of scope: HTTP auth (route), the actual Supabase upsert (injected), the
// signal math (lib/buy-signal/*), the live Browse fetch (lib/affiliate/*).

import type { EpnBestListing, GetBestListingInput } from "../affiliate/epn.ts";
import type { CardMetadata } from "../cards/sdk.ts";
import type { CardBuySignal } from "../buy-signal/card-signal.ts";

/** Curated catalog entry the cron iterates (slug + SDK id). */
export type CuratedEntry = { slug: string; pokemonTcgId: string };

/** The exact row written to the buy_signals cache. DERIVED + non-eBay only —
 *  there is deliberately NO field for an eBay item id, title, seller, listing
 *  url, listing image, or raw ask price (R-008). The keys here ARE the schema. */
export type DealUpsertRow = {
  card_slug: string;
  card_name: string;
  set_name: string;
  image_url: string;
  signal: "BELOW" | "AT" | "ABOVE" | "UNKNOWN";
  delta_pct: number | null;
  sold_reference: number | null;
  sold_sample_size: number;
  matched_tier: string | null;
  computed_at: string;
};

export type GetBestListingFn = (input: GetBestListingInput) => Promise<EpnBestListing | null>;
export type GetCardMetadataFn = (input: { id: string }) => Promise<CardMetadata>;
/** Fetch a listing's eBay item-specifics (ADR-057) for the like-for-like gate. */
export type GetListingAspectsFn = (input: { itemId: string }) => Promise<Record<string, string> | null>;
export type ComputeSignalFn = (input: {
  variants: CardMetadata["variants"];
  listingTitle: string | undefined | null;
  listingAspects?: Record<string, string> | null;
  askPrice: number;
  selectedVariant?: string;
}) => Promise<CardBuySignal>;
export type UpsertRowsFn = (rows: DealUpsertRow[]) => Promise<{ error: string | null }>;

export type RefreshDealsInput = {
  entries: CuratedEntry[];
  getCardMetadata: GetCardMetadataFn;
  getBestListing: GetBestListingFn;
  getListingAspects: GetListingAspectsFn;
  computeSignal: ComputeSignalFn;
  upsertRows: UpsertRowsFn;
  /** Affiliate custom-id per card (built by the caller via epn.buildCustomId so
   *  the param-assembly boundary stays in epn.ts). */
  customIdFor: (slug: string) => string;
  now?: Date;
  /** Hard cap on Browse calls (= cards processed) per run. Protects the eBay
   *  daily quota (R-012). Production passes MAX_DEALS_BROWSE_CALLS. */
  maxBrowseCalls?: number;
  /** How many cards to process in parallel. Keeps the run under the function
   *  timeout without hammering eBay. */
  concurrency?: number;
};

export type RefreshError = {
  cardSlug: string;
  stage: "metadata" | "browse" | "signal" | "upsert";
  error: string;
};

export type RefreshDealsResult = {
  cardsConsidered: number;
  browseCalls: number;
  listingsFound: number;
  /** Rows classified BELOW this run (what the board will show). */
  belowCount: number;
  /** Rows written to the cache. */
  written: number;
  errors: RefreshError[];
  capHit: boolean;
};

export const MAX_DEALS_BROWSE_CALLS = 240; // ~208 curated today + headroom
export const DEALS_CONCURRENCY = 6;

/** Run `fn` over `items` with at most `concurrency` in flight. Order-independent. */
async function pool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

/**
 * Compute + cache the buy signal for every curated card. Returns aggregate
 * counts; never throws (soft-fail per card, collected in `errors`).
 */
export async function refreshDeals(input: RefreshDealsInput): Promise<RefreshDealsResult> {
  const now = input.now ?? new Date();
  const computedAt = now.toISOString();
  const cap = input.maxBrowseCalls ?? MAX_DEALS_BROWSE_CALLS;
  const concurrency = input.concurrency ?? DEALS_CONCURRENCY;

  // One Browse call per card → cap the card list to the Browse budget.
  const capHit = input.entries.length > cap;
  const entries = capHit ? input.entries.slice(0, cap) : input.entries;

  const rows: DealUpsertRow[] = [];
  const errors: RefreshError[] = [];
  let browseCalls = 0;
  let listingsFound = 0;

  await pool(entries, concurrency, async (entry) => {
    let metadata: CardMetadata;
    try {
      metadata = await input.getCardMetadata({ id: entry.pokemonTcgId });
    } catch (err) {
      errors.push({ cardSlug: entry.slug, stage: "metadata", error: (err as Error).message });
      return;
    }

    let listing: EpnBestListing | null;
    browseCalls += 1;
    try {
      listing = await input.getBestListing({
        cardName: metadata.name,
        setName: metadata.setName,
        customId: input.customIdFor(entry.slug),
        surface: "deals_cron",
      });
    } catch (err) {
      errors.push({ cardSlug: entry.slug, stage: "browse", error: (err as Error).message });
      return;
    }

    // No live listing → write an UNKNOWN row so a stale BELOW from a prior run
    // is cleared (the board never shows a deal whose listing has vanished).
    if (!listing) {
      rows.push({
        card_slug: entry.slug,
        card_name: metadata.name,
        set_name: metadata.setName,
        image_url: metadata.image ?? "",
        signal: "UNKNOWN",
        delta_pct: null,
        sold_reference: null,
        sold_sample_size: 0,
        matched_tier: null,
        computed_at: computedAt,
      });
      return;
    }
    listingsFound += 1;

    // Read the chosen listing's eBay item-specifics (ADR-057) for the
    // like-for-like gate (Card Condition + Language). One extra getItem call per
    // listing-found card. null on failure → conservative UNKNOWN signal.
    let listingAspects: Record<string, string> | null = null;
    if (listing.itemId) {
      try {
        listingAspects = await input.getListingAspects({ itemId: listing.itemId });
      } catch {
        listingAspects = null;
      }
    }

    let cardSignal: CardBuySignal;
    try {
      cardSignal = await input.computeSignal({
        variants: metadata.variants,
        listingTitle: listing.title,
        listingAspects,
        askPrice: listing.price,
      });
    } catch (err) {
      errors.push({ cardSlug: entry.slug, stage: "signal", error: (err as Error).message });
      return;
    }

    const { signal, matchedTier } = cardSignal;
    rows.push({
      card_slug: entry.slug,
      card_name: metadata.name,
      set_name: metadata.setName,
      image_url: metadata.image ?? "",
      signal: signal.tier,
      // deltaPercent + median (the reference) are null on UNKNOWN by construction.
      delta_pct: signal.deltaPercent,
      sold_reference: signal.median,
      sold_sample_size: signal.sampleSize,
      matched_tier: matchedTier,
      computed_at: computedAt,
    });
  });

  const belowCount = rows.filter((r) => r.signal === "BELOW").length;

  let written = 0;
  if (rows.length > 0) {
    const res = await input.upsertRows(rows);
    if (res.error) {
      errors.push({ cardSlug: "(batch)", stage: "upsert", error: res.error });
    } else {
      written = rows.length;
    }
  }

  return {
    cardsConsidered: entries.length,
    browseCalls,
    listingsFound,
    belowCount,
    written,
    errors,
    capHit,
  };
}
