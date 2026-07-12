// Reconcile the `subscriptions` entitlement table against Stripe (2026-07-12).
//
// WHY THIS EXISTS. Our entitlement rows are webhook-written, so they drift
// whenever an event never reaches us:
//   - a TEST-mode cancel never hits the prod (live) webhook at all;
//   - an event that fired BEFORE a column existed left that column at its
//     default (this is why the +smoke2 scheduled cancel reads as "will bill");
//   - any missed/failed delivery.
// Stripe is the source of truth. This walks every row, asks Stripe what is
// actually true, and repairs the differences.
//
// USAGE (John — needs the LIVE key, which the runner never handles):
//   STRIPE_SECRET_KEY=sk_live_... node --experimental-strip-types --no-warnings scripts/reconcile-subscriptions.ts
//   ...add --apply to write. Without it, this is a DRY RUN and changes nothing.
//
// Safe by construction: read-only against Stripe (never cancels or charges),
// and it only ever writes our own DB.

import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { subscriptionTier, periodEndIso, cancelState } from "../lib/stripe-entitlement.ts";

// Same env load as the other scripts here. An explicitly-passed
// STRIPE_SECRET_KEY (the live key, on John's shell) WINS over .env.local's
// test key — the `!process.env[...]` guard is what makes that true.
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const APPLY = process.argv.includes("--apply");

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
const mode = key.startsWith("sk_live") ? "LIVE" : "TEST";

const stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

console.log(`Reconciling subscriptions against Stripe [${mode}] — ${APPLY ? "APPLY" : "DRY RUN"}\n`);

const { data: rows, error } = await admin
  .from("subscriptions")
  .select("user_id, email, tier, status, stripe_subscription_id, cancel_at_period_end, cancel_at, current_period_end");
if (error) throw new Error(`read failed: ${error.message}`);

let checked = 0;
let drifted = 0;
let skipped = 0;

for (const row of rows ?? []) {
  const subId = row.stripe_subscription_id;
  if (!subId) {
    skipped += 1;
    continue;
  }

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subId);
  } catch (err) {
    // A row pointing at the OTHER mode's object (the test-mode-id-in-a-live-row
    // trap) surfaces here instead of silently corrupting a live checkout.
    console.log(`  ${row.email}: ${subId} NOT FOUND in ${mode} mode — ${(err as Error).message}`);
    skipped += 1;
    continue;
  }
  checked += 1;

  const truth = {
    tier: subscriptionTier(sub.status),
    status: sub.status,
    current_period_end: periodEndIso(sub),
    ...(() => {
      const c = cancelState(sub);
      return { cancel_at_period_end: c.cancelAtPeriodEnd, cancel_at: c.cancelAt };
    })(),
  };

  const diffs: string[] = [];
  if (row.tier !== truth.tier) diffs.push(`tier ${row.tier} → ${truth.tier}`);
  if (row.status !== truth.status) diffs.push(`status ${row.status} → ${truth.status}`);
  if ((row.cancel_at_period_end ?? false) !== truth.cancel_at_period_end) {
    diffs.push(`cancel_at_period_end ${row.cancel_at_period_end} → ${truth.cancel_at_period_end}`);
  }
  if ((row.cancel_at ?? null) !== truth.cancel_at) diffs.push(`cancel_at → ${truth.cancel_at ?? "null"}`);

  if (diffs.length === 0) {
    console.log(`  ${row.email}: OK (${truth.status}${truth.cancel_at_period_end ? ", canceling" : ""})`);
    continue;
  }

  drifted += 1;
  console.log(`  ${row.email}: DRIFT — ${diffs.join(" · ")}`);
  if (APPLY) {
    const { error: upErr } = await admin
      .from("subscriptions")
      .update(truth)
      .eq("user_id", row.user_id);
    console.log(upErr ? `    write FAILED: ${upErr.message}` : `    repaired`);
  }
}

console.log(
  `\nchecked ${checked} · drifted ${drifted} · skipped ${skipped} (no sub id, or id belongs to the other Stripe mode)`,
);
if (drifted > 0 && !APPLY) console.log("Re-run with --apply to write the repairs.");
