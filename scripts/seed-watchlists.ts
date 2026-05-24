// Watchlist diversification seeder. See Session 31 SESSION-LOG.
//
// Inserts 12 service-role watchlist rows distributed across the catalog
// AND across the 24h cron window, to amplify the Browse-call evidence
// pool for ROADMAP NOW #10 (eBay Application Growth Check). All emails
// route to john.c.craig24@gmail.com via +alias addresses (Gmail delivers
// `name+wDIV01@gmail.com` → `name@gmail.com` while keeping the alias in
// the To: header for filtering).
//
// Run from the repo root:
//   SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN node \
//     --experimental-strip-types scripts/seed-watchlists.ts
//
// Idempotent guard: if a row already exists for (email, card_slug) the
// PostgREST insert returns 409. The script reports + continues.

import fs from "node:fs";
import path from "node:path";

// Inline .env.local loader (same pattern as scripts/flush-digest.ts).
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[seed] NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

// The seed set itself — extracted to a pure constant in lib/wishlist/
// so lib/__tests__/watchlist-diversification.test.ts can exercise the
// distribution invariants without touching Supabase. Lives under lib/
// rather than scripts/ so the test (which is typechecked) can import
// from a location tsconfig includes.
import { SEED_ROWS, type SeedRow } from "../lib/wishlist/seed-data.ts";

function staggeredCooldown(now: Date, indexZeroBased: number, count: number): string {
  // last_notified_at = now - (i * 24h / count). For count=12 the deltas
  // are 0h, 2h, 4h, ..., 22h. After this seed runs, the first row is in
  // cooldown immediately; subsequent rows expire cooldown at distributed
  // hourly ticks across the next 24h window.
  const hoursAgo = (indexZeroBased * 24) / count;
  return new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString();
}

async function insertRow(row: SeedRow, lastNotifiedAt: string): Promise<void> {
  const body = JSON.stringify({
    email: row.email,
    card_slug: row.card_slug,
    target_price_cents: row.target_price_cents,
    last_notified_at: lastNotifiedAt,
  });
  const url = `${SUPABASE_URL}/rest/v1/watchlists`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`[seed] ${row.email} / ${row.card_slug} → HTTP ${res.status}: ${text.slice(0, 200)}`);
    return;
  }
  console.log(`[seed] ${row.email} / ${row.card_slug} (target $${(row.target_price_cents / 100).toFixed(2)}, last_notified_at = ${lastNotifiedAt})`);
}

const now = new Date();
const total = SEED_ROWS.length;
console.log(`[seed] inserting ${total} rows distributed across 24h cooldown window`);

for (let i = 0; i < SEED_ROWS.length; i++) {
  const row = SEED_ROWS[i];
  const lastNotifiedAt = staggeredCooldown(now, i, total);
  await insertRow(row, lastNotifiedAt);
}

console.log("[seed] done");
