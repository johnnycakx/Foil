// Long-tail listing fallback (Session 47.4 / ADR-046).
//
// Server component rendered in place of the live "Best current listing" block
// for `longtail`-tier cards. Those pages deliberately skip the render-time eBay
// Browse call (to keep the per-render Browse quota bounded as the catalog
// scales past ~1,000 cards), so there's no live best-listing to show. Instead
// we surface the affiliate *search* CTA — an affiliate-tracked URL that makes
// NO Browse API call (it's just a link), so it's R-008-safe — and point the
// reader at the PokeTrace 30-day sold-history panel above for real pricing.

export function LongTailListingFallback({
  cardName,
  searchUrl,
}: {
  cardName: string;
  /** Affiliate-tracked eBay search URL (affiliateSearchUrl) — no Browse call. */
  searchUrl: string;
}) {
  return (
    <section
      className="mt-10 rounded-2xl border border-foil-cream/10 bg-foil-night-2 p-6 sm:p-8"
      aria-labelledby="browse-listings-heading"
    >
      <h2
        id="browse-listings-heading"
        className="text-xs font-semibold uppercase tracking-wider text-foil-accent"
      >
        Live listings
      </h2>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foil-cream/70">
          We track {cardName}&apos;s 30-day sold prices above. For current live
          listings, browse eBay — we surface the best curated deal on our most
          popular cards, and we&apos;re adding live listings to more cards over
          time.
        </p>
        <a
          href={searchUrl}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-foil-cream px-6 py-3 text-sm font-semibold text-foil-navy transition hover:-translate-y-0.5 hover:ring-2 hover:ring-foil-accent/60"
        >
          Browse on eBay →
        </a>
      </div>
      <p className="mt-5 text-[11px] uppercase tracking-wider text-foil-cream/60">
        Affiliate-tracked search · Foil earns a commission on eBay purchases that originate from this link.
      </p>
    </section>
  );
}
