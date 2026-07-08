"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { FOIL_PRO_LOOKUP_KEY, ensureProProductAndPrice } from "@/lib/stripe-setup";
import { stripe, PRO_TRIAL_DAYS } from "@/lib/stripe";

async function siteOrigin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? `http://${h.get("host") ?? "localhost:3000"}`;
}

async function resolveProPriceId(): Promise<string> {
  if (process.env.STRIPE_PRO_PRICE_ID) return process.env.STRIPE_PRO_PRICE_ID;
  const prices = await stripe().prices.list({ lookup_keys: [FOIL_PRO_LOOKUP_KEY], limit: 1 });
  if (prices.data[0]) return prices.data[0].id;
  const setup = await ensureProProductAndPrice();
  return setup.priceId;
}

async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  const existing = (data as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (existing) return existing;

  const customer = await stripe().customers.create({
    email,
    metadata: { supabase_user_id: userId },
  });

  await admin
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customer.id,
        tier: "free",
      },
      { onConflict: "user_id" },
    );

  return customer.id;
}

export async function createCheckoutSession(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const priceId = await resolveProPriceId();
  const customerId = await getOrCreateStripeCustomer(user.id, user.email ?? "");
  const origin = await siteOrigin();

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pro?checkout=canceled`,
    allow_promotion_codes: true,
    client_reference_id: user.id,
    // 30-day free trial, CARD REQUIRED (payment_method_collection:"always" — the
    // Stripe default for subscription mode, set explicitly so a $0-due trial
    // still collects a card; "if_required" would skip it). trial_period_days is
    // the trial length. Confirmed against docs.stripe.com/payments/checkout/free-trials.
    payment_method_collection: "always",
    subscription_data: {
      trial_period_days: PRO_TRIAL_DAYS,
      metadata: { supabase_user_id: user.id },
    },
  });

  if (!session.url) {
    throw new Error("Stripe Checkout session has no redirect URL.");
  }
  redirect(session.url);
}

export async function openCustomerPortal(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = supabaseAdmin();
  const { data } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const customerId = (data as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (!customerId) {
    redirect("/upload?portal=no_customer");
  }

  const origin = await siteOrigin();
  const portal = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/account`,
  });
  redirect(portal.url);
}
