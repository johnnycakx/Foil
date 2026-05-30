// eBay Browse API client. See ADR-021 Session 21 amendment + ADR-023 +
// ADR-025 (telemetry instrumentation).
//
// Replaces lib/affiliate/epn.ts::getBestListing as the V1 live-listing
// source once the production keyset enabled (Session 25 webhook → Session
// 26 swap). Mirrors EPN's exported shape exactly (EpnProductHit,
// EpnBestListing, EpnSearchResult, GetBestListingInput) so callers don't
// change.
//
// Architectural rules carried forward from ADR-021 unchanged:
//   1. Server-side fetch only, render-time, `cache: "no-store"` per R-008.
//   2. Soft-fail. Auth failures, rate limits, 5xx, network → return null
//      from getBestListing and let the page render the fallback CTA.
//   3. Affiliate URL construction stays in lib/affiliate/epn.ts —
//      buildAffiliateUrl is the single source of truth for `mkevt`/
//      `campid`/`customid` param assembly. This module imports it.
//
// Telemetry rule (ADR-025): every Browse call — success OR failure —
// fires a fire-and-forget logBrowseCall with the caller-supplied
// `surface` tag. Logging never throws, never awaits the caller, never
// affects the response. The payload is operational metadata only
// (surface + success + latency_ms) — no listing fields persist.

import { buildAffiliateUrl } from "./epn.ts";
import type {
  EpnBestListing,
  EpnProductHit,
  EpnSearchResult,
  GetBestListingInput,
} from "./epn.ts";
import { getAccessToken } from "./ebay-oauth.ts";
import { pickBestListing } from "./listing-picker.ts";
import { logBrowseCall, type BrowseSurface } from "../telemetry/browse-calls.ts";
import { variantEbayKeywords } from "../poketrace/variant.ts";
import { ebayKeywordsForCondition, conditionRelaxesJunkGate } from "../cards/conditions.ts";

const BROWSE_SEARCH_ENDPOINT = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const MARKETPLACE_ID = "EBAY_US";

export type SearchItemsInput = {
  query: string;
  limit?: number;
  /** Test injection — passed through to OAuth + Browse fetch calls. */
  fetchImpl?: typeof fetch;
  /** Telemetry tag — see ADR-025. Defaults to "manual" so an
   *  un-instrumented caller still produces a useful telemetry row. */
  surface?: BrowseSurface;
  /** Test injection — override logBrowseCall so we can pin the call
   *  shape without writing to Supabase. */
  logImpl?: typeof logBrowseCall;
};

/**
 * Browse API item_summary/search. Returns `ok:false` for any failure path
 * (missing creds / auth failure / 4xx / 5xx / network / bad JSON) so
 * callers can soft-fail. Never throws.
 *
 * The OAuth access token is fetched lazily and cached in-memory by
 * lib/affiliate/ebay-oauth.ts.
 *
 * Telemetry: every invocation that reaches the fetch attempt records one
 * row in browse_calls with (surface, success, latency_ms). Empty-query
 * short-circuit + missing-OAuth path DON'T log — those are not "Browse
 * calls" against eBay's quota.
 */
export async function searchItems(input: SearchItemsInput): Promise<EpnSearchResult> {
  if (!input.query?.trim()) {
    return { ok: false, error: "empty_query" };
  }

  const accessToken = await getAccessToken({ fetchImpl: input.fetchImpl });
  if (!accessToken) {
    return { ok: false, error: "missing_or_failed_oauth" };
  }

  const limit = Math.max(1, Math.min(input.limit ?? 25, 50));
  const url =
    `${BROWSE_SEARCH_ENDPOINT}?q=${encodeURIComponent(input.query)}&limit=${limit}`;

  const surface: BrowseSurface = input.surface ?? "manual";
  const log = input.logImpl ?? logBrowseCall;
  const startedAt = Date.now();

  const fetchFn = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        Accept: "application/json",
        "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE_ID,
      },
      // R-008: never cache listing payloads at the platform layer.
      cache: "no-store",
    });
  } catch (err) {
    // Fire-and-forget — never await on the hot path. The .catch keeps an
    // unhandled rejection from escaping.
    void log({ surface, success: false, latency_ms: Date.now() - startedAt }).catch(() => {});
    return { ok: false, error: `fetch_failed: ${(err as Error).message}` };
  }

  const latencyMs = Date.now() - startedAt;
  const httpSuccess = response.ok;
  void log({ surface, success: httpSuccess, latency_ms: latencyMs }).catch(() => {});

  if (!response.ok) {
    return { ok: false, status: response.status, error: `http_${response.status}` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    return { ok: false, status: response.status, error: `bad_json: ${(err as Error).message}` };
  }

  const hits = parseItemSummaries(body);
  return { ok: true, hits };
}

type RawItemSummary = {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  image?: { imageUrl?: string } | null;
  price?: { value?: number | string; currency?: string };
};

/**
 * Parse Browse API item_summary/search response into EpnProductHit shape.
 * Empirically verified against api.ebay.com on 2026-05-24:
 *   - price.value is a STRING (e.g. "41.69"), not a number
 *   - image.imageUrl is the image source
 *   - itemWebUrl is the canonical /itm/<id> URL (what we wrap with affiliate)
 */
