"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { FOIL_PRO_LOOKUP_KEY, ensureProProductAndPrice } from "@/lib/stripe-setup";
import { stripe, PRO_TRIAL_DAYS } from "@/lib/stripe";
import { trialAlreadyUsed } from "@/lib/stripe-trial";
import { postError } from "@/lib/notifications/discord";

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
        // The email→tier bridge (offer 1a/1b/2a): watches are email-anchored,
        // so every subscriptions row carries its lowercased email.
        email: email.trim().toLowerCase() || null,
      },
      { onConflict: "user_id" },
    );

  return customer.id;
}

/** Reduce an untrusted hidden-field value to the safe attribution charset. */
function sanitizeAttribution(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  return clean || null;
}

export async function createCheckoutSession(formData?: FormData): Promise<void> {
  // Payment-first checkout (offer 1d, 2026-07-12 amendment): a signed-out
  // buyer goes STRAIGHT to Stripe Checkout — Checkout collects email + card
  // natively and always creates a Customer in subscription mode (verified:
  // docs.stripe.com/api/checkout/sessions/create, `customer`). The webhook
  // resolves the account afterward, when the card is already captured. The
  // old flow bounced them to /login, an inbox round-trip at the moment of
  // highest intent (magic-link auth has no instant path back).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const origin = await siteOrigin();

  // Ads attribution (ADR-084/112 passthrough): /pro mirrors its landing
  // searchParams into hidden fields; they ride on subscription metadata so
  // the funnel report can tie trials to channels.
  const attribution: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "hook"] as const) {
    const v = sanitizeAttribution(formData?.get(key) ?? null);
    if (v) attribution[key] = v;
  }

  // One-trial-per-customer (offer 1c), keyed on email. Only checkable here
  // for signed-in buyers (a guest's email is unknown until Checkout); the
  // webhook closes the guest side. No-trial sessions show "$6 due today" in
  // Checkout, so the display is always honest.
  // Every Stripe touch lives inside this try. An unhandled throw here renders
  // Next's raw production error page at the moment of highest purchase intent
  // (seen live in the 2026-07-12 round-2 preview tour: STRIPE_SECRET_KEY is
  // Production-scoped on Vercel, so every preview deployment threw). Failure
  // must degrade to an honest /pro state, never the digest page.
  let checkoutUrl: string | null = null;
  try {
    const priceId = await resolveProPriceId();

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      cancel_url: `${origin}/pro?checkout=canceled`,
      allow_promotion_codes: true,
      // Card REQUIRED on a $0-due trial (payment_method_collection:"always" —
      // "if_required" would skip it). Confirmed against
      // docs.stripe.com/payments/checkout/free-trials.
      payment_method_collection: "always",
    };

    if (user) {
      const customerId = await getOrCreateStripeCustomer(user.id, user.email ?? "");
      const withTrial = !(await trialAlreadyUsed(user.email ?? ""));
      params.customer = customerId;
      params.client_reference_id = user.id;
      params.success_url = `${origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
      params.subscription_data = {
        ...(withTrial ? { trial_period_days: PRO_TRIAL_DAYS } : {}),
        metadata: { supabase_user_id: user.id, ...attribution },
      };
    } else {
      // Guest: no `customer` — Checkout creates one from the email it collects.
      // Success lands on /pro (public) which renders the signed-out "check your
      // email for your sign-in link" state; /account would bounce to /login.
      params.success_url = `${origin}/pro?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
      params.subscription_data = {
        trial_period_days: PRO_TRIAL_DAYS,
        metadata: { guest_checkout: "true", ...attribution },
      };
    }

    const session = await stripe().checkout.sessions.create(params);
    checkoutUrl = session.url ?? null;
  } catch (err) {
    console.error("[billing] Stripe Checkout session failed:", err);
    const webhook = process.env.DISCORD_WEBHOOK_ERRORS;
    if (webhook) {
      // Fire-and-forget; a Discord outage must never block the redirect.
      void postError(webhook, {
        source: "pro-checkout",
        errorType: "checkout_session_failed",
        message: err instanceof Error ? err.message : String(err),
        context: { signedIn: user ? "yes" : "no" },
      }).catch(() => {});
    }
  }

  if (!checkoutUrl) redirect("/pro?checkout=unavailable");
  redirect(checkoutUrl);
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
