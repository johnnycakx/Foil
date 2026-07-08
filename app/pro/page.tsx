// /pro — the Foil Pro offer + checkout CTA (validation-sprint Phase 2, ADR-111).
//
// This is the RAIL, not the pitch. The offer wording is decided in the upcoming
// Fable offer-lock session; this page exists so a $6/mo + 30-day-trial Checkout
// can be exercised end-to-end. Copy here is function-first and FLAGGED for
// John's voice veto — do not treat it as locked.
//
// PUBLIC route (in lib/supabase/public-routes.ts): ads/visitors land here
// logged-out. The CTA posts to createCheckoutSession, which self-gates —
// getUser() null → redirect("/login") — so nothing here needs an auth check.
import type { Metadata } from "next";
import { createCheckoutSession } from "@/app/upload/billing-actions";
import { PRO_TRIAL_DAYS } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Foil Pro — watch your grails, priced on real sales",
  description:
    "The daily deal drop plus personal price watches. $6/mo, first 30 days free (card required). Priced on real sold data, not asking prices.",
};

export default async function ProPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;

  return (
    <main data-tone="night" className="relative flex-1 bg-foil-night text-foil-cream">
      <div className="relative mx-auto w-full max-w-xl px-5 pt-14 pb-24 sm:px-8">
        {params.checkout === "canceled" && (
          <div className="mb-6 rounded-xl border border-foil-cream/15 bg-foil-night-2 px-4 py-3 text-sm text-foil-cream/70">
            No charge made — your checkout was canceled. Start the free trial whenever you're ready.
          </div>
        )}

        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-foil-accent">Foil Pro</p>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-[-0.02em] text-foil-cream">
            Watch your grails. Get pinged the second one hits your price.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-foil-cream/60">
            The daily deal drop plus personal price watches on the cards you're chasing — every alert
            priced on real sold data, not asking prices.
          </p>
        </header>

        <section className="mt-10 rounded-2xl border border-foil-cream/12 bg-foil-night-2 p-6 sm:p-8">
          <div className="flex items-baseline justify-center gap-2">
            <span className="font-display text-5xl font-bold tabular-nums text-foil-cream">$6</span>
            <span className="text-foil-cream/60">/ month</span>
          </div>
          <p className="mt-2 text-center text-sm text-foil-accent">
            First {PRO_TRIAL_DAYS} days free · card required · cancel anytime
          </p>

          <form action={createCheckoutSession} className="mt-6">
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
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-foil-cream/10 bg-foil-night-2 p-5">
            <p className="font-semibold text-foil-cream">The daily deal drop</p>
            <p className="mt-1.5 text-sm text-foil-cream/60">
              The best live buys across the market, curated daily. On a quiet day we say so — no filler.
            </p>
          </div>
          <div className="rounded-xl border border-foil-cream/10 bg-foil-night-2 p-5">
            <p className="font-semibold text-foil-cream">Personal price watches</p>
            <p className="mt-1.5 text-sm text-foil-cream/60">
              Add the cards you're chasing and a target. We watch them and email you the moment one hits.
            </p>
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-foil-cream/50">
          Every figure is a real recent sold average — sample-size gated, never an asking price.
        </p>
      </div>
    </main>
  );
}
