// One-time Stripe setup: ensures a "Foil Pro" product and a $14.99/month
// recurring price exist. Idempotent — safe to re-run; it will not duplicate.
//
// Usage:
//   node --experimental-strip-types scripts/setup-stripe.ts
//
// After running, copy the printed STRIPE_PRO_PRICE_ID into .env.local
// (or rely on the lookup_key — the app resolves it automatically).

import fs from "node:fs";
import path from "node:path";
import { ensureProProductAndPrice, FOIL_PRO_LOOKUP_KEY } from "../lib/stripe-setup.ts";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY not set");
}

const result = await ensureProProductAndPrice();
console.log("Stripe setup complete.");
console.log(`  product  : ${result.productId} ${result.reused.product ? "(reused)" : "(created)"}`);
console.log(`  price    : ${result.priceId} ${result.reused.price ? "(reused)" : "(created)"}`);
console.log(`  lookup   : ${FOIL_PRO_LOOKUP_KEY}`);
console.log(`\nOptional: add this to .env.local to skip the lookup_key fetch on first checkout:\n  STRIPE_PRO_PRICE_ID=${result.priceId}`);
