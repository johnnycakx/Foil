// One-trial-per-customer (offer 1c), keyed on Stripe customer EMAIL.
//
// Stripe has no native repeat-trial gate (verified against
// docs.stripe.com/billing/subscriptions/trials/free-trials, 2026-07-11 — abuse
// prevention is explicitly the merchant's job), so the app checks prior
// subscription history across every customer that shares the email.
// `GET /v1/customers?email=` is an exact, CASE-SENSITIVE filter
// (docs.stripe.com/api/customers/list), so we probe the as-given and
// lowercased spellings. Fails OPEN on Stripe errors: a flaky list call must
// not block a paying checkout; the gate is revenue protection, not a
// correctness invariant.

import type Stripe from "stripe";
import { stripe } from "./stripe";

export async function trialAlreadyUsed(
  email: string,
  opts: { excludeSubscriptionId?: string; client?: Stripe } = {},
): Promise<boolean> {
  const s = opts.client ?? stripe();
  const raw = email.trim();
  if (!raw) return false;
  const variants = raw === raw.toLowerCase() ? [raw] : [raw, raw.toLowerCase()];
  try {
    const customerIds = new Set<string>();
    for (const variant of variants) {
      const customers = await s.customers.list({ email: variant, limit: 100 });
      for (const c of customers.data) customerIds.add(c.id);
    }
    for (const customerId of customerIds) {
      const subs = await s.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 100,
      });
      for (const sub of subs.data) {
        if (sub.id === opts.excludeSubscriptionId) continue;
        if (sub.trial_start != null) return true;
      }
    }
    return false;
  } catch (err) {
    console.warn(`[stripe-trial] history check failed (failing open): ${(err as Error).message}`);
    return false;
  }
}
