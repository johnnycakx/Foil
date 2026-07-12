// Pure Stripe-subscription → entitlement mapping (validation-sprint Phase 2).
//
// Extracted from app/api/webhooks/stripe/route.ts so the mapping the webhook
// depends on is unit-testable WITHOUT a live Stripe/Supabase round-trip (and
// without the route's `@/`-aliased imports, which the node test runner doesn't
// resolve). Type-only Stripe import → zero runtime deps → trivially importable.

import type Stripe from "stripe";

/** Entitlement tier from Stripe subscription status. `trialing` counts as Pro —
 *  a card-required trial IS the paid entitlement — while every non-active state
 *  (past_due / canceled / unpaid / incomplete / incomplete_expired / paused)
 *  degrades to free. */
export function subscriptionTier(status: string): "pro" | "free" {
  return ["active", "trialing"].includes(status) ? "pro" : "free";
}

/** Subscription current-period-end (unix secs) → ISO, or null when absent. For
 *  a trialing subscription Stripe sets this to the trial-end date.
 *
 *  Stripe's 2025-03-31.basil API release MOVED current_period_end from the
 *  Subscription to the SubscriptionItem (verified live against our pinned
 *  2026-04-22.dahlia: top-level is absent, items.data[0].current_period_end
 *  carries the date — funnel-stress-test 2026-07-11). Read the top level first
 *  (older API shapes / test fixtures), then fall back to the first item. */
export function periodEndIso(sub: Stripe.Subscription): string | null {
  const top = (sub as unknown as { current_period_end?: number | null }).current_period_end;
  const item = sub.items?.data?.[0] as
    | { current_period_end?: number | null }
    | undefined;
  const raw = typeof top === "number" ? top : item?.current_period_end;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw * 1000).toISOString();
  }
  return null;
}

/** Scheduled-cancel state (2026-07-12). A canceling subscription STAYS
 *  `trialing`/`active` until its period ends — Stripe only flags it with
 *  `cancel_at_period_end`. Without this, /account promises a "next charge" to
 *  someone who already canceled. `cancel_at` is Stripe's own scheduled-end
 *  timestamp; fall back to the period end, which is when it actually stops. */
export function cancelState(sub: Stripe.Subscription): {
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
} {
  const flagged = sub.cancel_at_period_end === true;
  const raw = sub.cancel_at;
  const cancelAt =
    typeof raw === "number" && Number.isFinite(raw)
      ? new Date(raw * 1000).toISOString()
      : flagged
        ? periodEndIso(sub)
        : null;
  return { cancelAtPeriodEnd: flagged, cancelAt };
}
