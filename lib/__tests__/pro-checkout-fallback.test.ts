// /pro trial-CTA failure honesty (round-2 tour Blocker, 2026-07-12).
//
// Seen live on the start-binder-delight preview: STRIPE_SECRET_KEY is
// Production-scoped on Vercel, so the createCheckoutSession server action
// threw on every preview deployment and the buyer got Next's raw error page
// ("A server error occurred", digest 572704498) at the moment of highest
// intent. These pins guarantee the action can never surface a raw throw
// again: every Stripe touch is inside a try whose catch swallows (and
// notifies #errors), and the no-URL path redirects to an honest canon-voice
// /pro state instead.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const actions = readFileSync(join(ROOT, "app", "upload", "billing-actions.ts"), "utf8");
const proPage = readFileSync(join(ROOT, "app", "pro", "page.tsx"), "utf8");

function sliceBetween(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  assert.notEqual(a, -1, `marker not found: ${start}`);
  const b = src.indexOf(end, a);
  assert.notEqual(b, -1, `marker not found after ${start}: ${end}`);
  return src.slice(a, b);
}

test("every Stripe call in createCheckoutSession sits inside the try block", () => {
  const fn = sliceBetween(actions, "export async function createCheckoutSession", "export async function openCustomerPortal");
  const tryStart = fn.indexOf("try {");
  const catchStart = fn.indexOf("} catch");
  assert.ok(tryStart !== -1 && catchStart !== -1 && tryStart < catchStart, "action has a try/catch");

  for (const call of ["resolveProPriceId()", "getOrCreateStripeCustomer(", "trialAlreadyUsed(", "stripe().checkout.sessions.create("]) {
    const at = fn.indexOf(call);
    assert.ok(at > tryStart && at < catchStart, `${call} must be inside the try block`);
  }
});

test("the catch never rethrows and soft-fails to the #errors webhook", () => {
  const fn = sliceBetween(actions, "export async function createCheckoutSession", "export async function openCustomerPortal");
  const catchBody = sliceBetween(fn, "} catch", "if (!checkoutUrl)");
  assert.ok(!/\bthrow\b/.test(catchBody), "catch must not rethrow (a throw renders the raw error page)");
  assert.ok(catchBody.includes("postError"), "checkout failure pings #errors");
  assert.ok(catchBody.includes(".catch(() => {})"), "the Discord ping itself is fire-and-forget");
});

test("no checkout URL redirects to the honest /pro state, never a throw", () => {
  assert.ok(actions.includes(`redirect("/pro?checkout=unavailable")`));
  const fn = sliceBetween(actions, "export async function createCheckoutSession", "export async function openCustomerPortal");
  assert.ok(!fn.includes("throw new Error"), "the action body must not throw to the caller");
});

test("/pro renders the canon-voice unavailable banner", () => {
  assert.ok(proPage.includes(`params.checkout === "unavailable"`));
  const banner = sliceBetween(proPage, `params.checkout === "unavailable"`, "</div>");
  assert.ok(banner.includes("Checkout didn"), "leads with what happened");
  assert.ok(banner.includes("No charge was made"), "says what it means for the buyer's money");
});
