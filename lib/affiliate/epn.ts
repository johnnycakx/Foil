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

import { postError } from "../notifications/discord.ts";

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
  /** eBay RESTful item id (e.g. "v1|123456789|0") — for a getItem aspect fetch
   *  (ADR-057). Optional/back-compat; absent when the source didn't supply it. */
  itemId?: string;
  image: string | null;
  price: number;
  currency: string;
};

export type EpnBestListing = {
  title: string;
  /** eBay RESTful item id of the chosen listing — for the like-for-like aspect
   *  read (ADR-057). May be absent on legacy/soft-fail paths. */
  itemId?: string;
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

// --- Missing-campaign-id LOUD alarm (content-trust-hotfix Defect 4) ---
//
// A missing EBAY_CAMPAIGN_ID means every affiliate link ships UNWRAPPED — a
// SILENT 100% attribution loss (it bit the 2026-06-28 digest). We keep the
// soft-fail (navigation must never break), but the failure is no longer silent:
// the first occurrence per process pings #errors so a prod mis-config surfaces
// immediately instead of leaking clicks for days. Guarded to production so
// dev/test/CI don't spam. Latched once-per-process (buildAffiliateUrl is a hot
// pure function — a per-call ping would flood). Mirrors the in-process dedup in
// components/cards/sold-history-panel.tsx::pingSuppression.

let campaignIdAlerted = false;

/** Reset the once-per-process alarm latch. Tests only. */
export function __resetCampaignIdAlertForTest(): void {
  campaignIdAlerted = false;
}

export type CampaignIdAlertDeps = {
  /** #errors webhook URL, or undefined when unset. */
  webhook: string | undefined;
  /** True in the production runtime (where a missing campid actually leaks). */
  isProd: boolean;
  /** Fire the alert (injected so the decision is unit-testable without network). */
  notify: (webhook: string) => void;
};

/**
 * Pure decision + latch for the missing-campaign-id alarm. Fires `notify` at
 * most once per process, only in production, only when a webhook is configured.
 * Returns whether it fired (for tests). Side-effect-free besides the latch.
 */
export function alertMissingCampaignId(deps: CampaignIdAlertDeps): boolean {
  if (campaignIdAlerted) return false;
  if (!deps.isProd || !deps.webhook) return false;
  campaignIdAlerted = true; // latch on the first eligible occurrence, send or not
  deps.notify(deps.webhook);
  return true;
}

/** Default wiring: read env, post to #errors via the shared notifications lib. */
function fireCampaignIdAlert(): void {
  alertMissingCampaignId({
    webhook: process.env.DISCORD_WEBHOOK_ERRORS,
    isProd: process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL),
    notify: (webhook) =>
      void postError(webhook, {
        source: "affiliate",
        errorType: "ebay-campaign-id-missing",
        message:
          "EBAY_CAMPAIGN_ID is unset — affiliate links are shipping UNWRAPPED (100% attribution loss). Set it in the Vercel production env.",
      }).catch(() => {}),
  });
}

/**
 * Append EPN affiliate tracking params to an eBay URL. The function is pure —
 * no network call. Always includes `campid` (the campaign id env var) and the
 * `customid` argument so per-page attribution is preserved end-to-end.
 *
 * If `EBAY_CAMPAIGN_ID` is missing, the URL is returned UNWRAPPED — soft-fail
 * preserves user navigation at the cost of affiliate attribution rather than
 * silently breaking page renders. The miss is no longer silent: in production
 * the first occurrence per process pings #errors (see fireCampaignIdAlert).
 */
export function buildAffiliateUrl(itemUrl: string, customId: string): string {
  if (!itemUrl) return itemUrl;
  const campId = process.env.EBAY_CAMPAIGN_ID;
  if (!campId) {
    fireCampaignIdAlert();
    return itemUrl;
  }

  const target = new URL(itemUrl);
  for (const [k, v] of Object.entries(EPN_TRACKING_PARAMS)) {
    target.searchParams.set(k, v);
  }
  target.searchParams.set("campid", campId);
  // Never emit an EMPTY customid — that is exactly the "No Custom ID" leak
  // class (a campid-bearing click with no sub-tag). A blank/whitespace
  // customId falls back to a VISIBLE sentinel so any future mis-wiring shows
  // up as `foil-untagged` in the EPN report (greppable, attributable) instead
  // of untraceable "No Custom ID". (ROADMAP #32.3 follow-up.)
  const safeCustomId = customId && customId.trim() ? customId.trim() : CUSTOMID_FALLBACK;
  target.searchParams.set("customid", safeCustomId);
  return target.toString();
}

