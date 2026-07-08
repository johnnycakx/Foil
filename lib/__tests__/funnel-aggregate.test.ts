// Funnel-report aggregation (validation-sprint Phase 3, ADR-112). Pins the
// three-signal math the ads test depends on — especially that ONLY rows with a
// stripe_subscription_id count as trials (the free placeholder rows from
// getOrCreateStripeCustomer must not inflate the trial count), and that
// trial→paid is measured among RESOLVED trials only.

import test from "node:test";
import assert from "node:assert/strict";
import { tallyBy, summarizeSubscriptions, type SubRow } from "../funnel/aggregate.ts";

test("tallyBy groups by key and sorts by count desc; null → (none)", () => {
  const rows = [{ c: "x" }, { c: "y" }, { c: "x" }, { c: null }];
  const out = tallyBy(rows, (r) => r.c);
  assert.deepEqual(out, [["x", 2], ["y", 1], ["(none)", 1]]);
});

test("summarizeSubscriptions counts only rows with a subscription id as trials", () => {
  const rows: SubRow[] = [
    { status: "free", tier: "free", stripe_subscription_id: null }, // placeholder — NOT a trial
    { status: "trialing", tier: "pro", stripe_subscription_id: "sub_1" },
    { status: "trialing", tier: "pro", stripe_subscription_id: "sub_2" },
    { status: "active", tier: "pro", stripe_subscription_id: "sub_3" }, // converted
    { status: "canceled", tier: "free", stripe_subscription_id: "sub_4" }, // churned
  ];
  const s = summarizeSubscriptions(rows);
  assert.equal(s.trialsStarted, 4, "the free placeholder row is excluded");
  assert.equal(s.trialing, 2);
  assert.equal(s.converted, 1);
  assert.equal(s.churned, 1);
  // trial→paid among RESOLVED trials (converted + churned = 2): 1/2 = 50%.
  assert.equal(s.trialToPaidPct, 50);
});

test("trialToPaidPct is null until a trial resolves (all still trialing)", () => {
  const rows: SubRow[] = [
    { status: "trialing", tier: "pro", stripe_subscription_id: "sub_1" },
    { status: "trialing", tier: "pro", stripe_subscription_id: "sub_2" },
  ];
  const s = summarizeSubscriptions(rows);
  assert.equal(s.trialsStarted, 2);
  assert.equal(s.trialToPaidPct, null);
});

test("empty data → zeros, not a divide-by-zero", () => {
  const s = summarizeSubscriptions([]);
  assert.equal(s.trialsStarted, 0);
  assert.equal(s.trialToPaidPct, null);
});
