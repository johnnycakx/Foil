// Foil Pro entitlement mapping + $6/30-day config (validation-sprint Phase 2).
//
// These are the DETERMINISTIC core the webhook depends on: Stripe subscription
// status → entitlement tier (trialing counts as Pro; every non-active state
// revokes), and the period-end extraction. The live Stripe round-trip
// (idempotent $6 price, real trialing subscription, entitlement row created →
// canceled → revoked) is exercised separately by scripts/verify-stripe-pro.ts.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { subscriptionTier, periodEndIso, cancelState } from "../stripe-entitlement.ts";
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

test("periodEndIso: falls back to the ITEM-level current_period_end (basil+ API shape)", () => {
  // Stripe 2025-03-31.basil moved current_period_end from Subscription to
  // SubscriptionItem — on our pinned 2026-04-22.dahlia the top-level field is
  // ABSENT on live webhook payloads (verified against a real trialing sub,
  // funnel-stress-test 2026-07-11). Without the item fallback every entitlement
  // row's current_period_end is silently null.
  const at = 1_786_348_581;
  assert.equal(
    periodEndIso({
      items: { data: [{ current_period_end: at }] },
    } as unknown as Parameters<typeof periodEndIso>[0]),
    new Date(at * 1000).toISOString(),
  );
  // Top-level (older shape) still wins when present.
  assert.equal(
    periodEndIso({
      current_period_end: at,
      items: { data: [{ current_period_end: at + 999 }] },
    } as unknown as Parameters<typeof periodEndIso>[0]),
    new Date(at * 1000).toISOString(),
  );
  // Neither present → null (unchanged soft behavior).
  assert.equal(
    periodEndIso({ items: { data: [] } } as unknown as Parameters<typeof periodEndIso>[0]),
    null,
  );
});

test("Foil Pro is priced $6/mo with a 30-day trial (the repurposed rail, not $14.99)", () => {
  assert.equal(PRO_PRICE_USD_CENTS, 600, "the price is $6.00, not the parked $14.99");
  assert.equal(PRO_TRIAL_DAYS, 30, "the trial is 30 days");
});

// ---------------------------------------------------------------------------
// Scheduled-cancel state (2026-07-12). Stripe keeps a canceling subscription at
// trialing/active until the period ends, so the ONLY signal is the flag. Before
// this, /account told a canceled user they had a "next charge" coming — a false
// claim about their money — and our own DB couldn't tell "will bill" from
// "will end" (which is what made the +smoke live trial unverifiable from our
// data on 2026-07-12).
// ---------------------------------------------------------------------------

type SubArg = Parameters<typeof cancelState>[0];

test("cancelState: a scheduled cancel is flagged with its end date", () => {
  const at = 1786000000;
  const s = cancelState({ cancel_at_period_end: true, cancel_at: at } as unknown as SubArg);
  assert.equal(s.cancelAtPeriodEnd, true);
  assert.equal(s.cancelAt, new Date(at * 1000).toISOString());
});

test("cancelState: flagged with no cancel_at falls back to the period end", () => {
  const at = 1786000000;
  const s = cancelState({
    cancel_at_period_end: true,
    cancel_at: null,
    items: { data: [{ current_period_end: at }] },
  } as unknown as SubArg);
  assert.equal(s.cancelAtPeriodEnd, true);
  assert.equal(s.cancelAt, new Date(at * 1000).toISOString());
});

test("cancelState: a normal renewing sub is NOT flagged", () => {
  const s = cancelState({
    cancel_at_period_end: false,
    cancel_at: null,
    items: { data: [{ current_period_end: 1786000000 }] },
  } as unknown as SubArg);
  assert.equal(s.cancelAtPeriodEnd, false);
  assert.equal(s.cancelAt, null);
});

test("a canceling sub is STILL Pro until the period ends (entitlement is not revoked early)", () => {
  // The trap: cancel_at_period_end does NOT change status, so tier must stay pro.
  assert.equal(subscriptionTier("trialing"), "pro");
  assert.equal(subscriptionTier("active"), "pro");
});

test("/account never promises a next charge to a canceling user", () => {
  const src = readFileSync(
    join(new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), "app/account/page.tsx"),
    "utf8",
  );
  // The "next charge" string must be reachable ONLY on the non-canceling branch.
  assert.match(src, /ent\.cancelAtPeriodEnd \?/, "the page must branch on the cancel flag");
  assert.match(src, /Pro ends/, "a canceling user is told when Pro ends");
  assert.match(src, /won&apos;t be charged again/, "and told they won't be charged again");
  const afterFlag = src.slice(src.indexOf("ent.cancelAtPeriodEnd ?"));
  const cancelBranch = afterFlag.slice(0, afterFlag.indexOf(") : ("));
  assert.ok(
    !cancelBranch.includes("next charge"),
    "the canceling branch must NEVER render 'next charge'",
  );
});
