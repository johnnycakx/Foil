import type Stripe from "stripe";
import {
  PRO_PRICE_USD_CENTS,
  PRO_PRODUCT_NAME,
  stripe,
} from "./stripe.ts";

const LOOKUP_KEY = "foil_pro_monthly";

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
      description: "Unlimited Pokémon card scans, full per-card breakdown, 90-day history, no watermark.",
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
      nickname: "Foil Pro — $14.99/mo",
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
