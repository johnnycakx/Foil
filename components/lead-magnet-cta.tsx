// Lead-magnet CTA card (ADR-068). The stronger, specific capture offer that
// replaces a generic "subscribe" on high-traffic pricing pages (the pillars) —
// one ask per page (ADR-066). It's a Link to the magnet landing page (where the
// gated capture + on-page asset delivery live), so the page it sits on keeps a
// single email ask (the magnet page's). The `id` prop lets it carry an in-page
// anchor target (e.g. the pillars' existing #waitlist links).

import Link from "next/link";

const MAGNET_HREF = "/free/pokemon-card-pricing-cheat-sheet";

export function LeadMagnetCTA({ id }: { id?: string }) {
  return (
    <section
      id={id}
      className="mt-16 rounded-3xl border border-foil-gold/40 bg-foil-cream p-8 shadow-xl shadow-foil-navy/10 sm:p-12"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-foil-gold">Free download</p>
      <h2 className="font-display mt-2 max-w-2xl text-2xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-3xl">
        Get the Pokémon Card Pricing Cheat Sheet
      </h2>
      <p className="mt-3 max-w-2xl text-foil-slate">
        One page: the condition multipliers (NM through DMG), the three fields to
        read off any card, raw vs graded, and when grading is actually worth it. The
        reference, free. No spam.
      </p>
      <Link
        href={MAGNET_HREF}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-foil-navy px-6 py-3.5 text-base font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40"
      >
        Get the free cheat sheet
        <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
