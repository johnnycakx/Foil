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
            ? "rounded-2xl border border-[#FF6B5C]/30 bg-[#FF6B5C]/10 p-4 text-sm text-[#FFE2DA]"
            : "mt-12 rounded-2xl border border-[#FF6B5C]/40 bg-[#FF6B5C]/10 p-5 text-sm text-[#FFE2DA]"
        }
        aria-live="polite"
      >
        <p className="font-medium text-white">You&apos;re in.</p>
        <p className="mt-1 text-[#FFC7BA]">
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
          ? "rounded-2xl border border-white/10 bg-[#101D38] p-5"
          : "mt-14 rounded-2xl border border-[#FF6B5C]/30 bg-gradient-to-br from-[#101D38] via-[#0B1428] to-[#101D38] p-6 sm:p-8"
      }
    >
      <h2
        className={
          isFooter
            ? "text-base font-semibold tracking-tight text-white"
            : "text-xl font-bold tracking-tight text-white sm:text-2xl"
        }
      >
        {heading}
      </h2>
      {!isFooter && (
        <p className="mt-2 text-sm text-zinc-400">
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
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-zinc-400 outline-none transition focus:border-[#FF6B5C] focus:bg-white/10 disabled:opacity-60"
          aria-invalid={state?.ok === false}
          aria-describedby={state?.ok === false ? errorId : undefined}
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-[#FF6B5C] px-5 py-3 text-base font-semibold text-[#0B1428] transition hover:bg-[#FF8775] disabled:opacity-60"
        >
          {isPending ? "Subscribing…" : "Subscribe"}
        </button>
      </form>
      {state?.ok === false && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-[#FFB6A8]">
          {state.error}
        </p>
      )}
    </section>
  );
}
