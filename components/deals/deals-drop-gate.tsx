"use client";

// The /deals email gate (validation-sprint Phase 3, ADR-112). Sits under the
// top-2 teaser + the locked rows and converts the "there's more" moment into a
// drop subscribe. Reuses the ADR-090 tri-store path (subscribeAction → Beehiiv
// + owned Supabase list + Resend) and the ADR-084 UTM forwarding (mirror the
// landing URL's utm_*/?src= into hidden fields) so a /deals?utm_source=reddit
// signup is attributed. source="deals_gate" tags the capture surface.

import { useEffect, useState, useTransition } from "react";
import { subscribeAction, type SubscribeActionResult } from "@/app/actions/subscribe";

export function DealsDropGate({ headline, subtext }: { headline: string; subtext: string }) {
  const [state, setState] = useState<SubscribeActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [utm, setUtm] = useState({ source: "", medium: "", campaign: "" });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    setUtm({
      source: p.get("utm_source") ?? p.get("src") ?? "",
      medium: p.get("utm_medium") ?? "",
      campaign: p.get("utm_campaign") ?? "",
    });
  }, []);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await subscribeAction(data);
      setState(result);
      if (result.ok) form.reset();
    });
  };

  if (state?.ok) {
    return (
      <div
        className="rounded-2xl border border-foil-accent/40 bg-foil-accent/10 p-6 text-center"
        aria-live="polite"
      >
        <p className="font-semibold text-foil-cream">You&apos;re in. The weekly digest is on its way.</p>
        <p className="mt-1 text-sm text-foil-cream/70">
          The week&apos;s best real buys, priced on real sold data. Quiet week? Foil says so. Want
          Foil watching your own cards too?{" "}
          <a href="/start" className="underline decoration-foil-cream/40 underline-offset-2">
            Free fills a binder page →
          </a>
        </p>
      </div>
    );
  }

  const errorId = "deals-drop-error";
  const proHref = utm.source
    ? `/pro?hook=drop&utm_source=${encodeURIComponent(utm.source)}${utm.medium ? `&utm_medium=${encodeURIComponent(utm.medium)}` : ""}${utm.campaign ? `&utm_campaign=${encodeURIComponent(utm.campaign)}` : ""}`
    : "/pro?hook=drop";

  return (
    <section className="rounded-2xl border border-foil-cream/12 bg-foil-night-2 p-6 text-center sm:p-8">
      <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-foil-cream">{headline}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-foil-cream/70">{subtext}</p>

      <a
        href={proHref}
        className="mt-5 inline-block rounded-xl bg-foil-accent px-5 py-3 text-base font-semibold text-foil-night transition-all hover:-translate-y-0.5 hover:brightness-110"
      >
        Start your 30-day free trial
      </a>
      <p className="mt-2 text-xs text-foil-cream/50">
        The full daily drop plus unlimited watches, checked hourly. $6 a month after the trial.
      </p>

      <p className="mt-6 text-sm text-foil-cream/70">Not ready? Free fills a binder page (9 cards) and gets the weekly digest.</p>
      <form onSubmit={onSubmit} className="mx-auto mt-3 flex max-w-md flex-col gap-2 sm:flex-row" noValidate>
        <input type="hidden" name="source" value="deals_gate" />
        <input type="hidden" name="utm_source" value={utm.source} />
        <input type="hidden" name="utm_medium" value={utm.medium} />
        <input type="hidden" name="utm_campaign" value={utm.campaign} />
        <label htmlFor="deals-drop-email" className="sr-only">
          Email address
        </label>
        <input
          id="deals-drop-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@gmail.com"
          disabled={isPending}
          className="min-w-0 flex-1 rounded-xl border border-foil-cream/20 bg-foil-night px-4 py-3 text-base text-foil-cream placeholder:text-foil-cream/40 outline-none transition focus:border-foil-accent focus:ring-2 focus:ring-foil-accent/30 disabled:opacity-60"
          aria-invalid={state?.ok === false}
          aria-describedby={state?.ok === false ? errorId : undefined}
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-foil-accent px-5 py-3 text-base font-semibold text-foil-night transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {isPending ? "Joining…" : "Get the digest"}
        </button>
      </form>
      <p className="mt-3 text-xs text-foil-cream/50">Free · one email a week · unsubscribe anytime.</p>
      {state?.ok === false && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-foil-cream">
          {state.error}
        </p>
      )}
    </section>
  );
}
