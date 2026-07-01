// /faq — full host FAQ (vending pivot — docs/vending Goal A §1.3).
// Copy source: lib/vending/faq.ts (shared with the homepage teaser). Powers
// FAQPage JSON-LD for AEO. Cream/navy/gold; coral is hover-only.

import type { Metadata } from "next";
import Link from "next/link";
import { HOST_FAQS } from "@/lib/vending/faq";
import { faqPageSchema, schemaGraph, serializeJsonLd } from "@/lib/seo/schema-helpers";

export const dynamic = "force-static";
export const revalidate = 86400;

const PAGE_TITLE = "Host a Pokémon card vending machine: frequently asked questions";
const PAGE_DESCRIPTION =
  "Answers for business owners considering a Foil Pokémon card vending machine: cost, space, payouts, contracts, reliability, and what we handle for you.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/faq" },
  robots: { index: true, follow: true },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/faq",
    type: "website",
    // Overriding openGraph suppresses the file-based app/opengraph-image.tsx,
    // so reference the dynamic OG explicitly or the share card is blank.
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function FaqPage() {
  const jsonLd = schemaGraph(faqPageSchema(HOST_FAQS));

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <header className="mb-12">
        <p className="inline-block rounded-full border border-foil-gold/40 bg-foil-gold/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foil-navy">
          Host FAQ
        </p>
        <h1 className="font-display mt-4 text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-4xl sm:leading-[1.1]">
          Hosting a Foil machine, answered.
        </h1>
        <p className="mt-5 max-w-prose text-base leading-relaxed text-foil-slate sm:text-lg">
          Everything a business owner usually asks before letting us place a Pokémon
          card vending machine. If your question isn&apos;t here,{" "}
          <Link
            href="/host"
            className="text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
          >
            start a conversation
          </Link>{" "}
          and we&apos;ll answer it directly.
        </p>
      </header>

      <div className="space-y-5">
        {HOST_FAQS.map((faq) => (
          <section
            key={faq.question}
            className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-7"
          >
            <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-foil-navy">
              {faq.question}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-foil-slate sm:text-base">
              {faq.answer}
            </p>
          </section>
        ))}
      </div>

      {/* Navy contrast band (ADR-061 / DESIGN.md §7): inverted cream button so
          coral stays hover-only. */}
      <div className="mt-12 rounded-2xl bg-foil-navy p-6 shadow-lg shadow-foil-navy/20 sm:p-8">
        <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-foil-cream sm:text-2xl">
          Ready to talk it through?
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-foil-cream/80 sm:text-base">
          We place and operate the machine end to end; you give it three square feet and
          an outlet, and earn a monthly share. No commitment until terms are in writing.
        </p>
        <Link
          href="/host"
          className="mt-5 inline-block rounded-xl bg-foil-cream px-6 py-3 text-base font-semibold text-foil-navy shadow-md shadow-foil-navy/30 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:text-foil-cream hover:shadow-lg hover:ring-2 hover:ring-foil-gold/40"
        >
          Host a machine
        </Link>
      </div>
    </main>
  );
}
