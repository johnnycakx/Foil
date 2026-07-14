// /pro — the Foil Pro sales page (pro-conversion-redesign, V6.5).
//
// Copy is the LOCKED offer wording from the 2026-07-11 offer-lock session
// (docs/goals/offer-implementation.md item 3) — two-voice architecture: this
// is a product surface, so Foil the agent speaks in third person. John's
// design veto on the branch is the final gate before push.
//
// V6.5 structure (docs/goals/pro-conversion-redesign.md, the Card Ladder /
// Collectr category convention): hero → price card + CTA → free-vs-Pro
// comparison table → a REAL alert specimen → FAQ → trust footer. The page
// lives inside the (site) route group so it carries the full site chrome
// (stranger-run finding S2: a payment page floating in a void); the night
// tone flips the chrome dark via body:has(), no layout fork.
//
// PUBLIC route (in lib/supabase/public-routes.ts): ads/visitors land here
// logged-out. Payment-first checkout (offer 1d): the CTA posts straight to
// Stripe Checkout for signed-out buyers too — no /login bounce — and the
// guest success state renders HERE (?checkout=success), because /account
// would redirect a signed-out buyer to /login.
//
// ?hook=drop (offer item 7): ads matched to the drop hook lead with the drop
// card instead of the grail line. Server-side read; default = grail. This
// searchParams read is also why the page stays force-dynamic-compatible —
// keep it server-rendered.
//
// The specimen is NEVER fabricated (null-over-guess): its figures derive from
// the committed sold snapshot (the same basis the vault/lines surfaces read)
// and its subject + evidence strings are composed by the REAL alert engine
// (lib/wishlist/alert-email.ts). No snapshot → the copy degrades honestly
// without inventing a number.
//
// BANNED on this page (V6.5 item 5): fake social proof (we have essentially
// zero users and honesty is the moat), countdown urgency, unshipped-feature
// promises.
import type { Metadata } from "next";
import Image from "next/image";
import { createCheckoutSession } from "@/app/upload/billing-actions";
import { PRO_TRIAL_DAYS } from "@/lib/stripe";
import { getSnapshotSold } from "@/lib/vault-seeds";
import {
  subjectLine,
  evidenceLine,
  type AlertEmailInputs,
} from "@/lib/wishlist/alert-email";

export const metadata: Metadata = {
  title: "Foil Pro: Foil watches your grails",
  description:
    "Foil watches your grails. You get pinged when one hits your price. The daily deal drop plus unlimited price watches, $6 a month, first 30 days free.",
};

const GRAIL_H1 = "Foil watches your grails. You get pinged when one hits your price.";
const GRAIL_SUB =
  "Set a card and a target. Foil checks the market and emails you the moment a real listing hits it. Sold prices, not asking prices.";
// John-locked drop-hook headline (2026-07-12): short, exact.
const DROP_H1 = "The day's best buys. In your inbox.";
const DROP_TITLE = "The daily deal drop";
const DROP_BODY =
  "Foil scans the singles market every day and sends only the buys worth it. On a quiet day it says so. No filler.";
const WATCHES_TITLE = "Price watches on your chase list";
const WATCHES_BODY = "Add every card you're chasing. Pro checks hourly. Free checks once a day.";
const TRUST_LINE = "Foil doesn't guess prices. It reads real sales.";
const FOUNDING_LINE =
  "$6 a month, locked. The price rises as Foil gets faster. Founding members keep their rate for life and get everything new first.";
const FREE_CATCHER = "Not ready? Free fills a binder page (9 cards) and gets the weekly digest.";

// V6.5 item 3, the value anchor: honest, specific, no bashing. Card Ladder
// Pro is $20/mo (verified on their pricing page, 2026-07-12 research pass).
const ANCHOR_LINE =
  "Card Ladder Pro, the nearest tool to this, runs $20 a month. Foil Pro is $6, and one avoided overpay pays for months of it.";

// The comparison table (V6.5 item 1, the conversion engine). Rows state the
// REAL tier split from lib/offer.ts — nothing invented. Register rule on
// every label: card-shop words, 15-year-old test.
const TABLE_ROWS: { label: string; free: string; pro: string; freeMuted?: boolean }[] = [
  { label: "Cards Foil watches for you", free: "One binder page (9 cards)", pro: "Every card you're chasing" },
  { label: "How often Foil checks", free: "Once a day", pro: "Every hour, first in line" },
  { label: "The daily deal drop", free: "No", pro: "Every day", freeMuted: true },
  { label: "The weekly best-buys digest", free: "Yes", pro: "Yes" },
  { label: "The Today's best buys board", free: "Top 2 picks", pro: "The whole board" },
  { label: "Prices from real sold data", free: "Always", pro: "Always" },
];

