// eBay Browse API client. See ADR-021 Session 21 amendment + ADR-023.
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

import { buildAffiliateUrl } from "./epn.ts";
import type {
  EpnBestListing,
  EpnProductHit,
  EpnSearchResult,
  GetBestListingInput,
} from "./epn.ts";
import { getAccessToken } from "./ebay-oauth.ts";

const BROWSE_SEARCH_ENDPOINT = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const MARKETPLACE_ID = "EBAY_US";

export type SearchItemsInput = {
  query: string;
  limit?: number;
  /** Test injection — passed through to OAuth + Browse fetch calls. */
  fetchImpl?: typeof fetch;
};

/**
 * Browse API item_summary/search. Returns `ok:false` for any failure path
 * (missing creds / auth failure / 4xx / 5xx / network / bad JSON) so
 * callers can soft-fail. Never throws.
 *
 * The OAuth access token is fetched lazily and cached in-memory by
 * lib/affiliate/ebay-oauth.ts.
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
    return { ok: false, error: `fetch_failed: ${(err as Error).message}` };
  }

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

/**
 * Convenience: search Browse for a card, pick the lowest-priced listing,
 * and return the affiliate-wrapped link via lib/affiliate/epn.ts's
 * buildAffiliateUrl (single source of truth for affiliate URL shape).
 * Returns `null` on any failure — page renders the fallback CTA.
 */
export async function getBestListing(input: GetBestListingInput): Promise<EpnBestListing | null> {
  const query = [input.cardName, input.setName].filter(Boolean).join(" ").trim();
  if (!query) return null;

  const result = await searchItems({
    query,
    limit: 25,
    fetchImpl: input.fetchImpl,
  });
  if (!result.ok || result.hits.length === 0) return null;

  let best = result.hits[0];
  for (const hit of result.hits.slice(1)) {
    if (hit.price < best.price) best = hit;
  }

  const customId = input.customId ?? "foil-card-page";
  return {
    title: best.title,
    image: best.image,
    price: best.price,
    currency: best.currency,
    affiliateUrl: buildAffiliateUrl(best.itemUrl, customId),
  };
}
