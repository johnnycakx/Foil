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
      className="mt-10 rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-8"
      aria-labelledby="find-card-heading"
    >
      <h2 id="find-card-heading" className="text-xs font-semibold uppercase tracking-wider text-foil-gold">
        Find this card
      </h2>
      <p className="mt-3 text-sm text-foil-slate">
        We don&apos;t have live deal data for {cardName} yet — it&apos;s a lower-volume
        printing. Check current listings on the major marketplaces:
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <a
          href={ebaySearchUrl}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-foil-navy px-6 py-3 text-sm font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40"
        >
          Browse {cardName} on eBay →
        </a>
        <a
          href={tcgplayerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-foil-navy/20 bg-foil-cream px-6 py-3 text-sm font-semibold text-foil-navy transition hover:-translate-y-0.5 hover:border-foil-gold/40 hover:bg-foil-gold/5"
        >
          See on TCGplayer →
        </a>
      </div>
      <p className="mt-5 text-[11px] uppercase tracking-wider text-foil-slate">
        eBay link is affiliate-tracked — Foil earns a commission on purchases that originate from it.
      </p>
    </section>
  );
}
