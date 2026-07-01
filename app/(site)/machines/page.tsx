// /machines — vending locator hub (Phase V-1, STRATEGY-VENDING-2026-06-12).
// Pre-placement state: honest "no locations live yet" + convenience value
// prop + restock-alert email capture. Per-location cards render automatically
// once MACHINE_LOCATIONS gains entries (Phase V-2); this page is also the GBP
// "website store locator" requirement when listings exist.
//
// COPY FIREWALL (strategy §4 rule 1): vending surface. The trust vocabulary
// of the finder side of the site must not appear in this file (the banned
// token list lives in lib/__tests__/vending-surfaces.test.ts, which scans
// this file's full source — comments included); machine product is framed as
// CONVENIENCE only. The same test pins the import firewall: nothing here may
// touch lib/listing, lib/buy-signal, or lib/affiliate.

import type { Metadata } from "next";
import Link from "next/link";
import { MACHINE_LOCATIONS, UPCOMING_REGION } from "@/lib/vending/machines";
import { RestockAlertForm } from "@/components/vending/restock-alert-form";

export const dynamic = "force-static";
export const revalidate = 86400;

const PAGE_TITLE = "Foil Pokémon card vending machines — locations + restock alerts";

const PAGE_DESCRIPTION =
  "Sealed Pokémon TCG product from a machine, in person, today. Machine locations, hours, and restock alerts. The first Foil machine is being placed now.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/machines" },
  // Indexable per ADR-064 (dual-track restore). NOTE: this buyer-facing locator
  // still shows "no locations live yet" (machine #1 not placed), so it carries
  // no organic history to recover and is intentionally NOT in the sitemap.
  // Recommendation (SESSION-LOG 2026-06-23): consider re-noindexing until a
  // machine is live to avoid thin-content crawling — left indexable per goal.
  robots: { index: true, follow: true },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/machines",
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

const VALUE_PROPS: { heading: string; body: string }[] = [
  {
    heading: "Walk up and buy",
    body:
      "Sealed packs and product, in person, today. Machine prices carry a convenience premium over what the same product goes for online, and we say so on the machine itself. Every machine also carries a per-customer purchase limit, printed where you can see it, so there is stock left when you walk up.",
  },
  {
    heading: "Restock alerts, built in from day one",
    body:
      "Every Foil machine gets its own page and its own restock list. When a machine is refilled, the people watching it hear first, by email. Even the official machines can't tell you when they've been refilled; ours are designed around exactly that.",
  },
  {
    heading: "Price-check anything, right at the machine",
    body:
      "A code on every machine opens Foil's live price view, so you can see what the same product goes for online before you put money in. We would rather show you the gap than have you find it later.",
  },
];

export default function MachinesPage() {
  const regionLine = UPCOMING_REGION
    ? `Machines are coming to ${UPCOMING_REGION}.`
    : "The first Foil machine is being placed now.";

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
      <header className="mb-14">
        <p className="inline-block rounded-full border border-foil-gold/40 bg-foil-gold/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foil-navy">
          Foil machines
        </p>
        <h1 className="font-display mt-4 text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-5xl sm:leading-[1.08]">
          Sealed Pokémon product, in your hands now.
        </h1>
        <p className="mt-5 max-w-prose text-base leading-relaxed text-foil-slate sm:text-lg">
          Foil is putting Pokémon TCG vending machines into real locations: stocked with
          sealed product, restocked on a schedule, and priced for the convenience of
          buying on the spot. The Foil site is built for patient price-hunting; the
          machines are built for right now. Two different products, and we keep them
          honest about each other.
        </p>
      </header>

      <section aria-labelledby="machines-where" className="mb-14">
        <h2 id="machines-where" className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          Where the machines are
        </h2>
        {MACHINE_LOCATIONS.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-7">
            <p className="text-base leading-relaxed text-foil-navy">
              <span className="font-semibold">{regionLine}</span> No locations are live
              yet. When the first one lands, it will be listed here with its address,
              hours, and what&apos;s inside.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foil-slate">
              Leave your email below and tell us your city. You&apos;ll hear the moment a
              machine lands near you, and your city is a real input to where the next
              one goes.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {MACHINE_LOCATIONS.map((loc) => (
              <li
                key={loc.slug}
                className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5"
              >
                <p className="text-xs font-medium uppercase tracking-widest text-foil-gold">
                  {loc.status === "live" ? "Live" : loc.status === "installing" ? "Installing" : "Announced"}
                </p>
                <h3 className="font-display mt-1 text-lg font-bold tracking-[-0.02em] text-foil-navy">
                  {loc.name}
                </h3>
                <p className="mt-1 text-sm text-foil-slate">
                  {loc.venueName} · {loc.addressLines.join(", ")} · {loc.city}, {loc.region}
                </p>
                <p className="mt-1 text-sm text-foil-slate">{loc.hours}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="machines-why" className="mb-14">
        <h2 id="machines-why" className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          What a Foil machine is for
        </h2>
        <div className="mt-5 space-y-5">
          {VALUE_PROPS.map((v) => (
            <article
              key={v.heading}
              className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-7"
            >
              <h3 className="font-display text-lg font-bold tracking-[-0.02em] text-foil-navy">
                {v.heading}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foil-slate sm:text-base">{v.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-5 text-sm leading-relaxed text-foil-slate">
          The full machine pricing policy, including the rule that machine inventory
          never influences what this site shows, is published on the{" "}
          <Link
            href="/pricing-methodology"
            className="underline decoration-foil-navy/20 underline-offset-4 transition hover:text-foil-navy hover:decoration-foil-gold"
          >
            pricing methodology page
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="machines-signup" className="mb-14">
        <h2 id="machines-signup" className="sr-only">
          Restock alert signup
        </h2>
        <RestockAlertForm />
      </section>

      <section
        aria-labelledby="machines-host"
        className="rounded-2xl border border-foil-gold/40 bg-foil-gold/10 p-6 sm:p-8"
      >
        <h2 id="machines-host" className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          Run a business? Host a machine.
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-foil-slate sm:text-base">
          Foil supplies, stocks, and services the machine; you give it three square feet
          and an outlet, and collect a share of every sale. Collectors travel to card
          machines, and every Foil machine points them at its host venue.
        </p>
        <Link
          href="/host"
          className="mt-5 inline-block rounded-xl bg-foil-navy px-6 py-3 text-base font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40"
        >
          See the hosting terms
        </Link>
      </section>
    </main>
  );
}
