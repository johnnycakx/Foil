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
        <p className="text-xs font-medium uppercase tracking-widest text-[#FFC7BA]">
          Legal
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {TERMS_TITLE}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Last updated {TERMS_LAST_UPDATED}
        </p>
        <p className="mt-6 text-base leading-relaxed text-zinc-300">
          {TERMS_INTRO}
        </p>
      </header>

      <div className="space-y-8">
        {TERMS_SECTIONS.map((section) => (
          <section
            key={section.heading}
            className="rounded-2xl border border-white/5 bg-[#101D38] p-6 sm:p-8"
          >
            <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
              {section.heading}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-base">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
