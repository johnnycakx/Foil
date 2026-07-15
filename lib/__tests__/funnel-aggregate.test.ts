// Funnel-report aggregation (validation-sprint Phase 3, ADR-112). Pins the
// three-signal math the ads test depends on — especially that ONLY rows with a
// stripe_subscription_id count as trials (the free placeholder rows from
// getOrCreateStripeCustomer must not inflate the trial count), and that
// trial→paid is measured among RESOLVED trials only.

import test from "node:test";
import assert from "node:assert/strict";
import {
  tallyBy,
  summarizeSubscriptions,
  summarizeStageFunnel,
  FUNNEL_STAGE_ORDER,
  type SubRow,
  type FunnelEventRow,
} from "../funnel/aggregate.ts";

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

// --- Signal 0: the visitor→trial stage funnel (audit 2026-07-14) ---

const ev = (stage: string): FunnelEventRow => ({ stage, utm_source: null, occurred_at: "2026-07-14T00:00:00Z" });

test("summarizeStageFunnel: stages in order, step-to-step conversion vs the PRIOR stage", () => {
  const rows = [
    ...Array(100).fill(0).map(() => ev("card_view")),
    ...Array(40).fill(0).map(() => ev("watch_set")),
    ...Array(20).fill(0).map(() => ev("pro_view")),
    ...Array(10).fill(0).map(() => ev("checkout_start")),
    ...Array(5).fill(0).map(() => ev("trial_start")),
  ];
  const { stages } = summarizeStageFunnel(rows);
  assert.deepEqual(stages.map((s) => s.stage), [...FUNNEL_STAGE_ORDER]);
  assert.deepEqual(stages.map((s) => s.count), [100, 40, 20, 10, 5]);
  assert.equal(stages[0].fromPrevPct, null, "first stage has no denominator");
  assert.equal(stages[1].fromPrevPct, 40); // 40/100
  assert.equal(stages[3].fromPrevPct, 50); // 10/20
});

test("summarizeStageFunnel: a stage that never fired shows as a HOLE (count 0), not missing", () => {
  const rows = [ev("card_view"), ev("card_view"), ev("pro_view")]; // watch_set skipped
  const { stages } = summarizeStageFunnel(rows);
  const watch = stages.find((s) => s.stage === "watch_set")!;
  assert.equal(watch.count, 0);
  // pro_view's denominator is the prior stage (watch_set = 0) → null, never a
  // fake ratio. A hole must read as a hole.
  const pro = stages.find((s) => s.stage === "pro_view")!;
  assert.equal(pro.fromPrevPct, null);
});

test("summarizeStageFunnel: empty input → every stage 0, no throw", () => {
  const { stages } = summarizeStageFunnel([]);
  assert.equal(stages.length, FUNNEL_STAGE_ORDER.length);
  assert.ok(stages.every((s) => s.count === 0 && s.fromPrevPct === null));
});
