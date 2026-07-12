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
import { createClient as createBareClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { subscriptionTier, periodEndIso } from "@/lib/stripe-entitlement";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { trialAlreadyUsed } from "@/lib/stripe-trial";
import { sendTransactionalEmail } from "@/lib/notifications/resend";

export const runtime = "nodejs";

async function upsertFromSubscription(
  sub: Stripe.Subscription,
  supabaseUserId: string | null,
  knownEmail?: string | null,
) {
  const admin = supabaseAdmin();
  const tier = subscriptionTier(sub.status);

  if (supabaseUserId) {
    // The email→tier bridge: every row carries its lowercased email so the
    // email-anchored watch subsystem can answer tier questions. Resolve from
    // the auth user when the event didn't carry one.
    let email = knownEmail?.trim().toLowerCase() || null;
    if (!email) {
      const { data } = await admin.auth.admin.getUserById(supabaseUserId);
      email = data?.user?.email?.toLowerCase() ?? null;
    }
    await admin.from("subscriptions").upsert(
      {
        user_id: supabaseUserId,
        stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        stripe_subscription_id: sub.id,
        status: sub.status,
        tier,
        current_period_end: periodEndIso(sub),
        ...(email ? { email } : {}),
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

/**
 * Guest payment-first checkout (offer 1d): a session completed with no
 * supabase user attached. Resolve the account by the email Checkout
 * collected — lookup-FIRST so an existing account links and never
 * duplicates — create one if missing, upsert the entitlement row, and send
 * the sign-in magic link. Also closes the guest side of the one-trial gate
 * (1c): a trialing sub whose email already used a trial is canceled before
 * any charge (trial = $0 due, so an immediate cancel invoices nothing) and
 * the buyer gets an honest explanation instead of a surprise charge.
 */
async function resolveGuestCheckout(session: Stripe.Checkout.Session, sub: Stripe.Subscription) {
  const email =
    session.customer_details?.email?.trim().toLowerCase() ||
    session.customer_email?.trim().toLowerCase() ||
    null;
  if (!email) {
    console.error(`[stripe webhook] guest session ${session.id} has no email — cannot link`);
    return;
  }

  if (sub.status === "trialing" && (await trialAlreadyUsed(email, { excludeSubscriptionId: sub.id }))) {
    await stripe().subscriptions.cancel(sub.id);
    console.warn(`[stripe webhook] repeat-trial guest checkout canceled sub=${sub.id}`);
    await sendTransactionalEmail({
      to: email,
      subject: "About your Foil checkout",
      html: [
        "<p>You started a Foil Pro checkout with an email that already used its 30-day trial. Foil gives one trial per person, so this new subscription was canceled before any charge.</p>",
        '<p>Still want Pro? Sign in at <a href="https://foiltcg.com/login">foiltcg.com/login</a> and subscribe from your account. You will see the plain $6 a month price at checkout.</p>',
        "<p>Questions? Just reply to this email.</p>",
      ].join("\n"),
    }).catch((err) => console.warn(`[stripe webhook] repeat-trial email failed: ${err}`));
    return;
  }

  const admin = supabaseAdmin();

  // Lookup-FIRST (SECURITY DEFINER function over auth.users), then create.
  let userId: string | null = null;
  const { data: existingId, error: rpcError } = await admin.rpc("get_user_id_by_email", {
    p_email: email,
  });
  if (rpcError) {
    console.error(`[stripe webhook] get_user_id_by_email failed: ${rpcError.message}`);
  }
  userId = (existingId as string | null) ?? null;

  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError) {
      // Race: the address registered between lookup and create — re-look-up.
      const { data: retryId } = await admin.rpc("get_user_id_by_email", { p_email: email });
      userId = (retryId as string | null) ?? null;
      if (!userId) {
        console.error(`[stripe webhook] cannot resolve account for guest checkout: ${createError.message}`);
        return;
      }
    } else {
      userId = created.user.id;
    }
  }

  // Duplicate-purchase guard: if this account already has a LIVE subscription
  // under a different Stripe sub id, cancel the new one instead of letting a
  // second $6 line item bill the same person twice.
  const { data: existingRow } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  const live = existingRow as { stripe_subscription_id: string | null; status: string | null } | null;
  if (
    live?.stripe_subscription_id &&
    live.stripe_subscription_id !== sub.id &&
    ["active", "trialing"].includes(live.status ?? "")
  ) {
    await stripe().subscriptions.cancel(sub.id);
    console.warn(`[stripe webhook] duplicate guest sub canceled sub=${sub.id} user=${userId}`);
    return;
  }

  await upsertFromSubscription(sub, userId, email);

  // The sign-in link, via the existing Supabase auth mailer. Soft-fail: the
  // entitlement row is already written, and /login can mint a fresh link any
  // time. NOTE for John: the email's subject/copy ("Foil is set up — your
  // sign-in link") is the Supabase magic-link TEMPLATE, edited in the
  // dashboard, not in code.
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anonKey) {
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://foiltcg.com";
      const bare = createBareClient(url, anonKey, { auth: { persistSession: false } });
      const { error: otpError } = await bare.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: `${site}/auth/callback?next=/start` },
      });
      if (otpError) console.warn(`[stripe webhook] magic-link send failed: ${otpError.message}`);
    }
  } catch (err) {
    console.warn(`[stripe webhook] magic-link send threw: ${(err as Error).message}`);
  }
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
          if (supabaseUserId) {
            await upsertFromSubscription(sub, supabaseUserId, session.customer_details?.email ?? null);
          } else {
            // Payment-first guest checkout (offer 1d): resolve the account by
            // email, link or create it, then send the sign-in link.
            await resolveGuestCheckout(session, sub);
          }
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