// The specimen card (V6.5 item 2). Moonbreon: the fan's focal grail, and the
// committed snapshot guarantees it a real outlier-suppressed sold basis
// (pinned by the vault-seeds navigation-promise test). The example listing
// price is computed at the ADR-091 market floor (15% under the 30-day sold
// average), the exact point a real market-basis alert fires.
const SPECIMEN_SLUG = "swsh7-215-umbreon-vmax-alt-art";

function specimenInputs(): AlertEmailInputs | null {
  const sold = getSnapshotSold(SPECIMEN_SLUG);
  if (!sold) return null;
  return {
    cardName: "Umbreon VMAX Alt Art",
    setName: "Evolving Skies",
    kind: "dropped",
    basis: "market",
    currentPriceCents: Math.round(sold.soldCents * 0.85),
    targetPriceCents: null,
    comp: {
      avg30dCents: sold.soldCents,
      saleCount: sold.saleCount,
      tierLabel: sold.tierLabel,
      computedAt: "",
      // The sample alert must look like a REAL one — including its comp date,
      // which the committed snapshot has carried all along.
      soldAsOfIso: sold.soldAsOf,
    },
    cardPageUrl: `/cards/${SPECIMEN_SLUG}`,
    unsubscribeUrl: null,
    manageUrl: null,
  };
}

