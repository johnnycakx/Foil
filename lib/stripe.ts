import Stripe from "stripe";

export const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return _stripe;
}

export const PRO_PRODUCT_NAME = "Foil Pro";
// $6/mo (validation-sprint Phase 2). Repurposed from the parked $14.99 scan
// paywall (ADR-020) to the deal-finder Pro tier: daily deal drop + personal
// price watches. A 30-day card-required trial is added at Checkout, not here.
export const PRO_PRICE_USD_CENTS = 600;
/** Trial length for the Foil Pro Checkout Session (card required, per ADR-111). */
export const PRO_TRIAL_DAYS = 30;
export const PRO_TIER = "pro";
export const FREE_TIER = "free";
export const FREE_DAILY_SCAN_LIMIT = 1;
