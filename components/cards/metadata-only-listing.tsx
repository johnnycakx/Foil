// Metadata-only listing block (Session 47.5 / ADR-047).
//
// Rendered for the `metadata-only` tier — cards with no priced/sold data
// (the 18K long tail). The page skips BOTH getBestListing (no eBay Browse
// call) AND the sold-history panel (no PokeTrace data), so this block is the
// card's only "where to buy" affordance: two search CTAs. Both are links that
// make NO Browse/API call at render (R-008-safe). Server component.

export function MetadataOnlyListing({
  cardName,
  ebaySearchUrl,
  tcgplayerUrl,
}: {
  cardName: string;
  /** affiliateSearchUrl(..., "foil-metadata-only") — affiliate-tracked, no Browse call. */
  ebaySearchUrl: string;
  /** TCGplayer search URL. Non-affiliate today; swap to the affiliate/partner
   *  link when ROADMAP #26 (TCGplayer affiliate plumbing) lands. */
  tcgplayerUrl: string;
}) {
  return (
    <section
      className="mt-10 rounded-2xl border border-foil-cream/10 bg-foil-night-2 p-6 sm:p-8"
      aria-labelledby="find-card-heading"
    >
      <h2 id="find-card-heading" className="text-xs font-semibold uppercase tracking-wider text-foil-accent">
        Find this card
      </h2>
      {/* One template expression, not JSX text around {cardName}: the JSX
          compiler was eating the space after the expression ("Chikoritayet"),
          live-verified in the SSR HTML during the vault-first pass. */}
      <p className="mt-3 text-sm text-foil-cream/70">
        {`We don't have live deal data for ${cardName} yet. It's a lower-volume printing. Check current listings on the major marketplaces:`}
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <a
          href={ebaySearchUrl}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-foil-cream px-6 py-3 text-sm font-semibold text-foil-navy transition-all hover:-translate-y-0.5 hover:ring-2 hover:ring-foil-accent/60"
        >
          Browse {cardName} on eBay →
        </a>
        <a
          href={tcgplayerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-foil-cream/20 bg-foil-night px-6 py-3 text-sm font-semibold text-foil-cream transition hover:-translate-y-0.5 hover:border-foil-accent/40 hover:bg-foil-accent/5"
        >
          See on TCGplayer →
        </a>
      </div>
      <p className="mt-5 text-[11px] uppercase tracking-wider text-foil-cream/60">
        eBay link is affiliate-tracked — Foil earns a commission on purchases that originate from it.
      </p>
    </section>
  );
}
