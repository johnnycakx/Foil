// /pro — the Foil Pro offer + checkout CTA.
//
// Copy is the LOCKED offer wording from the 2026-07-11 offer-lock session
// (docs/goals/offer-implementation.md item 3) — two-voice architecture: this
// is a product surface, so Foil the agent speaks in third person. John's
// localhost voice veto is the final gate before push.
//
// PUBLIC route (in lib/supabase/public-routes.ts): ads/visitors land here
// logged-out. Payment-first checkout (offer 1d): the CTA posts straight to
// Stripe Checkout for signed-out buyers too — no /login bounce — and the
// guest success state renders HERE (?checkout=success), because /account
// would redirect a signed-out buyer to /login.
//
// ?hook=drop (offer item 7): ads matched to the drop hook lead with the drop
// card instead of the grail line. Server-side read; default = grail.
import type { Metadata } from "next";
import { createCheckoutSession } from "@/app/upload/billing-actions";
import { PRO_TRIAL_DAYS } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Foil Pro: Foil watches your grails",
  description:
    "Foil watches your grails. You get pinged when one hits your price. The daily deal drop plus unlimited price watches, $6 a month, first 30 days free.",
};

const GRAIL_H1 = "Foil watches your grails. You get pinged when one hits your price.";
const GRAIL_SUB =
  "Set a card and a target. Foil checks the market and emails you the moment a real listing hits it. Sold prices, not asking prices.";
const DROP_TITLE = "The daily deal drop";
const DROP_BODY =
  "Foil scans the singles market every day and sends only the buys worth it. On a quiet day it says so. No filler.";
const WATCHES_TITLE = "Price watches on your chase list";
const WATCHES_BODY = "Add every card you're chasing. Pro checks hourly. Free checks once a day.";
const TRUST_LINE = "Foil doesn't guess prices. It reads real sales.";
const FOUNDING_LINE =
  "$6 a month, locked. The price rises as Foil gets faster. Founding members keep their rate for life and get everything new first.";
const FREE_CATCHER = "Not ready? Free gets you 3 watches and the weekly digest.";

function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
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

  const h1 = hook === "drop" ? DROP_BODY : GRAIL_H1;
  const sub = hook === "drop" ? GRAIL_H1 : GRAIL_SUB;

  return (
    <main data-tone="night" className="relative flex-1 bg-foil-night text-foil-cream">
      <div className="relative mx-auto w-full max-w-xl px-5 pt-14 pb-24 sm:px-8">
        {params.checkout === "canceled" && (
          <div className="mb-6 rounded-xl border border-foil-cream/15 bg-foil-night-2 px-4 py-3 text-sm text-foil-cream/70">
            No charge made. Your checkout was canceled, start the free trial whenever you're ready.
          </div>
        )}
        {params.checkout === "success" && (
          <div className="mb-6 rounded-xl border border-foil-accent/40 bg-foil-night-2 px-4 py-3 text-sm text-foil-cream">
            You're in. Check your email for your sign-in link, then add the cards you're chasing.
          </div>
        )}

        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-foil-accent">Foil Pro</p>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-[-0.02em] text-foil-cream">
            {h1}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-foil-cream/60">{sub}</p>
        </header>

        <section className="mt-10 rounded-2xl border border-foil-cream/12 bg-foil-night-2 p-6 sm:p-8">
          <div className="flex items-baseline justify-center gap-2">
            <span className="font-display text-5xl font-bold tabular-nums text-foil-cream">$6</span>
            <span className="text-foil-cream/60">/ month</span>
          </div>
          <p className="mt-2 text-center text-sm text-foil-accent">
            First {PRO_TRIAL_DAYS} days free · card required · cancel anytime
          </p>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm text-foil-cream/60">{FOUNDING_LINE}</p>

          <form action={createCheckoutSession} className="mt-6">
            {attribution.map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            {hook === "drop" && <input type="hidden" name="hook" value="drop" />}
            <button
              type="submit"
              className="w-full rounded-xl bg-foil-accent px-5 py-3.5 text-base font-semibold text-foil-night transition hover:brightness-110"
            >
              Start your {PRO_TRIAL_DAYS}-day free trial
            </button>
          </form>
          <p className="mt-3 text-center text-xs text-foil-cream/50">
            You'll enter a card, but you won't be charged until the trial ends.
          </p>
          <p className="mt-2 text-center text-xs text-foil-cream/50">
            {FREE_CATCHER}{" "}
            <a href="/start" className="underline decoration-foil-cream/30 underline-offset-2 hover:text-foil-cream">
              Start free →
            </a>
          </p>
        </section>

        {/* hook=drop already leads with the drop line as the H1 — repeating
            the identical card below it reads as a copy bug, so that variant
            shows only the watches card, full width. */}
        <section className={`mt-8 grid gap-3 ${hook === "drop" ? "" : "sm:grid-cols-2"}`}>
          {hook !== "drop" && (
            <div className="rounded-xl border border-foil-cream/10 bg-foil-night-2 p-5">
              <p className="font-semibold text-foil-cream">{DROP_TITLE}</p>
              <p className="mt-1.5 text-sm text-foil-cream/60">{DROP_BODY}</p>
            </div>
          )}
          <div className="rounded-xl border border-foil-cream/10 bg-foil-night-2 p-5">
            <p className="font-semibold text-foil-cream">{WATCHES_TITLE}</p>
            <p className="mt-1.5 text-sm text-foil-cream/60">{WATCHES_BODY}</p>
          </div>
        </section>

        <p className="mt-8 text-center text-sm font-medium text-foil-cream/70">{TRUST_LINE}</p>
        <p className="mt-2 text-center text-xs text-foil-cream/50">
          Every figure is a real recent sold average. We only show a price when enough copies
          actually sold, and never an asking price.
        </p>
      </div>
    </main>
  );
}