// --- customid taxonomy (per-card + per-tier + per-creator attribution) ---
//
// eBay's customid is "up to 256 alphanumeric characters" (EPN docs). We use a
// HYPHEN-delimited scheme because hyphens are the only punctuation EMPIRICALLY
// proven to survive eBay's handling — the working `foil-card-page` clicks
// attributed correctly, while underscores are unverified, so we avoid them.
// Format: `<tier>-<slug>` + optional `-s-<src>` (creator/campaign tag).

export const CUSTOMID_MAX_LENGTH = 256;
/** Visible fallback so an empty customid never silently becomes "No Custom ID". */
export const CUSTOMID_FALLBACK = "foil-untagged";

export type CustomIdTier = "curated" | "longtail" | "metadata-only" | "wishlist" | "deals";
const TIER_CODE: Record<CustomIdTier, string> = {
  curated: "cp",
  longtail: "lt",
  "metadata-only": "mo",
  wishlist: "wl",
  deals: "dl",
};

/** Reduce to the proven-safe customid charset. `allowHyphen` keeps the
 *  hyphen delimiter for slugs; creator/src tags strip to [a-z0-9] so the
 *  `-s-` delimiter stays unambiguous and untrusted URL input can't pollute it. */
function sanitizeSegment(s: string, allowHyphen: boolean): string {
  const stripped = s.toLowerCase().replace(allowHyphen ? /[^a-z0-9-]+/g : /[^a-z0-9]+/g, allowHyphen ? "-" : "");
  return stripped.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Build a per-surface EPN customid. `src` (a creator/campaign tag, typically
 * from a `?src=` URL param) is UNTRUSTED and sanitized to [a-z0-9]. The result
 * is capped under eBay's 256-char limit and is never empty.
 */
export function buildCustomId(input: { tier: CustomIdTier; slug: string; src?: string | null }): string {
  const slug = sanitizeSegment(input.slug ?? "", true);
  const base = slug ? `${TIER_CODE[input.tier]}-${slug}` : TIER_CODE[input.tier];
  const src = input.src ? sanitizeSegment(input.src, false) : "";
  const full = (src ? `${base}-s-${src}` : base).slice(0, CUSTOMID_MAX_LENGTH);
  return full || CUSTOMID_FALLBACK;
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

/**
 * True if `url` carries the EPN affiliate campaign param — i.e. it was wrapped
 * (not the soft-fail unwrapped fallback). Lives HERE so the param-name knowledge
 * stays inside this single boundary module; callers (e.g. the newsletter digest
 * quality gate, ADR-077) ask "is this tracked?" without re-encoding the param.
 */
export function isAffiliateWrapped(url: string): boolean {
  // Decode the HTML ampersand entity first: react-email (and any HTML serializer)
  // emits hrefs as `…&amp;campid=…`, which would otherwise parse as a param named
  // "amp;campid". Plain markdown hrefs use a raw `&`; both must validate.
  return new URL(url.replace(/&amp;/g, "&")).searchParams.has("campid");
}

export type GetBestListingInput = {
  cardName: string;
  setName?: string;
  /** Custom-id suffix for affiliate attribution. */
  customId?: string;
  /** Test injection. */
  fetchImpl?: typeof fetch;
  /** Telemetry tag — which call site initiated this Browse call. The
   *  Browse client logs every call to browse_calls keyed on this; see
   *  ADR-025. Consumed by lib/affiliate/ebay-browse.ts; EPN ignores it. */
  surface?: "page_render" | "wishlist_cron" | "deals_cron" | "deals_redirect" | "manual";
  /** Watchlist variant token (PoketraceVariant.variantKey or "default").
   *  Biases the Browse query + gates listing titles per Session 49b /
   *  ADR-043. Consumed by lib/affiliate/ebay-browse.ts; EPN ignores it. */
  variant?: string;
  /** Watchlist condition token (lib/cards/conditions.ts). Same handling as
   *  `variant`. Consumed by lib/affiliate/ebay-browse.ts; EPN ignores it. */
  condition?: string;
  /** AWAIT the Browse telemetry insert before returning (cron callers set true
   *  so it flushes before the function suspends). Consumed by ebay-browse.ts. */
  awaitLog?: boolean;
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
