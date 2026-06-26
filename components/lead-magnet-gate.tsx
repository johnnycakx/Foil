"use client";

// Lead-magnet gate (ADR-068). An honest value-for-email trade: the email field
// is the primary action; on a successful subscribe the gated asset (`children`)
// reveals in place. Reuses the existing `subscribeAction` Server Action ->
// lib/beehiiv.ts (NO new email backend, NO Beehiiv send-API dependency — the
// asset is delivered on-page, not emailed). No redirect, so no open-redirect
// surface. No fake-scarcity or urgency pressure: the gate is a plain trade.

import { useState, useTransition } from "react";
import { subscribeAction, type SubscribeActionResult } from "@/app/actions/subscribe";

export function LeadMagnetGate({
  source,
  children,
  downloadHref,
  downloadLabel = "Download the cheat sheet (PDF)",
}: {
  /** Beehiiv segmentation tag, e.g. "lead_magnet_cheatsheet". */
  source: string;
  /** The gated asset, revealed in place on a successful subscribe. */
  children: React.ReactNode;
  /** Optional keepable file. When set, the success reveal also offers a direct
   *  download (a same-origin /public path) so a cold subscriber who unlocks
   *  on-page still walks away with the asset. No new backend — a static link. */
  downloadHref?: string;
  /** Button label for the download. Defaults to the cheat-sheet wording. */
  downloadLabel?: string;
}) {
  const [state, setState] = useState<SubscribeActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      setState(await subscribeAction(data));
    });
  };

  if (state?.ok) {
    return (
      <div>
        <div
          aria-live="polite"
          className="rounded-2xl border border-foil-gold/40 bg-foil-gold/10 p-5 text-sm text-foil-navy"
        >
          <p className="font-display text-lg font-semibold text-foil-navy">You&apos;re in. Here&apos;s your cheat sheet.</p>
          <p className="mt-1 text-foil-slate">
            The full reference is unlocked below. The weekly drop is on its way: the
            best live card deals, the cards on the move, and one sharp valuation note.
            No spam, unsubscribe anytime.
          </p>
          {downloadHref && (
            <a
              href={downloadHref}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-foil-navy px-5 py-3 text-sm font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40"
            >
              <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                <path d="M10 2a.75.75 0 0 1 .75.75v8.69l2.97-2.97a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.53a.75.75 0 0 1 1.06-1.06l2.97 2.97V2.75A.75.75 0 0 1 10 2Z" />
                <path d="M3.5 13.25a.75.75 0 0 1 .75.75v1.5c0 .14.11.25.25.25h11a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 15.5 17.25h-11A1.75 1.75 0 0 1 2.75 15.5v-1.5a.75.75 0 0 1 .75-.75Z" />
              </svg>
              {downloadLabel}
            </a>
          )}
        </div>
        <div className="mt-8">{children}</div>
      </div>
    );
  }

  const inputId = `lead-magnet-email-${source}`;
  const errorId = `${inputId}-error`;

  return (
    <section className="rounded-2xl border border-foil-gold/40 bg-foil-cream p-6 shadow-lg shadow-foil-navy/10 sm:p-8">
      <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
        Unlock the full cheat sheet, free.
      </h2>
      <p className="mt-2 text-sm text-foil-slate">
        Enter your email and the complete reference unlocks right here. You also get
        the weekly drop: the best live card deals right now, the cards on the move,
        and one sharp valuation note. No spam.
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row" noValidate>
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
          className="min-w-0 flex-1 rounded-xl border border-foil-navy/15 bg-foil-cream px-4 py-3 text-base text-foil-navy placeholder:text-foil-slate/70 outline-none transition focus:border-foil-gold focus:ring-2 focus:ring-foil-gold/30 disabled:opacity-60"
          aria-invalid={state?.ok === false}
          aria-describedby={state?.ok === false ? errorId : undefined}
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-foil-navy px-5 py-3 text-base font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-foil-navy disabled:hover:ring-0"
        >
          {isPending ? "Unlocking…" : "Unlock the cheat sheet"}
        </button>
      </form>
      {state?.ok === false && (
        <p id={errorId} role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-foil-navy">
          <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-foil-coral">
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
