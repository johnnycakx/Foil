// Wishlist alert email composers — pure functions, no I/O. The cron route
// at app/api/cron/wishlist-alerts/route.ts assembles the inputs and uses
// these to render the subject + HTML body, then hands off to
// lib/notifications/resend.ts::sendTransactionalEmail.
//
// Affiliate posture: the CTA in the email body is an affiliate-tracked
// eBay URL with `customid=foil-wishlist-alert` (distinct from the
// per-card-page `foil-card-page` customid) so the per-channel commission
// attribution comes through clean.

import type { EpnBestListing } from "../affiliate/epn.ts";

export type WishlistEmailInputs = {
  cardName: string;
  setName: string;
  cardSlug: string;
  /** Lowest current listing as returned by getBestListing. */
  listing: EpnBestListing;
  /** Target price in cents that the watching email row asked for. */
  targetPriceCents: number;
  /** Pokemon TCG SDK image URL, may be null when the catalog metadata
   *  doesn't expose one (renders without an image rather than 500ing). */
  cardImage: string | null;
  /** Absolute URL to /cards/<slug> on production — for the "view full
   *  card page" link below the CTA. */
  cardPageUrl: string;
};

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPriceFromListing(listing: EpnBestListing): string {
  if (listing.currency === "USD") {
    return `$${listing.price.toFixed(2)}`;
  }
  return `${listing.price.toFixed(2)} ${listing.currency}`;
}

/**
 * Subject line for a wishlist-alert email. Format:
 *   "Charizard (Base) dropped to $38 — you wanted ≤ $40"
 * The dollar figures land verbatim so inbox preview / spam filters see the
 * exact thresholds the user opted in to. Card name + set are kept short
 * because Gmail truncates around 70 chars.
 */
export function subjectLine(input: WishlistEmailInputs): string {
  const currentPrice = formatPriceFromListing(input.listing);
  const targetPrice = formatUsd(input.targetPriceCents);
  return `${input.cardName} (${input.setName}) dropped to ${currentPrice} — you wanted ≤ ${targetPrice}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Body HTML for a wishlist-alert email. Single-purpose: surface the
 * current best listing for the watched card with an affiliate-tracked CTA.
 *
 * Image is optional — when card metadata didn't expose one we drop the
 * <img> entirely rather than render a broken icon.
 */
export function emailBody(input: WishlistEmailInputs): string {
  const safeName = escapeHtml(input.cardName);
  const safeSet = escapeHtml(input.setName);
  const safeListingTitle = escapeHtml(input.listing.title);
  const currentPrice = escapeHtml(formatPriceFromListing(input.listing));
  const targetPrice = escapeHtml(formatUsd(input.targetPriceCents));
  const safeAffiliateUrl = escapeHtml(input.listing.affiliateUrl);
  const safeCardPageUrl = escapeHtml(input.cardPageUrl);

  const imageBlock = input.cardImage
    ? `<img src="${escapeHtml(input.cardImage)}" alt="${safeName} (${safeSet})" width="160" style="border-radius: 12px; display: block; margin: 0 auto 16px;" />`
    : "";

  const listingImageBlock = input.listing.image
    ? `<img src="${escapeHtml(input.listing.image)}" alt="Listing image" width="120" style="border-radius: 8px; margin-bottom: 12px;" />`
    : "";

  return [
    `<!doctype html>`,
    `<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; line-height: 1.55; color: #1a1a1a; background: #fff;">`,
    `<h1 style="font-size: 22px; margin: 0 0 8px; color: #FF6B5C;">A card you're watching just dropped.</h1>`,
    `<p style="color: #555; font-size: 14px; margin: 0 0 24px;">${safeName} (${safeSet}) is now <strong>${currentPrice}</strong> — you opted in for alerts when it hit ≤ ${targetPrice}.</p>`,

    imageBlock,

    `<div style="border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px; margin: 16px 0; background: #fafafa;">`,
    listingImageBlock,
    `<p style="margin: 0 0 4px; font-size: 13px; color: #777; text-transform: uppercase; letter-spacing: 0.05em;">Best current listing</p>`,
    `<p style="margin: 0 0 8px; font-size: 28px; font-weight: 700; color: #1a1a1a;">${currentPrice}</p>`,
    `<p style="margin: 0 0 16px; font-size: 14px; color: #444;">${safeListingTitle}</p>`,
    `<a href="${safeAffiliateUrl}" style="display: inline-block; background: #FF6B5C; color: #fff; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 15px;">Buy on eBay →</a>`,
    `</div>`,

    `<p style="font-size: 13px; color: #555; margin: 16px 0;">Prices update on every page load — <a href="${safeCardPageUrl}" style="color: #FF6B5C;">view the full card page</a> for the latest listing if this one's gone by the time you click.</p>`,

    `<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />`,
    `<p style="font-size: 11px; color: #999; line-height: 1.5;">You're getting this because you set a watchlist alert at foiltcg.com. We send at most one alert per card per 24 hours. The "Buy on eBay" link is affiliate-tracked — Foil earns a commission on purchases that originate from this email.</p>`,
    `</body></html>`,
  ].join("\n");
}
