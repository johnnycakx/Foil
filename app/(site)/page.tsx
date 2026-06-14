// Homepage — the vending host pitch (vending pivot, docs/vending Goal A/E).
//
// Section spine: hero -> value props -> how it works (dark navy) -> operating
// proof -> lead form. The deal-finder is dormant (noindex + unlinked); this is
// the public face of foiltcg.com.
//
// DESIGN (ADR-061 / DESIGN.md §7 — the "confident local operator" vending
// register): cream↔navy alternation for contrast (the "How it works" band is
// navy with gold step numbers), subtle resting elevation on the value-prop
// cards, and gold as a structural accent (eyebrows, step numbers). Palette,
// fonts, coral-hover-only, and no-pure-black/white are unchanged.
//
// HONESTY (docs/vending/02 §6 + the 2026-06-13 OFF-SITE decisions): no earnings
// projections, no "passive income", no fabricated scale/testimonials, no
// insurance/liability claim (a call topic), no revenue-share number (a call
// topic: no percentage, no gross/net), no implied installs, no placeholder text.
// Machine photos are neutral product/model imagery on a navy frame. This is a
// vending surface: it never borrows the deal-finder's trust vocabulary.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HostLeadForm } from "@/components/vending/host-lead-form";
import { SERVED_CITY_NAMES, SERVICE_CITIES } from "@/lib/vending/cities";
import {
  localBusinessSchema,
  serviceSchema,
  schemaGraph,
  serializeJsonLd,
} from "@/lib/seo/schema-helpers";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://foiltcg.com").replace(/\/$/, "");
}

