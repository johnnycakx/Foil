// Click-time deal redirect resolver (ROADMAP B.4 follow-up / ADR-056; migrated
// onto the VERIFIED resolver — DESIGN-VERIFIED-LISTING-RESOLVER.md §5, Tranche
// A #3).
//
// The /deals board renders from the precomputed cache and must make NO eBay
// call per view (R-008 + R-012). But a card-name SEARCH link converts worse
// than landing the buyer on the actual best listing. So the "See it on eBay"
// button points at /go/deal/[slug], and THIS resolver runs a LIVE
// resolveVerifiedListing at CLICK time and 302s to the VERIFIED item's
// affiliate URL — identity-checked against the listing's own item specifics
// (set, number, language, raw-vs-graded), never the title-picked cheapest. On
// an honest null (no listing passed verification) the click falls back to the
// affiliate SEARCH url. A few Browse calls per click (1 search + ≤k getItem,
// bounded by clicks, not views), nothing persisted.
//
// Security: the slug is validated against the known catalog; the destination is
// ALWAYS an internally-built eBay affiliate URL (a verified item via the
// resolver's internal buildAffiliateUrl, or the affiliate SEARCH url) — NEVER a
// user-supplied URL. No open-redirect surface.

import { getCatalogEntry } from "../cards/catalog.ts";
import { affiliateSearchUrl, buildCustomId } from "../affiliate/epn.ts";
import type { CardMetadata } from "../cards/sdk.ts";
import type { BrowseSurface } from "../telemetry/browse-calls.ts";
import type { ResolveCondition, ResolveOpts, VerifiedListing } from "../listing/resolve.ts";

export type ResolveListingFn = (
  cardId: string,
  condition: ResolveCondition,
  opts?: ResolveOpts & { surface?: BrowseSurface },
) => Promise<VerifiedListing | null>;

export type ResolveDealInput = {
  slug: string;
  getCardMetadata: (i: { id: string }) => Promise<CardMetadata>;
  /** The verified resolver (resolveVerifiedListing) — injected for tests. */
  resolveListing: ResolveListingFn;
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
 *   - unknown slug               → { ok:false } (caller sends to an internal page)
 *   - VERIFIED listing resolved  → that item's affiliate URL (kind:item)
 *   - honest null / any error    → affiliate SEARCH url for the card (kind:search)
 *
 * Never an unverified item: the resolver's identity gates are the only path to
 * kind:item. The customid is the leaderboard-distinct `deals` tier code
 * (dl-<slug>) so EPN segments leaderboard revenue from card-page revenue.
 * Soft-fails to the search url on any Browse/metadata error — the click always
 * lands somewhere useful.
 */
export async function resolveDealDestination(input: ResolveDealInput): Promise<DealDestination> {
  const entry = getCatalogEntry(input.slug);
  if (!entry) return { ok: false, reason: "unknown_slug" };

  const customId = buildCustomId({ tier: "deals", slug: input.slug });

  let listing: VerifiedListing | null = null;
  try {
    listing = await input.resolveListing(input.slug, "ANY_RAW", {
      customId,
      surface: "deals_redirect",
    });
  } catch {
    listing = null;
  }

  if (listing?.affiliateUrl) {
    return { ok: true, url: listing.affiliateUrl, kind: "item" };
  }

  // Honest null → affiliate SEARCH. Metadata only feeds the search query;
  // soft-fail to a slug-derived name. Still an internally-built eBay URL.
  let meta: CardMetadata | null = null;
  try {
    meta = await input.getCardMetadata({ id: entry.pokemonTcgId });
  } catch {
    meta = null;
  }
  const query = meta ? `${meta.name} ${meta.setName}`.trim() : nameFromSlug(input.slug);
  return { ok: true, url: affiliateSearchUrl(query, customId), kind: "search" };
}
