// Verified-listing resolver — the single boundary every consumer will call.
// DESIGN-VERIFIED-LISTING-RESOLVER.md §2. Tranche A step #1: SHIPS DARK (no
// consumer wired this goal — the per-card page, /go redirect, wishlist cron, and
// deals cron are untouched). Goals #2/#3 migrate the consumers onto this.
//
// resolveVerifiedListing(cardId, condition) returns a fully IDENTITY-VERIFIED
// listing or an honest null. NULL BEATS UNVERIFIED-CHEAPEST, ALWAYS. Title
// parsing PRE-FILTERS candidates (a cost optimizer that ranks + narrows) but the
// aspect check in lib/listing/identity.ts is the ONLY admission gate.
//
// Pipeline (one path, replacing the old picker/classifier split):
//   1. identity target from catalog + SDK metadata
//   2. ONE eBay search
//   3. title pre-filter (the demoted picker gates) → rank cheapest-first
//   4. verify the top-k cheapest (k=4) via getItem identity gates, until one
//      passes ALL hard gates → return it; else null
//
// R-008: reads listing data at compute time (cache:"no-store" in the deps),
// classifies, discards. Nothing persisted. The trace carries DERIVED gate
// decisions only (no listing payload).

import type { CardMetadata } from "../cards/sdk.ts";
import type { CatalogEntry } from "../cards/catalog.ts";
import type { EpnProductHit, EpnSearchResult } from "../affiliate/epn.ts";
import { buildAffiliateUrl } from "../affiliate/epn.ts";
import type { BrowseSurface } from "../telemetry/browse-calls.ts";
import { rejectPriceOutliers, rejectTitleJunk, rejectConditionJunk } from "../affiliate/listing-picker.ts";
import type { ListingConditionTier } from "../buy-signal/condition-infer.ts";
import { verifyIdentity, type ResolveCondition, type IdentityTarget, type GateDecision } from "./identity.ts";

export type { ResolveCondition } from "./identity.ts";

/** k cap (John, 2026-06-06): verify at most the 4 cheapest credible candidates. */
export const RESOLVE_K = 4;

export type VerifiedListing = {
  itemId: string;
  /** Internally-built affiliate URL (never user-supplied). */
  affiliateUrl: string;
  price: number;
  currency: string;
  /** Display only — NOT the verification basis. */
  title: string;
  /** Derived from aspects/title, not the raw title. */
  condition: ListingConditionTier;
  verifiedAspects: { set: string | null; number: string | null; finish: string | null; language: string | null; graded: boolean };
};

export type CandidateTrace = {
  itemId: string;
  price: number;
  rank: number;
  gates: GateDecision[];
  verdict: "verified" | "rejected" | "detail_failed" | "no_item_id";
  reason: string;
};

/** Gate-decision + presence telemetry for one resolve. DERIVED only (R-008). */
export type ResolveTrace = {
  cardId: string;
  condition: string;
  searchOk: boolean;
  searchHitCount: number;
  prefilteredCount: number;
  candidatesEvaluated: number;
  candidates: CandidateTrace[];
  result: "verified" | "null";
  reason: string;
};

export type ListingDetail = { aspects: Record<string, string>; topCondition: string | null };

export type ResolveDeps = {
  getCatalogEntry: (slug: string) => CatalogEntry | undefined;
  getCardMetadata: (input: { id: string }) => Promise<CardMetadata>;
  search: (input: { query: string; limit?: number; surface?: BrowseSurface }) => Promise<EpnSearchResult>;
  getListingDetail: (input: { itemId: string; surface?: BrowseSurface }) => Promise<ListingDetail | null>;
};

export type ResolveOpts = {
  customId?: string;
  surface?: BrowseSurface;
  /** Pin a specific variant (the page's ?v=) for the Finish gate. */
  requestedVariant?: string;
  /** Override k (tests). */
  k?: number;
  /** Receive the trace (telemetry sink) without unwrapping the traced API. */
  onTrace?: (trace: ResolveTrace) => void;
};

export function conditionLabel(c: ResolveCondition): string {
  return typeof c === "string" ? c : `graded:${c.graded.service} ${c.graded.grade}`;
}

function isPlayedOrGraded(c: ResolveCondition): boolean {
  if (typeof c !== "string") return true; // graded
  return c === "MP" || c === "HP" || c === "DMG";
}

/**
 * Pre-filter (title-only) — NARROWS and RANKS, never admits. Runs the demoted
 * picker gates as a cost optimizer to avoid spending getItem calls on obvious
 * junk, then sorts cheapest-first. Condition-junk is skipped when the target is
 * a played/graded condition (those listings would be wrongly dropped).
 */
export function prefilterCandidates(hits: readonly EpnProductHit[], condition: ResolveCondition): EpnProductHit[] {
  const a = rejectPriceOutliers(hits);
  const b = rejectTitleJunk(a);
  const c = isPlayedOrGraded(condition) ? b : rejectConditionJunk(b);
  return [...c].sort((x, y) => x.price - y.price);
}

