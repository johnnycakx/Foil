// eBay Partner Network (EPN) — V1 live-listing source for /cards/[slug]
// landing pages. See ADR-021.
//
// Two architectural rules this module enforces:
//   1. Server-side fetch only, render-time, `cache: "no-store"`. The 2025 eBay
//      License Agreement update treats stored listing data as a re-distribution
//      vector; we never persist or cache it. See [R-008](../../docs/RISKS.md).
//   2. Soft-fail. EPN downtime / rate limits / auth misconfig must NEVER 500 a
//      per-card landing page. Every failure path returns `null`; the page
//      degrades to a "browse on eBay" CTA via `affiliateSearchUrl()`.
//
// Single import boundary: this is the ONLY module in the repo allowed to hit
// EPN endpoints or construct affiliate URLs from raw `mkevt`/`campid` params.
// If `api.partner.ebay.com` or those param names appear anywhere except here +
// `.env.local` + `docs/ENV-VARS.md`, that's the regression.

const EPN_PRODUCTS_ENDPOINT_BASE = "https://api.partner.ebay.com/v1";
const EPN_SMART_LINK_BASE = "https://www.ebay.com/itm/";
const EPN_SEARCH_URL_BASE = "https://www.ebay.com/sch/i.html";
// EPN smart-link tracking params per eBay's documented affiliate URL format.
// `mkrid` is a fixed referrer-id for US affiliate traffic; `toolid` 10001
// identifies API-generated links.
const EPN_TRACKING_PARAMS = {
  mkevt: "1",
  mkcid: "1",
  mkrid: "711-53200-19255-0",
  toolid: "10001",
} as const;

export type EpnProductHit = {
  title: string;
  /** Canonical eBay item URL (no affiliate params yet). */
  itemUrl: string;
  image: string | null;
  price: number;
  currency: string;
};

export type EpnBestListing = {
  title: string;
  image: string | null;
  price: number;
  currency: string;
  /** Affiliate-wrapped eBay URL — always includes campid + customid. */
  affiliateUrl: string;
};

export type EpnSearchInput = {
  query: string;
  limit?: number;
  /** Test injection. */
  fetchImpl?: typeof fetch;
};

export type EpnSearchResult =
  | { ok: true; hits: EpnProductHit[] }
  | { ok: false; status?: number; error: string };

/**
 * Search EPN's Products surface for matching live listings. Returns `ok:false`
 * for any failure path so callers can soft-fail. Never throws.
 *
 * The endpoint embeds the EPN AccountSID in the URL path (per EPN's account-
 * scoped routing); the auth token rides as Bearer.
 */
export async function searchProducts(input: EpnSearchInput): Promise<EpnSearchResult> {
  const accountSid = process.env.EBAY_EPN_ACCOUNT_SID;
  const authToken = process.env.EBAY_EPN_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return { ok: false, error: "missing_epn_credentials" };
  }
  if (!input.query?.trim()) {
    return { ok: false, error: "empty_query" };
  }

  const limit = Math.max(1, Math.min(input.limit ?? 25, 50));
  const url =
    `${EPN_PRODUCTS_ENDPOINT_BASE}/${encodeURIComponent(accountSid)}/products` +
    `?q=${encodeURIComponent(input.query)}&limit=${limit}`;

  const fetchFn = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: "application/json",
      },
      // The 2025 License Agreement explicitly forbids caching listing payloads.
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

  const hits = parseProductHits(body);
  return { ok: true, hits };
}

type RawProduct = {
  title?: string;
  itemUrl?: string;
  url?: string;
  image?: string | { url?: string } | null;
  imageUrl?: string;
  price?: { value?: number | string; currency?: string } | number | string;
  currency?: string;
};

function parseProductHits(body: unknown): EpnProductHit[] {
  if (!body || typeof body !== "object") return [];
  const items = (body as { products?: RawProduct[]; items?: RawProduct[] }).products
    ?? (body as { items?: RawProduct[] }).items
    ?? [];
  if (!Array.isArray(items)) return [];

  const out: EpnProductHit[] = [];
  for (const raw of items) {
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const itemUrl = typeof raw.itemUrl === "string" ? raw.itemUrl
      : typeof raw.url === "string" ? raw.url
      : "";
    if (!title || !itemUrl) continue;

    let image: string | null = null;
    if (typeof raw.image === "string") image = raw.image;
    else if (raw.image && typeof raw.image === "object" && typeof raw.image.url === "string") image = raw.image.url;
    else if (typeof raw.imageUrl === "string") image = raw.imageUrl;

    let price: number | null = null;
    let currency = "USD";
    if (typeof raw.price === "number") price = raw.price;
    else if (typeof raw.price === "string") price = parseFloat(raw.price);
    else if (raw.price && typeof raw.price === "object") {
      const v = raw.price.value;
      price = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : null;
      if (typeof raw.price.currency === "string") currency = raw.price.currency;
    }
    if (typeof raw.currency === "string") currency = raw.currency;

    if (price === null || Number.isNaN(price) || price <= 0) continue;
    out.push({ title, itemUrl, image, price, currency });
  }
  return out;
}

/**
 * Append EPN affiliate tracking params to an eBay URL. The function is pure —
 * no network call. Always includes `campid` (the campaign id env var) and the
 * `customid` argument so per-page attribution is preserved end-to-end.
 *
 * If `EBAY_CAMPAIGN_ID` is missing, the URL is returned UNWRAPPED — soft-fail
 * preserves user navigation at the cost of affiliate attribution rather than
 * silently breaking page renders.
 */
export function buildAffiliateUrl(itemUrl: string, customId: string): string {
  if (!itemUrl) return itemUrl;
  const campId = process.env.EBAY_CAMPAIGN_ID;
  if (!campId) return itemUrl;

  const target = new URL(itemUrl);
  for (const [k, v] of Object.entries(EPN_TRACKING_PARAMS)) {
    target.searchParams.set(k, v);
  }
  target.searchParams.set("campid", campId);
  target.searchParams.set("customid", customId);
  return target.toString();
}

/**
 * Build an affiliate-wrapped eBay search URL — the fallback the per-card page
 * uses when `getBestListing` returns null (EPN unavailable / no matches /
 * misconfigured). Always navigable; affiliate attribution still flows.
 */
export function affiliateSearchUrl(query: string, customId: string): string {
  const url = new URL(EPN_SEARCH_URL_BASE);
  url.searchParams.set("_nkw", query);
  return buildAffiliateUrl(url.toString(), customId);
}

export type GetBestListingInput = {
  cardName: string;
  setName?: string;
  /** Custom-id suffix for affiliate attribution. */
  customId?: string;
  /** Test injection. */
  fetchImpl?: typeof fetch;
};

/**
 * Convenience: search EPN for a card, pick the lowest-priced listing, and
 * return the affiliate-wrapped link. Returns `null` on any failure — the page
 * is expected to render a fallback CTA in that case (`affiliateSearchUrl`).
 */
export async function getBestListing(input: GetBestListingInput): Promise<EpnBestListing | null> {
  const query = [input.cardName, input.setName].filter(Boolean).join(" ").trim();
  if (!query) return null;

  const result = await searchProducts({
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
