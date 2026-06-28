// Live curated-tier listing endpoint — GET /api/listing/[slug] (SEO
// crawlability fix, ADR-047 v2 amendment).
//
// Path note: lives at /api/listing/[slug] (NOT under /api/cards) so the proxy's
// PUBLIC_ROUTES allowlists it via a clean `/api/listing` prefix without opening
// the rest of /api/cards/* (which stays gated by default; only /api/cards/search
// is allowlisted, exact).
//
// WHY THIS EXISTS: the per-card page is `force-dynamic` and used to run the live
// eBay `resolveVerifiedListing` (cache:"no-store", multi-getItem) INSIDE the
// server render, so a cold curated page blocked its HTML for up to ~38s on the
// third-party fetch. Googlebot reads that as server distress and throttles the
// whole domain's crawl rate (the 1,007 "Discovered – not indexed" wall). Moving
// the eBay block to this client-hydrated endpoint lets the page serve fast
// evergreen HTML (baked metadata) that Google crawls + indexes, while the live
// affiliate listing loads per-visitor here. The volatile eBay data also leaves
// the crawled DOM entirely (cleaner for ranking, and R-008-tidier).
//
// R-008 (no caching of eBay listing data): `force-dynamic` + the resolver's own
// `cache:"no-store"` reads. Nothing is persisted. The full getItem aspect map
// (VerifiedListing.aspects) stays SERVER-SIDE and transient — we compute the
// buy-signal from it here and return only display fields, never the raw aspects.

import { NextResponse } from "next/server";
import { getCatalogEntry, cardTier } from "@/lib/cards/catalog";
import { getCardMetadata } from "@/lib/cards/sdk";
import { resolveVerifiedListing } from "@/lib/listing/resolve";
import { computeCardBuySignal } from "@/lib/buy-signal/card-signal";
import { affiliateSearchUrl, buildCustomId } from "@/lib/affiliate/epn";
import type { BuySignal } from "@/lib/buy-signal/compute";

export const runtime = "nodejs";
// R-008: never ISR/SSG-cache eBay listing data. force-dynamic + the resolver's
// no-store reads keep every response live. (Same posture as the page render.)
export const dynamic = "force-dynamic";

export type LiveListingResponse = {
  /** The identity-verified listing's DISPLAY fields, or null (honest-null: we
   *  could not confirm an exact match). Never includes the raw aspect map. */
  verified: {
    price: number;
    currency: string;
    title: string;
    affiliateUrl: string;
    /** Verified condition tier (NM/LP/.../GRADED) for the badge. */
    condition: string;
  } | null;
  /** Condition-matched buy signal, or null (UNKNOWN / no verified listing). */
  buySignal: BuySignal | null;
  /** Affiliate search URL for the honest-null "browse on eBay" fallback. */
  fallbackUrl: string;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const url = new URL(request.url);
  const selectedVariant = url.searchParams.get("v") ?? undefined;
  const src = url.searchParams.get("src") ?? undefined;

  const entry = getCatalogEntry(slug);
  if (!entry) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // The live block only exists for the curated tier (the only tier with a live
  // eBay ask; longtail/metadata-only render their own static CTAs on the page).
  const tier = cardTier(slug);
  const fallbackUrl = affiliateSearchUrl(
    // card name + set as the search query — fetched below; build a safe default
    // first so a metadata soft-fail still yields a usable browse link.
    slug.split("-").slice(2).join(" "),
    buildCustomId({ tier: "curated", slug, src }),
  );
  if (tier !== "curated") {
    const body: LiveListingResponse = { verified: null, buySignal: null, fallbackUrl };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const card = await getCardMetadata({ id: entry.pokemonTcgId });
    const realFallback = affiliateSearchUrl(
      `${card.name} ${card.setName}`,
      buildCustomId({ tier: "curated", slug, src }),
    );

    // ONE resolveVerifiedListing → display + buy-signal (the design's single
    // verdict; DESIGN-VERIFIED-LISTING-RESOLVER.md §5). `src` is untrusted —
    // buildCustomId sanitizes it.
    const verified = await resolveVerifiedListing(slug, "ANY_RAW", {
      customId: buildCustomId({ tier: "curated", slug, src }),
      surface: "page_render",
      requestedVariant: selectedVariant,
    });

    let buySignal: BuySignal | null = null;
    if (verified) {
      const cardSignal = await computeCardBuySignal({
        variants: card.variants,
        listingTitle: verified.title,
        listingAspects: verified.aspects,
        askPrice: verified.price,
        listingCurrency: verified.currency,
        selectedVariant,
      });
      buySignal = cardSignal.signal;
    }

    const body: LiveListingResponse = {
      verified: verified
        ? {
            price: verified.price,
            currency: verified.currency,
            title: verified.title,
            affiliateUrl: verified.affiliateUrl,
            condition: verified.condition,
          }
        : null,
      buySignal,
      fallbackUrl: realFallback,
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Soft-fail to honest-null — the page already rendered; a listing-fetch
    // failure must never error the client block.
    const body: LiveListingResponse = { verified: null, buySignal: null, fallbackUrl };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  }
}
