// Homepage — the vending host pitch (vending pivot, docs/vending Goal A §1).
//
// Repurposed from the deal-finder hero to a host-acquisition landing page:
// hero -> value props -> how it works -> operating proof -> FAQ teaser -> lead
// form. The deal-finder is dormant (noindex + unlinked); this is now the
// public face of foiltcg.com.
//
// HONESTY (docs/vending/02 §6 + the 2026-06-13 OFF-SITE decision): no earnings
// projections, no "passive income" vocabulary, no fabricated scale/testimonials,
// no insurance or liability claim (that is a call / in-person topic, never a
// website claim), and no revenue-share number (a call topic too: no percentage,
// no gross/net). No placeholder text in rendered copy. This is a vending
// surface: it never borrows the deal-finder's trust vocabulary.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HostLeadForm } from "@/components/vending/host-lead-form";
import { HOST_FAQ_TEASER } from "@/lib/vending/faq";
import { SERVED_CITY_NAMES, SERVICE_CITIES } from "@/lib/vending/cities";
import {
  localBusinessSchema,
  serviceSchema,
  faqPageSchema,
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
    faqPageSchema(HOST_FAQ_TEASER),
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
      <FaqTeaser />
      <LeadSection />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-foil-cream">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pt-14 pb-16 sm:px-8 sm:pt-20 sm:pb-20 lg:grid-cols-2 lg:gap-12">
        <div className="text-center lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full border border-foil-gold/40 bg-foil-cream/80 px-3 py-1 text-xs font-medium text-foil-navy">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-foil-gold" />
            Pokémon card vending machines · North Bay &amp; East Bay
          </p>

          <h1 className="font-display mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.01em] text-foil-navy sm:text-5xl md:text-6xl">
            A Pokémon card vending machine in your business. It costs you nothing.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg text-foil-slate sm:text-xl lg:mx-0">
            Foil places the machine, keeps it stocked, and keeps it working. You give it
            three square feet and a standard outlet, and earn a share of every sale, with
            zero work and nothing to buy.
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
            You earn a share of every sale, paid monthly. Risk-free trial, no contract,
            and we&apos;ll walk through the revenue share on a quick call.
          </p>
        </div>

        {/* Product/model imagery (Goal B) — a neutral reference photo of the
            machine MODEL, NOT a Foil install or placed location (docs/vending/02
            §6 honesty guardrails). Generic framing, no venue surfaced, no
            placement claim. Premium gold-border framing per DESIGN.md. */}
        <figure className="mx-auto w-full max-w-sm lg:max-w-none">
          <div className="overflow-hidden rounded-3xl border border-foil-gold/40 bg-foil-cream p-2 shadow-xl shadow-foil-navy/15">
            <Image
              src="/vending/machine-tower-1.webp"
              alt="The freestanding tower, a touchscreen Pokémon card vending machine"
              width={1199}
              height={1599}
              className="h-auto w-full rounded-2xl object-cover"
              priority
              sizes="(min-width: 1024px) 36rem, (min-width: 640px) 24rem, 90vw"
            />
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
      title: "Completely hands-off",
      body: "We install, stock, restock, and service the machine, and handle every customer issue through an on-machine support code. Your staff never touches it.",
    },
    {
      title: "Zero cost, nothing to buy",
      body: "No purchase, no lease, no fees. The machine draws about as much power as a TV (roughly $4 a month), and that's the only thing it adds to your bill.",
    },
    {
      title: "A monthly revenue share",
      body: "You earn a monthly share of every sale, paid your way, for space you're already paying for. We'll walk through the revenue share on a quick call, and sales analytics show you exactly what's selling.",
    },
    {
      title: "New foot traffic and a talking point",
      body: "A Pokémon machine pulls in collectors (about 60% are adults 25 to 40) and gives your regulars one more reason to stay, come back, and bring someone.",
    },
    {
      title: "Tiny, sleek footprint",
      body: "Jukebox-sized, not a clunky snack machine. About 3 to 4 square feet, wall-mounted, on a pedestal, or freestanding with no drilling.",
    },
    {
      title: "Risk-free trial",
      body: "Start with a no-commitment trial month. If it isn't a fit for either side, we pull the machine and relocate it. No contract required.",
    },
  ];

  return (
    <section className="relative isolate overflow-hidden border-y border-foil-navy/10 bg-foil-cream">
      <div className="relative mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-4xl">
          Why business owners say yes
        </h2>
        <p className="mt-3 max-w-2xl text-foil-slate">
          The machine is an amenity that runs itself and pays you a cut. Here&apos;s what
          you actually get.
        </p>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {props.map((p) => (
            <li
              key={p.title}
              className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 transition hover:shadow-md hover:shadow-foil-navy/10"
            >
              <h3 className="font-display text-lg font-semibold text-foil-navy">{p.title}</h3>
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
      body: "A quick conversation about your space and your foot traffic. No pressure and no commitment.",
    },
    {
      num: "2",
      title: "We place the machine",
      body: "We size it to your space, deliver it, mount it, stock it, and test it. Install takes about an hour and doesn't disrupt your day.",
    },
    {
      num: "3",
      title: "It runs itself",
      body: "Cashless touchscreen, monitored in real time, with an automatic refund if anything ever misfires. Support is on us, via a code on the machine.",
    },
    {
      num: "4",
      title: "You get paid",
      body: "A monthly revenue share by your preferred method, with sales analytics so you can see exactly how it's doing.",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-4xl">
        How it works
      </h2>
      <p className="mt-3 max-w-2xl text-foil-slate">
        Four steps. The only two on your side are the first conversation and giving the
        machine a few square feet.
      </p>
      <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <li
            key={s.num}
            className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5"
          >
            <span className="font-display inline-flex h-9 w-9 items-center justify-center rounded-full border border-foil-gold/40 bg-foil-gold/10 text-sm font-bold text-foil-navy">
              {s.num}
            </span>
            <h3 className="font-display mt-4 text-lg font-semibold text-foil-navy">{s.title}</h3>
            <p className="mt-2 text-sm text-foil-slate">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function OperatingProof() {
  const points = [
    "Commercial-grade touchscreen machines that describe each pack and do the selling.",
    "Fully cashless, tracked and monitored in real time, with restock alerts before a machine ever runs empty.",
    "A guaranteed-drop refund sensor: pay and get nothing, and you're refunded automatically, on the spot.",
    "A support code on every machine so customers reach us directly, never your staff.",
  ];

  return (
    <section className="border-y border-foil-navy/10 bg-foil-cream">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foil-navy">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-foil-gold" />
              A real operation, not a metal box
            </p>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-4xl">
              Built to run itself, and to be trusted.
            </h2>
            <p className="mt-4 max-w-prose text-foil-slate">
              Foil is run by John Craig, a Level-4 TCGplayer seller, with real, verifiable
              Pokémon-product sourcing behind every machine. We own the machines, stock
              them, and stand behind every transaction. As placements go live, their
              locations and photos get listed here. We won&apos;t show you testimonials we
              don&apos;t have yet.
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

function FaqTeaser() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
      <h2 className="font-display text-3xl font-semibold tracking-[-0.01em] text-foil-navy sm:text-4xl">
        Quick answers
      </h2>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {HOST_FAQ_TEASER.map((faq) => (
          <div
            key={faq.question}
            className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5"
          >
            <h3 className="font-display text-lg font-semibold text-foil-navy">{faq.question}</h3>
            <p className="mt-2 text-sm leading-relaxed text-foil-slate">{faq.answer}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-foil-slate">
        More questions?{" "}
        <Link
          href="/faq"
          className="text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
        >
          Read the full host FAQ →
        </Link>
      </p>
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
          your space and we&apos;ll reach out.
        </p>
      </div>
      <HostLeadForm />
    </section>
  );
}
