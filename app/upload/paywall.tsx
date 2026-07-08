import { FREE_DAILY_SCAN_LIMIT } from "@/lib/stripe";
import { createCheckoutSession } from "./billing-actions";

export function Paywall() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs uppercase tracking-wide text-amber-600 dark:text-amber-400">
        Daily limit reached
      </p>
      <h2 className="mt-2 text-xl font-semibold">
        {FREE_DAILY_SCAN_LIMIT}/{FREE_DAILY_SCAN_LIMIT} free scans used today
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Upgrade to <span className="font-medium">Foil Pro</span> for unlimited scans, full per-card pricing, 90-day history, and no watermark.
      </p>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">$6</span>
        <span className="text-sm text-zinc-500">/ month</span>
      </div>
      <form action={createCheckoutSession} className="mt-5">
        <button
          type="submit"
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Subscribe to Pro
        </button>
      </form>
      <p className="mt-3 text-xs text-zinc-500">
        Cancel anytime. Your free scan resets at 00:00 UTC.
      </p>
    </div>
  );
}
