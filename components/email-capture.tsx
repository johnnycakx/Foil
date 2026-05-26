"use client";

import { useState, useTransition } from "react";
import { subscribeAction, type SubscribeActionResult } from "@/app/actions/subscribe";

type Variant = "inline" | "footer";

const DEFAULT_HEADLINES: Record<Variant, string> = {
  inline: "Get Pokémon TCG market reads twice a week.",
  footer: "Subscribe to the Foil newsletter.",
};

export function EmailCapture({
  source,
  variant,
  headline,
}: {
  source: string;
  variant: Variant;
  headline?: string;
}) {
  const [state, setState] = useState<SubscribeActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

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

  const heading = headline ?? DEFAULT_HEADLINES[variant];
  const isFooter = variant === "footer";

  if (state?.ok) {
    return (
      <div
        className={
          isFooter
            ? "rounded-2xl border border-foil-gold/40 bg-foil-gold/10 p-4 text-sm text-foil-navy"
            : "mt-12 rounded-2xl border border-foil-gold/40 bg-foil-gold/10 p-5 text-sm text-foil-navy"
        }
        aria-live="polite"
      >
        <p className="font-medium text-foil-navy">You&apos;re in.</p>
        <p className="mt-1 text-foil-slate">
          We&apos;ll send Pokémon TCG market reads twice a week. Watch your inbox.
        </p>
      </div>
    );
  }

  const inputId = `newsletter-email-${source}`;
  const errorId = `${inputId}-error`;

  return (
    <section
      className={
        isFooter
          ? "rounded-2xl border border-foil-navy/10 bg-foil-cream p-5 shadow-sm shadow-foil-navy/5"
          : "mt-14 rounded-2xl border border-foil-gold/40 bg-foil-cream p-6 shadow-lg shadow-foil-navy/10 sm:p-8"
      }
    >
      <h2
        className={
          isFooter
            ? "font-display text-base font-bold tracking-[-0.02em] text-foil-navy"
            : "font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl"
        }
      >
        {heading}
      </h2>
      {!isFooter && (
        <p className="mt-2 text-sm text-foil-slate">
          Card price moves, Japanese-set drops, and one sharp valuation note in your inbox. No spam.
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className={`mt-4 flex flex-col gap-2 ${isFooter ? "" : "sm:flex-row"}`}
        noValidate
      >
        <input type="hidden" name="source" value={source} />
        <label htmlFor={inputId} className="sr-only">
          Email address
        </label>
        <input
          id={inputId}
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@gmail.com"
          disabled={isPending}
          className="min-w-0 flex-1 rounded-xl border border-foil-navy/15 bg-foil-cream px-4 py-3 text-base text-foil-navy placeholder:text-foil-slate/60 outline-none transition focus:border-foil-gold focus:ring-2 focus:ring-foil-gold/30 disabled:opacity-60"
          aria-invalid={state?.ok === false}
          aria-describedby={state?.ok === false ? errorId : undefined}
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-foil-navy px-5 py-3 text-base font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-foil-navy disabled:hover:ring-0"
        >
          {isPending ? "Subscribing…" : "Subscribe"}
        </button>
      </form>
      {state?.ok === false && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-foil-coral">
          {state.error}
        </p>
      )}
    </section>
  );
}
