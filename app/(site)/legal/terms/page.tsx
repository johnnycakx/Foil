// Terms of Service. Server Component, inherits (site) chrome.
// Content lives in lib/legal/policy-content.ts.

import type { Metadata } from "next";
import {
  TERMS_TITLE,
  TERMS_INTRO,
  TERMS_LAST_UPDATED,
  TERMS_SECTIONS,
} from "@/lib/legal/policy-content";

export const dynamic = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = {
  title: `${TERMS_TITLE} — Foil`,
  description:
    "Plain-language terms of service: FTC affiliate disclosure (eBay Partner Network), as-is listing accuracy, acceptable use, contact path.",
  alternates: {
    canonical: "/legal/terms",
  },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <header className="mb-10">
        <p className="text-xs font-medium uppercase tracking-widest text-foil-gold">
          Legal
        </p>
        <h1 className="font-display mt-3 text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-4xl">
          {TERMS_TITLE}
        </h1>
        <p className="mt-2 text-sm text-foil-slate">
          Last updated {TERMS_LAST_UPDATED}
        </p>
        <p className="mt-6 text-base leading-relaxed text-foil-slate">
          {TERMS_INTRO}
        </p>
      </header>

      <div className="space-y-8">
        {TERMS_SECTIONS.map((section) => (
          <section
            key={section.heading}
            className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-8"
          >
            <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-foil-navy sm:text-xl">
              {section.heading}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-foil-slate sm:text-base">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
