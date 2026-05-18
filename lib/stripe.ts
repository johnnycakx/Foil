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
export const PRO_PRICE_USD_CENTS = 1499;
export const PRO_TIER = "pro";
export const FREE_TIER = "free";
export const FREE_DAILY_SCAN_LIMIT = 1;
