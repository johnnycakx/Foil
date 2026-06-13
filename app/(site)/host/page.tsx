// /host — venue-acquisition funnel (Phase V-1, STRATEGY-VENDING-2026-06-12
// §5b playbook, section by section). The differentiated close: every other
// operator cold-pitches hosts with a flyer; Foil pitches with a live site and
// a collector audience.
//
// COPY FIREWALL (strategy §4 rule 1): vending surface. The finder side's
// trust vocabulary is banned in this file (token list in
// lib/__tests__/vending-surfaces.test.ts, which scans full source including
// comments).
// FTC HARD NOs (§5b): no host-income projections, no recurring-income-
// without-work vocabulary, no operator-recruitment content. The published
// terms are a revenue-share percentage band only, never a dollar figure.
// COVERAGE LINE GATED: the §5b playbook wants an operator-carried coverage
// line, but claiming a policy Foil does not hold yet is a fabrication
// (Gate 13). The line lands only after John confirms the policy exists
// (founder-manual item, tracked in SESSION-LOG); a negative test pins its
// absence until then. All rules pinned by lib/__tests__/vending-surfaces.test.ts.

import type { Metadata } from "next";
import Link from "next/link";
import { HostLeadForm } from "@/components/vending/host-lead-form";

export const dynamic = "force-static";
export const revalidate = 86400;

const PAGE_TITLE = "Host a Foil Pokémon card vending machine — it costs you nothing";

const PAGE_DESCRIPTION =
  "Foil places, stocks, and services a Pokémon card vending machine in your business. You give it three square feet and an outlet, and receive a 10–15% revenue share of gross sales, paid monthly.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/host" },
  robots: { index: true, follow: true },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/host",
    type: "website",
  },
};

const WE_DO: string[] = [
  "The machine itself",
  "All inventory, stocked and rotated",
  "Install and setup",
  "Restocking on a schedule",
  "Service and repairs",
  "Card payments",
  "The machine's own page on foiltcg.com",
  "Restock announcements to nearby collectors",
];

const YOU_DO: string[] = ["Three square feet of floor space", "A standard outlet"];