/**
 * Resolve a verified listing with injected deps (tests + the calibration sweep
 * inject fakes/live deps of this shape). Returns the listing (or null) AND the
 * trace. The public `resolveVerifiedListing` wraps this with the real deps.
 */
export async function resolveVerifiedListingWith(
  deps: ResolveDeps,
  cardId: string,
  condition: ResolveCondition,
  opts: ResolveOpts = {},
): Promise<{ listing: VerifiedListing | null; trace: ResolveTrace }> {
  const k = opts.k ?? RESOLVE_K;
  const surface = opts.surface ?? "manual";
  const trace: ResolveTrace = {
    cardId,
    condition: conditionLabel(condition),
    searchOk: false,
    searchHitCount: 0,
    prefilteredCount: 0,
    candidatesEvaluated: 0,
    candidates: [],
    result: "null",
    reason: "",
  };
  const done = (listing: VerifiedListing | null, reason: string) => {
    trace.result = listing ? "verified" : "null";
    trace.reason = reason;
    opts.onTrace?.(trace);
    return { listing, trace };
  };

  const entry = deps.getCatalogEntry(cardId);
  if (!entry) return done(null, "unknown cardId");

  let meta: CardMetadata;
  try {
    meta = await deps.getCardMetadata({ id: entry.pokemonTcgId });
  } catch (err) {
    return done(null, `metadata error: ${(err as Error).message}`);
  }

  const target: IdentityTarget = {
    setName: meta.setName,
    setId: meta.setId,
    number: meta.number,
    name: meta.name,
    requestedVariant: opts.requestedVariant,
  };

  const query = `${meta.name} ${meta.setName}`.trim();
  let search: EpnSearchResult;
  try {
    search = await deps.search({ query, limit: 25, surface });
  } catch (err) {
    return done(null, `search error: ${(err as Error).message}`);
  }
  if (!search.ok) return done(null, `search failed: ${search.error}`);
  trace.searchOk = true;
  trace.searchHitCount = search.hits.length;

  const ranked = prefilterCandidates(search.hits, condition);
  trace.prefilteredCount = ranked.length;

  const candidates = ranked.slice(0, k);
  for (let i = 0; i < candidates.length; i++) {
    const hit = candidates[i];
    trace.candidatesEvaluated++;
    if (!hit.itemId) {
      trace.candidates.push({ itemId: "", price: hit.price, rank: i, gates: [], verdict: "no_item_id", reason: "search hit has no itemId" });
      continue;
    }
    let detail: ListingDetail | null;
    try {
      detail = await deps.getListingDetail({ itemId: hit.itemId, surface });
    } catch {
      detail = null;
    }
    if (!detail) {
      trace.candidates.push({ itemId: hit.itemId, price: hit.price, rank: i, gates: [], verdict: "detail_failed", reason: "getItem failed" });
      continue;
    }
    const verdict = verifyIdentity({ target, aspects: detail.aspects, topCondition: detail.topCondition, title: hit.title, condition });
    if (verdict.pass) {
      const listing: VerifiedListing = {
        itemId: hit.itemId,
        affiliateUrl: buildAffiliateUrl(hit.itemUrl, opts.customId ?? "foil-resolver"),
        price: hit.price,
        currency: hit.currency,
        title: hit.title,
        condition: verdict.condition,
        verifiedAspects: verdict.verifiedAspects,
      };
      trace.candidates.push({ itemId: hit.itemId, price: hit.price, rank: i, gates: verdict.gates, verdict: "verified", reason: verdict.reason });
      return done(listing, `verified candidate at rank ${i}`);
    }
    trace.candidates.push({ itemId: hit.itemId, price: hit.price, rank: i, gates: verdict.gates, verdict: "rejected", reason: verdict.reason });
  }

  return done(null, candidates.length === 0 ? "no candidates after pre-filter" : "no candidate passed identity within k");
}

// --- Public entry — wires the real deps (ships dark; no consumer calls it yet) -

/**
 * Resolve the best IDENTITY-VERIFIED live eBay listing for a catalog card in the
 * requested condition, or null. The single boundary the design routes every
 * consumer through (in goals #2/#3). Soft-fail: any infra error → null.
 */
export async function resolveVerifiedListing(
  cardId: string,
  condition: ResolveCondition,
  opts: ResolveOpts = {},
): Promise<VerifiedListing | null> {
  // Lazy imports keep this module's pure pipeline testable without the live
  // eBay/SDK/catalog stack (which the injected-deps API exercises directly).
  const [{ getCatalogEntry }, { getCardMetadata }, { searchItems, getListingDetail }] = await Promise.all([
    import("../cards/catalog.ts"),
    import("../cards/sdk.ts"),
    import("../affiliate/ebay-browse.ts"),
  ]);
  const deps: ResolveDeps = {
    getCatalogEntry,
    getCardMetadata,
    search: ({ query, limit, surface }) => searchItems({ query, limit, surface }),
    getListingDetail: ({ itemId, surface }) => getListingDetail({ itemId, surface }),
  };
  const { listing } = await resolveVerifiedListingWith(deps, cardId, condition, opts);
  return listing;
}
