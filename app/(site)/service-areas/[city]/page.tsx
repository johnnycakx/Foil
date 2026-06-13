// /service-areas/[city] — unique per-city landing page (vending pivot,
// docs/vending Goal A §1 + doc 04 §1). NOT a swapped-variable template: each
// city's body, angle, and FAQ come from lib/vending/cities.ts and reference
// that city's real venue landscape. Carries LocalBusiness + Service +
// FAQPage JSON-LD scoped to the city. Closed slug set via generateStaticParams.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCity, CITY_SLUGS, CITY_NAMES } from "@/lib/vending/cities";
import {
  localBusinessSchema,
  serviceSchema,
  faqPageSchema,
  schemaGraph,
  serializeJsonLd,
} from "@/lib/seo/schema-helpers";

export const dynamic = "force-static";
export const revalidate = 86400;

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://foiltcg.com").replace(/\/$/, "");
}

type PageProps = { params: Promise<{ city: string }> };

export function generateStaticParams() {
  return CITY_SLUGS.map((city) => ({ city }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) return { title: "Service area not found" };

  const title = `Pokémon Card Vending Machines for ${city.name} Businesses`;
  const description = `${city.lead} Foil places, stocks, and services the machine in ${city.name}, ${city.county}. You provide the space; you earn a monthly revenue share.`;

  return {
    title,
    description,
    alternates: { canonical: `/service-areas/${city.slug}` },
    robots: { index: true, follow: true },
    openGraph: { title, description, url: `/service-areas/${city.slug}`, type: "website" },
  };
}

export default async function CityPage({ params }: PageProps) {
  const { city: slug } = await params;
  const city = getCity(slug);
  if (!city) notFound();

  const base = siteUrl();
  const jsonLd = schemaGraph(
    localBusinessSchema({
      name: "Foil",
      url: base,
      description: `Pokémon trading-card vending machine placement and operation for businesses in ${city.name}, ${city.county}.`,
      areaServed: [city.name],
      addressRegion: "CA",
      addressCountry: "US",
    }),
    serviceSchema({
      name: "Pokémon card vending machine placement",
      description: `Foil places, stocks, and services Pokémon card vending machines for ${city.name} businesses, with a monthly revenue share to the host.`,
      providerName: "Foil",
      url: base,
      areaServed: [city.name],
    }),
    faqPageSchema(city.faqs),
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-foil-slate">
        <Link href="/service-areas" className="transition hover:text-foil-navy">
          Service areas
        </Link>
        <span aria-hidden className="mx-2 text-foil-slate/60">
          /
        </span>
        <span className="text-foil-navy">{city.name}</span>
      </nav>

      <header className="mb-12">
        <p className="inline-block rounded-full border border-foil-gold/40 bg-foil-gold/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foil-navy">
          {city.county}
        </p>
        <h1 className="font-display mt-4 text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-4xl sm:leading-[1.1]">
          Pokémon Card Vending Machines for {city.name} Businesses
        </h1>
        <p className="mt-5 max-w-prose text-base leading-relaxed text-foil-slate sm:text-lg">
          {city.lead}
        </p>
      </header>

      <section aria-labelledby="city-body" className="mb-12">
        <h2 id="city-body" className="sr-only">
          About hosting in {city.name}
        </h2>
        <div className="space-y-5">
          {city.paragraphs.map((para, i) => (
            <p key={i} className="max-w-prose text-base leading-relaxed text-foil-slate">
              {para}
            </p>
          ))}
        </div>
      </section>

      {/* The offer, worded for this city (doc 04 recipe: same value props, fresh wording). */}
      <section
        aria-labelledby="city-offer"
        className="mb-12 rounded-2xl border border-foil-gold/40 bg-foil-gold/10 p-6 sm:p-8"
      >
        <h2 id="city-offer" className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          What a {city.name} host gets
        </h2>
        <ul className="mt-4 space-y-2.5">
          {[
            "A 10–15% revenue share of gross sales, paid monthly.",
            "Zero cost: no purchase, no lease, no fees. We carry it all.",
            "Completely hands-off: we install, stock, restock, and support it.",
            "A risk-free trial month, no contract required to start.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-foil-navy sm:text-base">
              <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* City-specific FAQ (also the FAQPage JSON-LD above). */}
      <section aria-labelledby="city-faq" className="mb-12">
        <h2 id="city-faq" className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          {city.name} questions
        </h2>
        <div className="mt-5 space-y-4">
          {city.faqs.map((faq) => (
            <div
              key={faq.question}
              className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-5 shadow-sm shadow-foil-navy/5"
            >
              <h3 className="font-display text-base font-bold tracking-[-0.02em] text-foil-navy">
                {faq.question}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foil-slate">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Lead CTA + internal links (local-SEO: city ↔ host ↔ faq ↔ neighbors). */}
      <section aria-labelledby="city-cta" className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-lg shadow-foil-navy/10 sm:p-8">
        <h2 id="city-cta" className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          Put a machine in your {city.name} business
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-foil-slate sm:text-base">
          Tell us about your space and we&apos;ll take it from there. No commitment until
          terms are agreed in writing.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Link
            href="/host"
            className="inline-block rounded-xl bg-foil-navy px-6 py-3 text-base font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40"
          >
            Host a machine
          </Link>
          <Link
            href="/faq"
            className="text-sm text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
          >
            Read the host FAQ
          </Link>
        </div>

        {city.nearby.length > 0 && (
          <p className="mt-6 border-t border-foil-navy/10 pt-5 text-sm text-foil-slate">
            Nearby:{" "}
            {city.nearby.map((nslug, i) => {
              const isPublished = CITY_SLUGS.includes(nslug);
              const label = CITY_NAMES[nslug] ?? nslug;
              return (
                <span key={nslug}>
                  {i > 0 && ", "}
                  {isPublished ? (
                    <Link
                      href={`/service-areas/${nslug}`}
                      className="text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span>{label}</span>
                  )}
                </span>
              );
            })}
          </p>
        )}
      </section>
    </main>
  );
}