export default function HostPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
      {/* §5b headline register: specificity, zero-cost lead */}
      <header className="mb-14">
        <p className="inline-block rounded-full border border-foil-gold/40 bg-foil-gold/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-foil-navy">
          Host a Foil machine
        </p>
        <h1 className="font-display mt-4 text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-5xl sm:leading-[1.08]">
          A Pokémon card vending machine in your business. It costs you nothing.
        </h1>
        <p className="mt-5 max-w-prose text-base leading-relaxed text-foil-slate sm:text-lg">
          Foil places the machine, keeps it stocked, and keeps it working. You give it
          three square feet and a standard outlet, and receive a share of every sale.
          We operate across the North Bay and East Bay, closest cities first.
        </p>
      </header>

      {/* §5b element 1: the asymmetry block */}
      <section aria-labelledby="host-asymmetry" className="mb-14">
        <h2 id="host-asymmetry" className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          Who does what
        </h2>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-7">
            <p className="text-xs font-medium uppercase tracking-widest text-foil-gold">We do</p>
            <ul className="mt-3 space-y-2">
              {WE_DO.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-foil-navy sm:text-base">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-7">
            <p className="text-xs font-medium uppercase tracking-widest text-foil-gold">You do</p>
            <ul className="mt-3 space-y-2">
              {YOU_DO.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-foil-navy sm:text-base">
                  <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-foil-slate">
              That&apos;s the whole list. You never touch the machine.
            </p>
          </div>
        </div>
      </section>

      {/* §5b element 4 + amenity: traffic with a mechanism, never a number */}
      <section aria-labelledby="host-why" className="mb-14">
        <h2 id="host-why" className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          Why venues say yes
        </h2>
        <div className="mt-5 space-y-5">
          <article className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-7">
            <h3 className="font-display text-lg font-bold tracking-[-0.02em] text-foil-navy">
              An amenity your regulars notice
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-foil-slate sm:text-base">
              Pokémon is multigenerational: the kids collect, and so do the adults who
              grew up on it. A card machine gives the people already in your space one
              more reason to stay, come back, and bring someone with them. It looks
              intentional, not bolted on, and it sells while you work.
            </p>
          </article>
          <article className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-7">
            <h3 className="font-display text-lg font-bold tracking-[-0.02em] text-foil-navy">
              Foot traffic with a mechanism, not a promise
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-foil-slate sm:text-base">
              Collectors find card machines through locator pages and social posts, and
              they travel to them. Every Foil machine gets its own page on foiltcg.com,
              a restock alert list that emails nearby collectors when it&apos;s refilled,
              and restock announcements. We will not quote you a visitor number, because
              nobody can honestly promise one. The mechanism is real, it is already
              built, and it points at your door.
            </p>
          </article>
        </div>
      </section>

      {/* §5b element 2: the published terms — John verdict 2026-06-12, verbatim */}
      <section aria-labelledby="host-terms" className="mb-14">
        <h2 id="host-terms" className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          The terms, in plain text
        </h2>
        <div className="mt-5 rounded-2xl border border-foil-gold/40 bg-foil-gold/10 p-6 sm:p-8">
          <p className="font-display text-2xl font-bold tracking-[-0.02em] text-foil-navy sm:text-3xl">
            10–15% revenue share of gross sales, paid monthly.
          </p>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-foil-slate sm:text-base">
            Where your venue lands in that band is set by foot traffic, agreed before
            install, and written down. There are no fees, no costs, and nothing for you
            to buy, ever. We publish the number because hiding it reads like a
            negotiation trap, and because we would rather you compare us.
          </p>
        </div>
      </section>

      {/* §5b element 5: risk-removal terms in plain sight */}
      <section aria-labelledby="host-risk" className="mb-14">
        <h2 id="host-risk" className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          Try it with an exit ramp
        </h2>
        <ul className="mt-5 space-y-3">
          {[
            "A 60 to 90 day trial period, agreed up front. If it isn't working for your space, we remove the machine and part as friends.",
            "After the trial: a 30-day, no-cause out for you, any time. Your floor, your call.",
            "Restocks on a 7 to 14 day cadence, scheduled around your hours.",
            "If the machine has a problem, we acknowledge it within 24 to 48 hours and handle it. You never service anything.",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5 rounded-2xl border border-foil-navy/10 bg-foil-cream p-4 text-sm leading-relaxed text-foil-navy shadow-sm shadow-foil-navy/5 sm:text-base">
              <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* The real, established infrastructure behind every placement (doc 01
          positioning — lead with what's true and verifiable, not invented scale). */}
      <section aria-labelledby="host-infra" className="mb-14">
        <h2 id="host-infra" className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          The hardware does the work
        </h2>
        <ul className="mt-5 space-y-3">
          {[
            "Commercial-grade touchscreen machines. The screen describes each pack and does the selling; nothing about it needs your attention.",
            "Fully cashless, monitored in real time. Every sale is tracked, and we see when a machine runs low before it ever sits empty.",
            "A guaranteed-drop refund sensor. If a customer pays and product doesn't drop, they're refunded automatically and the screen says so on the spot.",
            "A support code on every machine. Customers report any issue directly to us, never to your staff. You never handle a refund or a complaint.",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5 rounded-2xl border border-foil-navy/10 bg-foil-cream p-4 text-sm leading-relaxed text-foil-navy shadow-sm shadow-foil-navy/5 sm:text-base">
              <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* §5b element 3: operating proof, not promises — no testimonials until real */}
      <section aria-labelledby="host-who" className="mb-14">
        <h2 id="host-who" className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
          Who&apos;s behind it
        </h2>
        <div className="mt-5 rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-7">
          <p className="text-sm leading-relaxed text-foil-slate sm:text-base">
            Foil is run by John Craig, a Level 4 TCGplayer seller — real, verifiable
            Pokémon-product credibility and sourcing behind every machine. We place and
            operate the machines ourselves: we own them, stock them, service them, and
            stand behind every transaction. As placements go live, their locations and
            photos will be listed here. We won&apos;t show you testimonials we don&apos;t
            have yet.
          </p>
        </div>
      </section>

      {/* Internal links (local-SEO + host journey): FAQ + the service-area pages. */}
      <section aria-labelledby="host-more" className="mb-14">
        <h2 id="host-more" className="sr-only">
          Learn more
        </h2>
        <p className="text-sm leading-relaxed text-foil-slate sm:text-base">
          Still deciding? Read the{" "}
          <Link
            href="/faq"
            className="text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
          >
            full host FAQ
          </Link>{" "}
          or see the{" "}
          <Link
            href="/service-areas"
            className="text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
          >
            Bay Area cities we serve
          </Link>
          .
        </p>
      </section>

      {/* §5b lead capture */}
      <section aria-labelledby="host-form">
        <h2 id="host-form" className="sr-only">
          Host lead form
        </h2>
        <HostLeadForm />
      </section>
    </main>
  );
}
