"use client";

import { useEffect, useState, useTransition } from "react";
import { subscribeAction, type SubscribeActionResult } from "@/app/actions/subscribe";

type Variant = "inline" | "footer";

const DEFAULT_HEADLINES: Record<Variant, string> = {
  inline: "Get a Pokémon TCG market read once a week.",
  footer: "Subscribe to the Foil newsletter.",
};

export function EmailCapture({
  source,
  variant,
  headline,
  subtext,
}: {
  source: string;
  variant: Variant;
  headline?: string;
  // Optional override for the inline supporting line (footer variant has none).
  // Lets a surface state its own concrete "what lands in your inbox" promise
  // instead of the generic default. Defaults to the existing copy.
  subtext?: string;
}) {
  const [state, setState] = useState<SubscribeActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // Inbound channel attribution (ADR-084). Read the landing URL's utm_* (or a
  // single ?src= as a short alias for utm_source — matches the watchlist
  // convention) after hydration and mirror them into hidden form fields, so a
  // /deals?utm_source=reddit signup is stored with that channel. Client-side
  // (window.location) — no useSearchParams, to avoid forcing every host page
  // into a Suspense/client-render boundary. The server action sanitizes; the
  // owned Supabase row is the source of truth.
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
          We&apos;ll send a Pokémon TCG market read once a week. Watch your inbox.
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
          {subtext ??
            "Card price moves, Japanese-set drops, and one sharp valuation note in your inbox. No spam."}
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className={`mt-4 flex flex-col gap-2 ${isFooter ? "" : "sm:flex-row"}`}
        noValidate
      >
        <input type="hidden" name="source" value={source} />
        <input type="hidden" name="utm_source" value={utm.source} />
        <input type="hidden" name="utm_medium" value={utm.medium} />
        <input type="hidden" name="utm_campaign" value={utm.campaign} />
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
          className="min-w-0 flex-1 rounded-xl border border-foil-navy/15 bg-foil-cream px-4 py-3 text-base text-foil-navy placeholder:text-foil-slate/70 outline-none transition focus:border-foil-gold focus:ring-2 focus:ring-foil-gold/30 disabled:opacity-60"
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
        <p
          id={errorId}
          role="alert"
          className="mt-2 flex items-start gap-1.5 text-sm text-foil-navy"
        >
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="currentColor"
            className="mt-0.5 h-4 w-4 shrink-0 text-foil-coral"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
          <span>{state.error}</span>
        </p>
      )}
    </section>
  );
}