const SITE_TITLE = "Host a free Pokémon card vending machine in your Bay Area business | Foil";
const SITE_DESCRIPTION =
  "Foil places, stocks, and services a Pokémon card vending machine in your business across the North Bay and East Bay. Zero cost, zero work: you provide three square feet and earn a monthly revenue share.";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  metadataBase: new URL(siteUrl()),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "Foil",
    url: "/",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function Home() {
  const base = siteUrl();
  // LocalBusiness + Service only. The FAQPage JSON-LD lives on /faq, where the
  // FAQ is actually visible (the homepage no longer renders an FAQ block, so
  // emitting FAQPage here would mismatch the visible content).
  const jsonLd = schemaGraph(
    localBusinessSchema({
      name: "Foil",
      url: base,
      description:
        "Pokémon trading-card vending machine placement and operation for businesses across the San Francisco Bay Area. The host provides space and power; Foil owns, stocks, and services the machine and pays a monthly revenue share.",
      areaServed: SERVED_CITY_NAMES,
      addressRegion: "CA",
      addressCountry: "US",
    }),
    serviceSchema({
      name: "Pokémon card vending machine placement",
      description:
        "Foil places, stocks, and services Pokémon card vending machines in high-foot-traffic Bay Area businesses, hands-off for the host, with a monthly revenue share.",
      providerName: "Foil",
      url: base,
      areaServed: SERVED_CITY_NAMES,
    }),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Hero />
      <ValueProps />
      <HowItWorks />
      <OperatingProof />
      <LeadSection />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-foil-cream">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pt-14 pb-16 sm:px-8 sm:pt-20 sm:pb-24 lg:grid-cols-2 lg:gap-14">
        <div className="text-center lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full border border-foil-gold/40 bg-foil-gold/10 px-3 py-1 text-xs font-medium text-foil-navy">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-foil-gold" />
            Pokémon card vending machines · North Bay &amp; East Bay
          </p>

          <h1 className="font-display mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.01em] text-foil-navy sm:text-5xl md:text-6xl">
            A Pokémon card vending machine in your business. It costs you nothing.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg text-foil-slate sm:text-xl lg:mx-0">
            We place, stock, and service the machine. You give it three square feet and an
            outlet, and earn a share of every sale, with zero work.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
            <Link
              href="#host-form"
              className="rounded-xl bg-foil-navy px-6 py-3.5 text-base font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40"
            >
              Host a machine →
            </Link>
            <Link
              href="/service-areas"
              className="text-sm text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
            >
              See the cities we serve →
            </Link>
          </div>

          <p className="mt-5 text-xs text-foil-slate">
            Risk-free trial, no contract, and we&apos;ll walk through the revenue share on a
            quick call.
          </p>
        </div>

        {/* Machine photo on a NAVY device frame (DESIGN.md §7 / ADR-061): product
            model imagery, dark-on-dark so it reads intentional rather than
            floating on cream. Neutral model-only caption; NOT a Foil install or
            placed location (docs/vending/02 §6). Cropped slightly toward the lit
            screen. */}
        <figure className="mx-auto w-full max-w-sm lg:max-w-none">
          <div className="rounded-3xl bg-foil-navy p-3 shadow-xl shadow-foil-navy/30 ring-1 ring-foil-gold/30">
            <div className="overflow-hidden rounded-2xl">
              <Image
                src="/vending/machine-tower-1.webp"
                alt="The freestanding tower, a touchscreen Pokémon card vending machine"
                width={1199}
                height={1599}
                className="aspect-[4/5] w-full object-cover object-[center_26%]"
                priority
                sizes="(min-width: 1024px) 36rem, (min-width: 640px) 24rem, 90vw"
              />
            </div>
          </div>
          <figcaption className="mt-3 text-center text-xs text-foil-slate lg:text-left">
            Our freestanding tower model.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function ValueProps() {
  const props = [
    {
      n: "01",
      title: "Completely hands-off",
      body: "We install, stock, restock, and service the machine, and handle every customer issue. Your staff never touches it.",
    },
    {
      n: "02",
      title: "Zero cost, nothing to buy",
      body: "No purchase, no lease, no fees. It draws about as much power as a TV, roughly $4 a month.",
    },
    {
      n: "03",
      title: "A monthly revenue share",
      body: "You earn a share of every sale, paid your way. We'll walk through the revenue share on a quick call, with sales analytics so you see what's selling.",
    },
    {
      n: "04",
      title: "New foot traffic",
      body: "A Pokémon machine pulls in collectors, about 60% are adults 25 to 40, and gives your regulars a reason to come back.",
    },
  ];

  return (
    <section className="bg-foil-cream">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-foil-gold">
          Why owners say yes
        </p>
        <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-4xl">
          An amenity that runs itself and pays you.
        </h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2">
          {props.map((p) => (
            <li
              key={p.title}
              className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-md shadow-foil-navy/10 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foil-navy/15"
            >
              <span className="font-display text-sm font-bold tracking-widest text-foil-gold">{p.n}</span>
              <h3 className="font-display mt-1 text-lg font-semibold text-foil-navy">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foil-slate">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      num: "1",
      title: "We talk",
      body: "A quick chat about your space and foot traffic. No pressure, no commitment.",
    },
    {
      num: "2",
      title: "We place it",
      body: "We size, deliver, mount, stock, and test the machine. Install takes about an hour.",
    },
    {
      num: "3",
      title: "It runs itself",
      body: "Cashless touchscreen, monitored in real time, auto-refunds on any misfire. Support is on us.",
    },
    {
      num: "4",
      title: "You get paid",
      body: "A monthly revenue share by your preferred method, with sales analytics.",
    },
  ];

  // Dark navy contrast band (ADR-061): the energy moment, gold step numbers.
  return (
    <section className="bg-foil-navy">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-foil-gold">
          How it works
        </p>
        <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-[-0.01em] text-foil-cream sm:text-4xl">
          Four steps. Only two are on you.
        </h2>
        <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.num}>
              <span className="font-display block text-5xl font-bold leading-none text-foil-gold">{s.num}</span>
              <h3 className="font-display mt-4 text-lg font-semibold text-foil-cream">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foil-cream/75">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function OperatingProof() {
  const points = [
    "Commercial-grade touchscreen machines that describe each pack and do the selling.",
    "Fully cashless, monitored in real time, with restock alerts before a machine runs empty.",
    "A guaranteed-drop refund sensor: pay and get nothing, and you're refunded automatically.",
    "A support code on every machine so customers reach us directly, never your staff.",
  ];

  return (
    <section className="border-y border-foil-navy/10 bg-foil-cream">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-foil-gold">
              A real operation, not a metal box
            </p>
            <h2 className="font-display mt-2 text-3xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-4xl">
              Built to run itself, and to be trusted.
            </h2>
            <p className="mt-4 max-w-prose text-foil-slate">
              Foil is run by John Craig, a Level-4 TCGplayer seller, with real, verifiable
              Pokémon-product sourcing behind every machine. We own the machines, stock
              them, and stand behind every transaction.
            </p>
          </div>
          <ul className="space-y-3">
            {points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 rounded-2xl border border-foil-navy/10 bg-foil-cream p-4 text-sm leading-relaxed text-foil-navy shadow-sm shadow-foil-navy/5 sm:text-base"
              >
                <span aria-hidden className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function LeadSection() {
  return (
    <section id="host-form" className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="mb-8 text-center">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-4xl">
          Get a Foil machine in your space
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-foil-slate">
          We serve {SERVICE_CITIES.length}+ Bay Area cities, closest first. Tell us about
          your space and we&apos;ll reach out. Questions first?{" "}
          <Link
            href="/faq"
            className="text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
          >
            Read the host FAQ →
          </Link>
        </p>
      </div>
      <HostLeadForm compact />
    </section>
  );
}
