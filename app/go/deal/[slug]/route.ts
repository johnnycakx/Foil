// /go/deal/[slug] — click-time deal redirect (ROADMAP B.4 follow-up / ADR-056).
//
// The /deals leaderboard's "See it on eBay" buttons point here. On GET we run a
// LIVE getBestListing for the card and 302-redirect to that specific item's
// affiliate-wrapped URL (or the affiliate SEARCH url if no confident listing is
// found at click time). One Browse call per CLICK (bounded by clicks, not page
// views — the board itself makes zero Browse calls per view). R-008: compute at
// click, persist nothing. Logged under the `deals_redirect` BrowseSurface.
//
// Security: the slug is validated against the catalog inside resolveDealDestination;
// the destination is ALWAYS an internally-built eBay affiliate URL (never a
// user-supplied URL), so there is no open-redirect surface. An unknown slug goes
// to the internal /deals page.

import { NextResponse } from "next/server";
import { getBestListing } from "@/lib/affiliate/ebay-browse";
import { getCardMetadata } from "@/lib/cards/sdk";
import { resolveDealDestination } from "@/lib/deals/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const dest = await resolveDealDestination({ slug, getCardMetadata, getBestListing });

  if (!dest.ok) {
    // Unknown slug — bounce to the leaderboard (internal, safe).
    return NextResponse.redirect(new URL("/deals", request.url), 302);
  }
  return NextResponse.redirect(dest.url, 302);
}