function parseItemSummaries(body: unknown): EpnProductHit[] {
  if (!body || typeof body !== "object") return [];
  const items = (body as { itemSummaries?: RawItemSummary[] }).itemSummaries;
  if (!Array.isArray(items)) return [];

  const out: EpnProductHit[] = [];
  for (const raw of items) {
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const itemUrl = typeof raw.itemWebUrl === "string" ? raw.itemWebUrl : "";
    if (!title || !itemUrl) continue;

    const image =
      raw.image && typeof raw.image === "object" && typeof raw.image.imageUrl === "string"
        ? raw.image.imageUrl
        : null;

    let price: number | null = null;
    let currency = "USD";
    if (raw.price && typeof raw.price === "object") {
      const v = raw.price.value;
      price = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : null;
      if (typeof raw.price.currency === "string") currency = raw.price.currency;
    }
    if (price === null || Number.isNaN(price) || price <= 0) continue;

    out.push({ title, itemUrl, image, price, currency });
  }
  return out;
}

export type BuildEbayQueryInput = {
  cardName: string;
  setName?: string;
  /** Watchlist variant token (variantKey or "default"). */
  variant?: string;
  /** Watchlist condition token (lib/cards/conditions.ts). */
  condition?: string;
};

export type BuiltEbayQuery = {
  /** The `q` string for the Browse search — card name + set + quoted include
   *  phrases that bias eBay toward the targeted printing/condition. */
  query: string;
  /** Merged include keywords for the picker's title gate (≥1 must appear). */
  include: string[];
  /** Merged exclude keywords for the picker's title gate (none may appear). */
  exclude: string[];
};

/**
 * Build the Browse search query + the variant/condition keyword sets for the
 * picker gate (Session 49b / ADR-043).
 *
 * The include phrases are appended (quoted) to the `q` string so eBay biases
 * toward the targeted printing/condition; the exclude keywords are NOT put in
 * `q` — they're enforced post-fetch by the picker's title gate, which is
 * authoritative and avoids relying on eBay `q` negation semantics we haven't
 * verified against the docs. An un-targeted call (no variant/condition, or
 * variant="default"/condition omitted) returns just the bare card query with
 * empty keyword sets, so the page-render path is unchanged.
 */
export function buildEbayQuery(input: BuildEbayQueryInput): BuiltEbayQuery {
  const base = [input.cardName, input.setName].filter(Boolean).join(" ").trim();

  const vk = variantEbayKeywords(input.variant);
  const ck = ebayKeywordsForCondition(input.condition);

  const include = [...new Set([...vk.include, ...ck.include])];
  const exclude = [...new Set([...vk.exclude, ...ck.exclude])];

  // Append include phrases (quoted) to bias the search. Skip excludes here —
  // the picker gate enforces them.
  const query = include.length > 0 ? `${base} ${include.map((k) => `"${k}"`).join(" ")}`.trim() : base;

  return { query, include, exclude };
}

/**
 * Convenience: search Browse for a card, pick the cheapest credible
 * listing via `pickBestListing` (see ADR-026), and return the affiliate-
 * wrapped link via lib/affiliate/epn.ts's `buildAffiliateUrl` (single
 * source of truth for affiliate URL shape).
 *
 * Returns `null` on any failure — empty hits, all-hits-filtered-as-junk,
 * search-API failure — and the consuming page renders the sponsored
 * search-result CTA per the existing soft-fail pattern.
 *
 * Selection rule (Session 36): the previous lowest-price-wins selector
 * shipped a product bug — surfaced $1.75 keyword-stuffed listings instead
 * of $40-80 credible listings. `pickBestListing` rejects keyword-stuffed,
 * damaged, lot, and outlier-priced hits before taking the cheapest
 * survivor.
 *
 * Telemetry: forwards `surface` to searchItems so the underlying Browse
 * call lands in browse_calls with the call-site tag.
 */
export async function getBestListing(input: GetBestListingInput): Promise<EpnBestListing | null> {
  const { query, include, exclude } = buildEbayQuery({
    cardName: input.cardName,
    setName: input.setName,
    variant: input.variant,
    condition: input.condition,
  });
  if (!query) return null;

  const result = await searchItems({
    query,
    limit: 25,
    fetchImpl: input.fetchImpl,
    surface: input.surface,
  });
  if (!result.ok || result.hits.length === 0) return null;

  const best: EpnProductHit | null = pickBestListing(result.hits, {
    include,
    exclude,
    // A "Damaged"/"Heavily Played" target would otherwise be filtered out by
    // the picker's condition-junk gate (ADR-026) — relax it when the buyer
    // explicitly asked for a played/damaged condition.
    skipConditionJunk: conditionRelaxesJunkGate(input.condition),
  });
  if (!best) return null;

  const customId = input.customId ?? "foil-card-page";
  return {
    title: best.title,
    image: best.image,
    price: best.price,
    currency: best.currency,
    affiliateUrl: buildAffiliateUrl(best.itemUrl, customId),
  };
}
