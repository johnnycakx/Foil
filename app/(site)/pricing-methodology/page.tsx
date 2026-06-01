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

export const dynamic = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = {
  title: `${METHODOLOGY_TITLE} — Foil`,
  description:
    "How Foil's buy signal works: the 30-day sold reference, the below/at/above thresholds, condition filtering, the sample-size floor, and the known limitations.",
  alternates: { canonical: "/pricing-methodology" },
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
    </main>
  );
}
