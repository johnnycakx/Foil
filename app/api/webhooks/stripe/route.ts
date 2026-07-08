// Stripe webhook handler.
//
// Local dev: this endpoint won't receive events until you run the Stripe CLI:
//   stripe listen --forward-to localhost:3000/api/webhooks/stripe
// The CLI prints a webhook signing secret (whsec_...) — paste it into
// .env.local as STRIPE_WEBHOOK_SECRET, then restart `npm run dev`.
//
// We subscribe to (validation-sprint Phase 2 added the two trial events):
//   - checkout.session.completed        (trial start via Checkout)
//   - customer.subscription.created     (trialing sub created)
//   - customer.subscription.updated     (trial→active, past_due, etc.)
//   - customer.subscription.trial_will_end  (3 days before trial ends)
//   - customer.subscription.deleted     (canceled → revoke)

import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { subscriptionTier, periodEndIso } from "@/lib/stripe-entitlement";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function upsertFromSubscription(sub: Stripe.Subscription, supabaseUserId: string | null) {
  const admin = supabaseAdmin();
  const tier = subscriptionTier(sub.status);

  if (supabaseUserId) {
    await admin.from("subscriptions").upsert(
      {
        user_id: supabaseUserId,
        stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        stripe_subscription_id: sub.id,
        status: sub.status,
        tier,
        current_period_end: periodEndIso(sub),
      },
      { onConflict: "user_id" },
    );
    return;
  }

  // Fallback: locate the user via stripe_customer_id.
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const { data } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  const rec = data as { user_id: string } | null;
  if (!rec) {
    console.error(`[stripe webhook] no subscription row for customer=${customerId}`);
    return;
  }
  await admin
    .from("subscriptions")
    .update({
      stripe_subscription_id: sub.id,
      status: sub.status,
      tier,
      current_period_end: periodEndIso(sub),
    })
    .eq("user_id", rec.user_id);
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe webhook] signature verification failed: ${message}`);
    return new Response(`Invalid signature: ${message}`, { status: 400 });
  }

  console.log(`[stripe webhook] received ${event.type} id=${event.id}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const supabaseUserId =
          session.client_reference_id ??
          (session.metadata?.supabase_user_id as string | undefined) ??
          null;
        if (session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const sub = await stripe().subscriptions.retrieve(subId);
          await upsertFromSubscription(sub, supabaseUserId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.trial_will_end":
      case "customer.subscription.deleted": {
        // All four carry a Subscription object; a single upsert keeps the
        // entitlement row in lockstep with Stripe status (trialing→pro on
        // create, →free on delete). trial_will_end is a heads-up (status stays
        // trialing) — the upsert is a no-op refresh, safe to run.
        const sub = event.data.object as Stripe.Subscription;
        const supabaseUserId = (sub.metadata?.supabase_user_id as string | undefined) ?? null;
        await upsertFromSubscription(sub, supabaseUserId);
        break;
      }
      default:
        // Ignore other event types — we only subscribe to the ones above.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe webhook] handler error for ${event.type}: ${message}`);
    return new Response(`Handler error: ${message}`, { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
