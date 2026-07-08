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
 *  a trialing subscription Stripe sets this to the trial-end date. */
export function periodEndIso(sub: Stripe.Subscription): string | null {
  const raw = (sub as unknown as { current_period_end?: number | null }).current_period_end;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw * 1000).toISOString();
  }
  return null;
}
