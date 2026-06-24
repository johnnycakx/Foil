// Buy-signal methodology (ROADMAP #32 / ADR-053). Public, crawlable — the
// trust/defensibility page every buy-signal badge links to. Content lives in
// lib/buy-signal/methodology-content.ts so the quality gates scan it in tests.

import type { Metadata } from "next";
import {
  METHODOLOGY_TITLE,
  METHODOLOGY_INTRO,
  METHODOLOGY_LAST_UPDATED,
  METHODOLOGY_SECTIONS,
} from "@/lib/buy-signal/methodology-content";
import { MACHINE_PRICING_SECTIONS } from "@/lib/vending/machine-pricing-content";

export const dynamic = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = {
  title: `${METHODOLOGY_TITLE} — Foil`,
  description:
    "How Foil's buy signal works: the 30-day sold reference, the below/at/above thresholds, condition filtering, the sample-size floor, and the known limitations.",
  alternates: { canonical: "/pricing-methodology" },
  // Indexable again (dual-track restore, ADR-064): the deal-finder buy-signal
  // trust page every buy-signal badge links to. The machine-pricing disclosure
  // section below is retained so the (dormant) /machines link stays valid and
  // the two products stay honest about each other.
  robots: { index: true, follow: true },
};

export default function PricingMethodologyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <header className="mb-10">
        <p className="text-xs font-medium uppercase tracking-widest text-foil-gold">Methodology</p>
        <h1 className="font-display mt-3 text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-4xl">
          {METHODOLOGY_TITLE}
        </h1>
        <p className="mt-2 text-sm text-foil-slate">Last updated {METHODOLOGY_LAST_UPDATED}</p>
        <p className="mt-6 text-base leading-relaxed text-foil-slate">{METHODOLOGY_INTRO}</p>
      </header>

      <div className="space-y-8">
        {METHODOLOGY_SECTIONS.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-semibold text-foil-navy">{s.heading}</h2>
            <p className="mt-2 text-base leading-relaxed text-foil-slate">{s.body}</p>
          </section>
        ))}
      </div>

      {/* Machine-pricing disclosure (STRATEGY-VENDING-2026-06-12, amended §4).
          The one surface where the deal-finder and the vending machines are
          discussed together, on purpose: the published policy IS the answer
          to "a price site selling $20 packs". Copy lives in
          lib/vending/machine-pricing-content.ts (scanned by tests). */}
      <div className="mt-14 border-t border-foil-navy/10 pt-10">
        <p className="text-xs font-medium uppercase tracking-widest text-foil-gold">
          Foil machines
        </p>
        <div className="mt-4 space-y-8">
          {MACHINE_PRICING_SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-semibold text-foil-navy">{s.heading}</h2>
              <p className="mt-2 text-base leading-relaxed text-foil-slate">{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
