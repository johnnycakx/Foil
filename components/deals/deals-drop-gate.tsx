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
        <p className="font-semibold text-foil-cream">You&apos;re in — the drop lands in your inbox.</p>
        <p className="mt-1 text-sm text-foil-cream/70">
          The day&apos;s best buys, priced on real sold data. Quiet day? We&apos;ll tell you that too.
        </p>
      </div>
    );
  }

  const errorId = "deals-drop-error";

  return (
    <section className="rounded-2xl border border-foil-cream/12 bg-foil-night-2 p-6 text-center sm:p-8">
      <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-foil-cream">{headline}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-foil-cream/70">{subtext}</p>

      <form onSubmit={onSubmit} className="mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row" noValidate>
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
          {isPending ? "Joining…" : "Get the drop"}
        </button>
      </form>
      <p className="mt-3 text-xs text-foil-cream/50">Free · one email a day at most · unsubscribe anytime.</p>
      {state?.ok === false && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-foil-cream">
          {state.error}
        </p>
      )}
    </section>
  );
}
