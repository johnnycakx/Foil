// Foil Pro entitlement mapping + $6/30-day config (validation-sprint Phase 2).
//
// These are the DETERMINISTIC core the webhook depends on: Stripe subscription
// status → entitlement tier (trialing counts as Pro; every non-active state
// revokes), and the period-end extraction. The live Stripe round-trip
// (idempotent $6 price, real trialing subscription, entitlement row created →
// canceled → revoked) is exercised separately by scripts/verify-stripe-pro.ts.

import test from "node:test";
import assert from "node:assert/strict";
import { subscriptionTier, periodEndIso } from "../stripe-entitlement.ts";
import { PRO_PRICE_USD_CENTS, PRO_TRIAL_DAYS } from "../stripe.ts";

test("subscriptionTier: trialing + active are Pro (a card-required trial IS the entitlement)", () => {
  assert.equal(subscriptionTier("trialing"), "pro");
  assert.equal(subscriptionTier("active"), "pro");
});

test("subscriptionTier: every non-active status revokes to free", () => {
  for (const status of [
    "past_due",
    "canceled",
    "unpaid",
    "incomplete",
    "incomplete_expired",
    "paused",
    "",
  ]) {
    assert.equal(subscriptionTier(status), "free", `${status || "<empty>"} → free`);
  }
});

test("periodEndIso: unix seconds → ISO; absent/invalid → null", () => {
  const at = 1_800_000_000; // 2027-01-15T08:00:00Z
  assert.equal(
    periodEndIso({ current_period_end: at } as unknown as Parameters<typeof periodEndIso>[0]),
    new Date(at * 1000).toISOString(),
  );
  assert.equal(periodEndIso({} as unknown as Parameters<typeof periodEndIso>[0]), null);
  assert.equal(
    periodEndIso({ current_period_end: null } as unknown as Parameters<typeof periodEndIso>[0]),
    null,
  );
});

test("Foil Pro is priced $6/mo with a 30-day trial (the repurposed rail, not $14.99)", () => {
  assert.equal(PRO_PRICE_USD_CENTS, 600, "the price is $6.00, not the parked $14.99");
  assert.equal(PRO_TRIAL_DAYS, 30, "the trial is 30 days");
});
