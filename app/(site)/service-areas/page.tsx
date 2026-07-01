// /service-areas — Bay Area hub (vending pivot — docs/vending Goal A §1 + doc 04 §1).
// Lists every city we serve with a link to its unique city page. Carries
// LocalBusiness JSON-LD with areaServed so Google connects the brand to local
// intent across the service area. Cream/navy/gold; coral hover-only.

import type { Metadata } from "next";
import Link from "next/link";
import { SERVICE_CITIES, SERVED_CITY_NAMES } from "@/lib/vending/cities";
import { localBusinessSchema, schemaGraph, serializeJsonLd } from "@/lib/seo/schema-helpers";

export const dynamic = "force-static";
export const revalidate = 86400;

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://foiltcg.com").replace(/\/$/, "");
}

const PAGE_TITLE = "Bay Area service areas: Pokémon card vending machine placement";
const PAGE_DESCRIPTION =
  "Foil places and operates Pokémon card vending machines for businesses across the North Bay and East Bay. See the cities we serve, closest first.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/service-areas" },
  robots: { index: true, follow: true },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/service-areas",
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

export default function ServiceAreasPage() {
  const base = siteUrl();
  const jsonLd = schemaGraph(
    localBusinessSchema({
      name: "Foil",
      url: base,
      description:
        "Pokémon trading-card vending machine placement and operation for businesses across the San Francisco Bay Area.",
      areaServed: SERVED_CITY_NAMES,
      addressRegion: "CA",
      addressCountry: "US",
    }),
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <header className="mb-12">
        <p className="inline-block rounded-full border border-foil-gold/40 bg-foil-gold/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foil-navy">
          Service areas
        </p>
        <h1 className="font-display mt-4 text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-5xl sm:leading-[1.08]">
          Pokémon card vending machines, across the Bay Area.
        </h1>
        <p className="mt-5 max-w-prose text-base leading-relaxed text-foil-slate sm:text-lg">
          We place and operate Pokémon card vending machines for businesses in the North
          Bay and East Bay, working closest cities first: the nearer your venue, the
          faster the restocks and the quicker we respond if anything needs attention.
          Find your city below.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SERVICE_CITIES.map((city) => (
          <li key={city.slug}>
            <Link
              href={`/service-areas/${city.slug}`}
              className="block h-full rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-foil-navy/10 hover:ring-1 hover:ring-foil-gold/40"
            >
              <p className="text-xs font-medium uppercase tracking-widest text-foil-gold">
                {city.county}
              </p>
              <h2 className="font-display mt-1 text-xl font-bold tracking-[-0.02em] text-foil-navy">
                {city.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foil-slate">{city.lead}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-12 rounded-2xl border border-foil-gold/40 bg-foil-gold/10 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          Don&apos;t see your city?
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-foil-slate sm:text-base">
          We&apos;re expanding across the North Bay, East Bay, and the I-80 corridor toward
          Sacramento. If your business is in the wider Bay Area,{" "}
          <Link
            href="/host"
            className="text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
          >
            reach out
          </Link>{" "}
          and tell us where you are.
        </p>
      </div>
    </main>
  );
}