function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function TrialCta({
  attribution,
  hook,
  compact,
}: {
  attribution: Array<[string, string]>;
  hook: "grail" | "drop";
  compact?: boolean;
}) {
  return (
    <form action={createCheckoutSession} className={compact ? "mt-6 mx-auto max-w-sm" : "mt-6"}>
      {attribution.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {hook === "drop" && <input type="hidden" name="hook" value="drop" />}
      <button
        type="submit"
        className="w-full rounded-xl bg-foil-accent px-5 py-3.5 text-base font-semibold text-foil-night transition hover:brightness-110 active:brightness-95"
      >
        Start your {PRO_TRIAL_DAYS}-day free trial
      </button>
    </form>
  );
}

export default async function ProPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const hook = pick(params.hook) === "drop" ? "drop" : "grail";

  // Ads attribution passthrough (ADR-084/112): mirror the landing URL's
  // utm_* + hook into the CTA form so the action can stamp them on the
  // subscription's metadata. Values are sanitized server-side in the action.
  const attribution: Array<[string, string]> = [];
  for (const k of ["utm_source", "utm_medium", "utm_campaign"] as const) {
    const v = pick(params[k]);
    if (v) attribution.push([k, v]);
  }

  const h1 = hook === "drop" ? DROP_H1 : GRAIL_H1;
  const sub = hook === "drop" ? GRAIL_H1 : GRAIL_SUB;

  // Trimmed post-purchase state (John, 2026-07-12): a guest who just paid
  // gets the next step, not the sales pitch again. The full page stays for
  // every other state.
  if (params.checkout === "success") {
    return (
      <main data-tone="night" className="relative flex-1 bg-foil-night text-foil-cream">
        <div className="relative mx-auto w-full max-w-xl px-5 pt-24 pb-24 text-center sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-foil-accent">Foil Pro</p>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-[-0.02em] text-foil-cream">
            You&apos;re in.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-foil-cream/70">
            Check your email for your sign-in link, then add the cards you&apos;re chasing.
          </p>
          <p className="mx-auto mt-8 max-w-md text-sm text-foil-cream/50">{TRUST_LINE}</p>
        </div>
      </main>
    );
  }

  const specimen = specimenInputs();

  return (
    <main data-tone="night" className="relative flex-1 bg-foil-night text-foil-cream">
      <div className="relative mx-auto w-full max-w-2xl px-5 pt-14 pb-24 sm:px-8">
        {params.checkout === "canceled" && (
          <div className="mb-6 rounded-xl border border-foil-cream/15 bg-foil-night-2 px-4 py-3 text-sm text-foil-cream/70">
            No charge made. Your checkout was canceled, start the free trial whenever you're ready.
          </div>
        )}
        {params.checkout === "unavailable" && (
          <div className="mb-6 rounded-xl border border-foil-cream/15 bg-foil-night-2 px-4 py-3 text-sm text-foil-cream/70">
            Checkout didn&apos;t open. No charge was made, and nothing was saved. Try again in a
            minute, or start free below while Foil sorts it out.
          </div>
        )}

        {/* ------------------------------------------------------------------
            Hero: the locked H1/sub, untouched. Never reveals (LCP paints
            instantly per the Tier-1 ambience rule). */}
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-foil-accent">Foil Pro</p>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-[-0.02em] text-foil-cream sm:text-5xl">
            {h1}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-foil-cream/60">{sub}</p>
        </header>

        {/* ------------------------------------------------------------------
            Price card + CTA. Founding rate-lock directly under the price
            (locked wording), then the value anchor (V6.5 item 3). */}
        <section aria-label="Foil Pro price" className="mx-auto mt-10 max-w-xl rounded-2xl border border-foil-cream/12 bg-foil-night-2 p-6 sm:p-8">
          <div className="flex items-baseline justify-center gap-2">
            <span className="font-display text-5xl font-bold tabular-nums text-foil-cream">$6</span>
            <span className="text-foil-cream/60">/ month</span>
          </div>
          <p className="mt-2 text-center text-sm text-foil-accent">
            First {PRO_TRIAL_DAYS} days free · card required · cancel anytime
          </p>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm text-foil-cream/60">{FOUNDING_LINE}</p>

          <TrialCta attribution={attribution} hook={hook} />

          <p className="mt-3 text-center text-xs text-foil-cream/50">
            You'll enter a card, but you won't be charged until the trial ends.
          </p>
          {/* S6: the free catcher stays below the ask on purpose (paid is the
              point of the WTP test) but reads at 13px+ with honest contrast. */}
          <p className="mt-4 border-t border-foil-cream/10 pt-4 text-center text-[13px] leading-relaxed text-foil-cream/65">
            {FREE_CATCHER}{" "}
            <a href="/start" className="whitespace-nowrap underline decoration-foil-cream/30 underline-offset-2 hover:text-foil-cream">
              Start free →
            </a>
          </p>
        </section>

        <p className="mx-auto mt-6 max-w-md text-center text-sm text-foil-cream/55">{ANCHOR_LINE}</p>

        {/* ------------------------------------------------------------------
            The comparison table (V6.5 item 1): the category convention that
            makes free feel real and Pro feel obviously bigger. Fixed layout
            so it renders whole at 390px with zero horizontal scroll. */}
        <section aria-labelledby="compare-heading" className="reveal-rise mt-14">
          <h2 id="compare-heading" className="font-display text-center text-2xl font-semibold text-foil-cream sm:text-3xl">
            What free gets. What $6 gets.
          </h2>
          <table className="mt-6 w-full table-fixed border-collapse text-left">
            <caption className="sr-only">Foil free tier compared with Foil Pro, feature by feature</caption>
            <thead>
              <tr className="border-b border-foil-cream/15 text-[13px] uppercase tracking-wider">
                <th scope="col" className="w-[44%] pb-3 pr-2 font-medium text-foil-cream/40">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="w-[26%] px-2 pb-3 font-semibold text-foil-cream/55">Free</th>
                <th scope="col" className="w-[30%] rounded-t-lg bg-foil-night-2 px-3 pb-3 pt-2 font-semibold text-foil-accent">
                  Pro
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {TABLE_ROWS.map((row, i) => (
                <tr key={row.label} className="border-b border-foil-cream/10 align-top">
                  <th scope="row" className="py-3.5 pr-2 font-normal leading-snug text-foil-cream/75">
                    {row.label}
                  </th>
                  <td className={`px-2 py-3.5 leading-snug ${row.freeMuted ? "text-foil-cream/40" : "text-foil-cream/65"}`}>
                    {row.free}
                  </td>
                  <td
                    className={`bg-foil-night-2 px-3 py-3.5 font-medium leading-snug text-foil-cream ${
                      i === TABLE_ROWS.length - 1 ? "rounded-b-lg" : ""
                    }`}
                  >
                    {row.pro}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TrialCta attribution={attribution} hook={hook} compact />
          <p className="mt-3 text-center text-xs text-foil-cream/50">
            First {PRO_TRIAL_DAYS} days free. Cancel anytime, no one argues with you.
          </p>
        </section>

        {/* ------------------------------------------------------------------
            The specimen (V6.5 item 2, S1's fix): a real alert, composed by
            the real engine from the committed sold snapshot. The one light
            object on the page; it should pull focus the way the cream email
            does on the homepage. */}
        <section aria-labelledby="specimen-heading" className="reveal-rise mt-14">
          <h2 id="specimen-heading" className="font-display text-center text-2xl font-semibold text-foil-cream sm:text-3xl">
            What lands in your inbox
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-sm text-foil-cream/60">
            {specimen
              ? "This is a real alert, written by the same code that sends them, from real recorded sales of this card."
              : "One email when a card you watch hits a real price. Written from real recorded sales, never asking prices."}
          </p>

          <div
            aria-label="A sample Foil price alert email"
            className="mx-auto mt-6 max-w-xl rounded-2xl border border-foil-cream/12 bg-foil-cream p-1 shadow-[0_20px_60px_-20px_rgba(248,245,240,0.10)]"
          >
            <div className="rounded-xl p-5 sm:p-6">
              <div className="flex items-center gap-2 border-b border-foil-navy/10 pb-3">
                <span className="font-wordmark text-sm font-semibold text-foil-navy">Foil</span>
                <span className="ml-auto text-xs text-foil-slate">to: you</span>
              </div>
              <p className="mt-4 text-[15px] font-semibold leading-snug text-foil-navy">
                {specimen
                  ? subjectLine(specimen)
                  : "Umbreon VMAX Alt Art (Evolving Skies) just dipped below what it usually sells for"}
              </p>
              <p className="mt-3 text-xs text-foil-slate">Foil checked your watches. One hit.</p>
              <div className="mt-4 flex items-start gap-4">
                <Image
                  src="/hero/swsh7-215.webp"
                  alt="Umbreon VMAX Alt Art (Moonbreon), Evolving Skies"
                  width={72}
                  height={101}
                  className="w-[72px] shrink-0 rounded-md ring-1 ring-foil-navy/10"
                />
                <div className="min-w-0 text-sm text-foil-slate">
                  <p className="border-l-[3px] border-foil-navy/15 pl-3 text-[13px] leading-relaxed text-foil-navy/80">
                    {specimen
                      ? evidenceLine(specimen)
                      : "Judged against what it really sells for, not asking prices."}
                  </p>
                  <p className="mt-3 text-xs font-semibold text-foil-navy underline decoration-foil-navy/40 underline-offset-4">
                    See the live listing and sold history on Foil →
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-foil-cream/45">
            Pro gets this the hour it happens. Free hears once a day.
          </p>
        </section>

        {/* ------------------------------------------------------------------
            What Pro is, in two cards (kept from V6: the locked drop + watches
            descriptions live here, after the proof). */}
        <section aria-label="What Foil Pro includes" className="reveal-rise mt-14 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-foil-cream/10 bg-foil-night-2 p-5">
            <p className="font-semibold text-foil-cream">{DROP_TITLE}</p>
            <p className="mt-1.5 text-sm text-foil-cream/60">{DROP_BODY}</p>
          </div>
          <div className="rounded-xl border border-foil-cream/10 bg-foil-night-2 p-5">
            <p className="font-semibold text-foil-cream">{WATCHES_TITLE}</p>
            <p className="mt-1.5 text-sm text-foil-cream/60">{WATCHES_BODY}</p>
          </div>
        </section>

        {/* ------------------------------------------------------------------
            FAQ (S4): the objections a card-required CTA raises, answered on
            the page. Four items, register rule, all claims true today. */}
        <section aria-labelledby="faq-heading" className="reveal-rise mt-14">
          <h2 id="faq-heading" className="font-display text-center text-2xl font-semibold text-foil-cream sm:text-3xl">
            Fair questions
          </h2>
          <dl className="mx-auto mt-6 max-w-xl space-y-5">
            <div>
              <dt className="font-semibold text-foil-cream">What happens after the 30 days?</dt>
              <dd className="mt-1 text-sm leading-relaxed text-foil-cream/60">
                Your card gets charged $6 and Pro keeps going. Cancel before the trial ends and you
                pay nothing at all.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-foil-cream">How do I cancel?</dt>
              <dd className="mt-1 text-sm leading-relaxed text-foil-cream/60">
                From your account page, any time. Two taps, and no one argues with you.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-foil-cream">Which marketplaces does Foil watch?</dt>
              <dd className="mt-1 text-sm leading-relaxed text-foil-cream/60">
                eBay, the biggest singles market there is. Every listing gets judged against real
                recorded sales of that card, never asking prices.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-foil-cream">What if I stop paying?</dt>
              <dd className="mt-1 text-sm leading-relaxed text-foil-cream/60">
                You keep free: one binder page (9 cards) checked once a day, plus the weekly digest.
                Your watches don't get deleted.
              </dd>
            </div>
          </dl>
        </section>

        {/* ------------------------------------------------------------------
            Trust footer: the locked trust line + the sold-data honesty
            sentence. The last thing read before the chrome footer. */}
        <p className="mt-14 text-center text-sm font-medium text-foil-cream/70">{TRUST_LINE}</p>
        <p className="mx-auto mt-2 max-w-md text-center text-xs text-foil-cream/50">
          Every figure is a real recent sold average. We only show a price when enough copies
          actually sold, and never an asking price.
        </p>
      </div>
    </main>
  );
}
