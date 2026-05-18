// Stripe webhook handler.
//
// Local dev: this endpoint won't receive events until you run the Stripe CLI:
//   stripe listen --forward-to localhost:3000/api/webhooks/stripe
// The CLI prints a webhook signing secret (whsec_...) — paste it into
// .env.local as STRIPE_WEBHOOK_SECRET, then restart `npm run dev`.
//
// We subscribe to:
//   - checkout.session.completed
//   - customer.subscription.updated
//   - customer.subscription.deleted

import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function periodEndIso(sub: Stripe.Subscription): string | null {
  const raw = (sub as unknown as { current_period_end?: number | null }).current_period_end;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw * 1000).toISOString();
  }
  return null;
}

async function upsertFromSubscription(sub: Stripe.Subscription, supabaseUserId: string | null) {
  const admin = supabaseAdmin();
  const tier = ["active", "trialing"].includes(sub.status) ? "pro" : "free";

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
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const supabaseUserId = (sub.metadata?.supabase_user_id as string | undefined) ?? null;
        await upsertFromSubscription(sub, supabaseUserId);
        break;
      }
      default:
        // Ignore other event types — we only subscribe to the three above in the CLI/dashboard.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe webhook] handler error for ${event.type}: ${message}`);
    return new Response(`Handler error: ${message}`, { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
