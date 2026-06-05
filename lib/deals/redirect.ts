// Click-time deal redirect resolver (ROADMAP B.4 follow-up / ADR-056).
//
// The /deals board renders from the precomputed cache and must make NO eBay
// call per view (R-008 + R-012). But a card-name SEARCH link converts worse
// than landing the buyer on the actual best listing. So the "See it on eBay"
// button points at /go/deal/[slug], and THIS resolver runs a LIVE getBestListing
// at CLICK time and returns the specific item's affiliate URL — one Browse call
// per click (bounded by clicks, not views), nothing persisted.
//
// Security: the slug is validated against the known catalog; the destination is
// ALWAYS an internally-built eBay affiliate URL (a specific item via
// buildAffiliateUrl, or the affiliate SEARCH url) — NEVER a user-supplied URL.
// No open-redirect surface.

import { getCatalogEntry } from "../cards/catalog.ts";
import { affiliateSearchUrl, buildCustomId, type EpnBestListing, type GetBestListingInput } from "../affiliate/epn.ts";
import type { CardMetadata } from "../cards/sdk.ts";

export type ResolveDealInput = {
  slug: string;
  getCardMetadata: (i: { id: string }) => Promise<CardMetadata>;
  getBestListing: (i: GetBestListingInput) => Promise<EpnBestListing | null>;
};

export type DealDestination =
  | { ok: true; url: string; kind: "item" | "search" }
  | { ok: false; reason: "unknown_slug" };

/** Human card-name guess from a slug's `<set>-<num>-<kebab-name>` tail — the
 *  last-resort search query when catalog metadata can't be fetched. */
function nameFromSlug(slug: string): string {
  return slug.split("-").slice(2).join(" ").trim();
}

/**
 * Resolve where a /deals "See it on eBay" click should land:
 *   - unknown slug              → { ok:false } (caller sends to an internal page)
 *   - live best listing found   → that specific item's affiliate URL (kind:item)
 *   - no confident listing      → affiliate SEARCH url for the card (kind:search)
 *
 * The customid is the leaderboard-distinct `deals` tier code (dl-<slug>) so EPN
 * segments leaderboard revenue from card-page revenue. Soft-fails to the search
 * url on any Browse/metadata error — the click always lands somewhere useful.
 */
export async function resolveDealDestination(input: ResolveDealInput): Promise<DealDestination> {
  const entry = getCatalogEntry(input.slug);
  if (!entry) return { ok: false, reason: "unknown_slug" };

  const customId = buildCustomId({ tier: "deals", slug: input.slug });

  let meta: CardMetadata | null = null;
  try {
    meta = await input.getCardMetadata({ id: entry.pokemonTcgId });
  } catch {
    meta = null;
  }

  // Without metadata we can't run a precise Browse query — fall back to a
  // best-effort search from the slug name. Still an internally-built eBay URL.
  if (!meta) {
    return { ok: true, url: affiliateSearchUrl(nameFromSlug(input.slug), customId), kind: "search" };
  }

  const query = `${meta.name} ${meta.setName}`.trim();

  let best: EpnBestListing | null = null;
  try {
    best = await input.getBestListing({
      cardName: meta.name,
      setName: meta.setName,
      customId,
      surface: "deals_redirect",
    });
  } catch {
    best = null;
  }

  if (best?.affiliateUrl) {
    return { ok: true, url: best.affiliateUrl, kind: "item" };
  }
  return { ok: true, url: affiliateSearchUrl(query, customId), kind: "search" };
}
