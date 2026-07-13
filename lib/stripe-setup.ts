import type Stripe from "stripe";
import {
  PRO_PRICE_USD_CENTS,
  PRO_PRODUCT_NAME,
  stripe,
} from "./stripe.ts";

// v2 key (validation-sprint Phase 2): the old "foil_pro_monthly" is bound to the
// parked $14.99 price object. A NEW key forces `ensureProProductAndPrice` to
// create a fresh $6 price instead of silently reusing the $14.99 one (Stripe
// prices are immutable — you can't change the amount on an existing price).
const LOOKUP_KEY = "foil_pro_monthly_v2";

// Shown by Stripe Checkout beside the price — must describe the CURRENT
// deal-finder Pro offer (mirrors /pro), never the parked scanner tier.
// No em dashes (John's standing voice rule; V6.5 finding S5 — a buyer sees
// this string beside the price in Stripe Checkout).
const PRO_PRODUCT_DESCRIPTION =
  "The daily deal drop plus personal price watches. Foil pings you the moment a card you're chasing hits your price, judged on real sold data.";

export type SetupResult = {
  productId: string;
  priceId: string;
  reused: { product: boolean; price: boolean };
};

export async function ensureProProductAndPrice(): Promise<SetupResult> {
  const s = stripe();

  let product: Stripe.Product | null = null;
  let productReused = false;
  for await (const p of s.products.list({ active: true, limit: 100 })) {
    if (p.name === PRO_PRODUCT_NAME) {
      product = p;
      productReused = true;
      break;
    }
  }
  if (!product) {
    product = await s.products.create({
      name: PRO_PRODUCT_NAME,
      description: PRO_PRODUCT_DESCRIPTION,
    });
  } else if (product.description !== PRO_PRODUCT_DESCRIPTION) {
    // The reused product may still carry the parked scanner-era description
    // ("Unlimited Pokémon card scans…") — Checkout renders it beside the $6
    // offer, so a buyer would see copy for a product that no longer exists
    // (funnel-stress-test 2026-07-11). Idempotent refresh on every setup run.
    product = await s.products.update(product.id, {
      description: PRO_PRODUCT_DESCRIPTION,
    });
  }

  const existingPrices = await s.prices.list({
    lookup_keys: [LOOKUP_KEY],
    expand: ["data.product"],
    limit: 1,
  });
  let price: Stripe.Price | null = existingPrices.data[0] ?? null;
  let priceReused = !!price;

  if (!price) {
    price = await s.prices.create({
      product: product.id,
      unit_amount: PRO_PRICE_USD_CENTS,
      currency: "usd",
      recurring: { interval: "month" },
      lookup_key: LOOKUP_KEY,
      nickname: "Foil Pro — $6/mo",
    });
  } else if (typeof price.product !== "string" && price.product.id !== product.id) {
    // Lookup key already in use for a different product — refuse to clobber.
    throw new Error(
      `Stripe price with lookup_key "${LOOKUP_KEY}" is attached to a different product. Delete or rename it before re-running setup.`,
    );
  }

  return {
    productId: product.id,
    priceId: price.id,
    reused: { product: productReused, price: priceReused },
  };
}

export const FOIL_PRO_LOOKUP_KEY = LOOKUP_KEY;
