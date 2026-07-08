// Live TEST-MODE end-to-end proof for the Foil Pro $6/mo + 30-day-trial rail
// (validation-sprint Phase 2, ADR-111). Exercises the real path the webhook
// drives, minus the browser + HMAC layer (Stripe's own SDK):
//
//   1. ensureProProductAndPrice() → a $6/mo price, created idempotently
//   2. a real trialing subscription (trial_period_days:30) → status "trialing"
//   3. upsert (the webhook's exact logic) → subscriptions row tier="pro"
//   4. cancel → upsert again → tier="free"  (entitlement revoked)
//   5. full cleanup (subscription, customer, row, temp auth user)
//
// GUARDED to sk_test keys only — it creates + cancels a real subscription, so it
// must never run against a live key. Re-runnable. Requires STRIPE_SECRET_KEY +
// NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (loaded from .env.local).
//
//   node --experimental-strip-types --no-warnings scripts/verify-stripe-pro.ts

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { stripe, PRO_PRICE_USD_CENTS, PRO_TRIAL_DAYS } from "../lib/stripe.ts";
import { ensureProProductAndPrice } from "../lib/stripe-setup.ts";
import { subscriptionTier, periodEndIso } from "../lib/stripe-entitlement.ts";

function loadEnv(): void {
  try {
    const env = readFileSync(".env.local", "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* env may already be set in CI */
  }
}

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "✔" : "✖"} ${label}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
}

async function main(): Promise<void> {
  loadEnv();
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key.startsWith("sk_test")) {
    console.error(`ABORT: STRIPE_SECRET_KEY is not a test-mode key (got "${key.slice(0, 8)}…"). This script creates + cancels a real subscription; test mode only.`);
    process.exit(1);
  }
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) {
    console.error("ABORT: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required.");
    process.exit(1);
  }
  const admin = createClient(supaUrl, supaKey, { auth: { persistSession: false } });
  const s = stripe();

  console.log("Foil Pro test-mode E2E:");

  // 1. Idempotent $6 price.
  const first = await ensureProProductAndPrice();
  const price = await s.prices.retrieve(first.priceId);
  check("$6/mo price exists", price.unit_amount === PRO_PRICE_USD_CENTS && price.recurring?.interval === "month", `unit_amount=${price.unit_amount} interval=${price.recurring?.interval}`);
  const second = await ensureProProductAndPrice();
  check("ensureProProductAndPrice is idempotent", second.priceId === first.priceId && second.reused.price, `priceId stable=${second.priceId === first.priceId} reused=${second.reused.price}`);

  // temp identities
  const stamp = first.priceId.slice(-8);
  const email = `pro-e2e-${stamp}@foil-test.invalid`;
  let userId = "";
  let customerId = "";
  let subId = "";
  try {
    // temp auth user (subscriptions.user_id FK → auth.users)
    const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (cErr || !created?.user) throw new Error(`createUser failed: ${cErr?.message}`);
    userId = created.user.id;

    const customer = await s.customers.create({ email, metadata: { supabase_user_id: userId } });
    customerId = customer.id;

    // 2. Real trialing subscription (what Checkout produces).
    const sub = await s.subscriptions.create({
      customer: customerId,
      items: [{ price: first.priceId }],
      trial_period_days: PRO_TRIAL_DAYS,
      metadata: { supabase_user_id: userId },
    });
    subId = sub.id;
    check("subscription reaches status=trialing", sub.status === "trialing", `status=${sub.status}, trial_end=${sub.trial_end ? new Date(sub.trial_end * 1000).toISOString().slice(0, 10) : "?"}`);

    // 3. Webhook upsert logic → entitlement row = pro.
    const upsert = async (subscription: typeof sub) =>
      admin.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          tier: subscriptionTier(subscription.status),
          current_period_end: periodEndIso(subscription),
        },
        { onConflict: "user_id" },
      );
    await upsert(sub);
    const { data: rowPro } = await admin.from("subscriptions").select("tier,status").eq("user_id", userId).maybeSingle();
    check("entitlement row created as tier=pro during trial", rowPro?.tier === "pro" && rowPro?.status === "trialing", `tier=${rowPro?.tier} status=${rowPro?.status}`);

    // 4. Cancel → upsert → entitlement revoked.
    const canceled = await s.subscriptions.cancel(subId);
    await upsert(canceled);
    const { data: rowFree } = await admin.from("subscriptions").select("tier,status").eq("user_id", userId).maybeSingle();
    check("entitlement revoked to tier=free on cancel", rowFree?.tier === "free" && rowFree?.status === "canceled", `tier=${rowFree?.tier} status=${rowFree?.status}`);
    subId = ""; // already canceled
  } finally {
    // 5. Cleanup.
    if (subId) { try { await s.subscriptions.cancel(subId); } catch { /* ignore */ } }
    if (customerId) { try { await s.customers.del(customerId); } catch { /* ignore */ } }
    if (userId) {
      try { await admin.from("subscriptions").delete().eq("user_id", userId); } catch { /* ignore */ }
      try { await admin.auth.admin.deleteUser(userId); } catch { /* ignore */ }
    }
  }

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} passed, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("verify-stripe-pro failed:", e); process.exit(1); });
