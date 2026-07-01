// AggregateOffer JSON-LD builder from baked TCGplayer price ranges (ADR-046).
//
// Extracted from app/(site)/cards/[slug]/page.tsx (perf-and-data-foundation,
// 2026-07-01) so the "card pages emit REAL baked prices in structured data"
// invariant is unit-testable against the committed snapshot — for five weeks
// the snapshot was price-empty and this builder silently returned null on
// every card, with nothing failing.
//
// Long-tail pages have no live eBay Offer, but the baked TCGplayer low/high
// (no network, R-008-safe — not eBay listing data) still gives a price signal
// for Product rich results. Returns null when no usable price range exists.

export function aggregateOfferFromTcgplayer(
  prices: Record<string, { low: number | null; high: number | null }> | undefined,
  url: string,
): Record<string, unknown> | null {
  const lows: number[] = [];
  const highs: number[] = [];
  for (const p of Object.values(prices ?? {})) {
    if (typeof p.low === "number" && p.low > 0) lows.push(p.low);
    if (typeof p.high === "number" && p.high > 0) highs.push(p.high);
  }
  if (lows.length === 0 && highs.length === 0) return null;
  const low = lows.length ? Math.min(...lows) : Math.min(...highs);
  const high = highs.length ? Math.max(...highs) : Math.max(...lows);
  return {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: low.toFixed(2),
    highPrice: high.toFixed(2),
    offerCount: lows.length + highs.length,
    url,
  };
}
