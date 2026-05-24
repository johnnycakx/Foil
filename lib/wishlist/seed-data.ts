// Watchlist seed data — extracted to a pure module so
// lib/__tests__/watchlist-diversification.test.ts can exercise the
// distribution invariants without touching Supabase + without pulling
// in the script's filesystem env-loader.
//
// Buckets per the goal spec:
//   * 4 vintage holos (base2-6 / gym / neo eras)
//   * 4 modern chase (sv / swsh / cel25)
//   * 2 mid-era substituted with additional modern chase (the catalog
//     doesn't cover xy* or sm* outside sm115; substitution authorized
//     by the goal spec)
//   * 2 intentionally-unreachable targets (target ~ $1, will never
//     alert — exercises the cron's "scan-but-skip" path)
//
// Email aliases: `john.c.craig24+wDIV01@gmail.com` through `+wDIV12`.
// Gmail strips the `+...` for delivery routing but preserves it in
// To: so John can filter inbound diversification traffic if desired.

export type SeedBucket = "vintage" | "modern" | "modern_substitute" | "unreachable";

export type SeedRow = {
  email: string;
  card_slug: string;
  target_price_cents: number;
  bucket: SeedBucket;
};

export const SEED_ROWS: readonly SeedRow[] = [
  // 4 vintage holos — pre-2001 WotC era (Jungle/Fossil/Gym/Neo).
  // Targets set well above current Browse prices so they alert daily.
  { email: "john.c.craig24+wDIV01@gmail.com", card_slug: "base2-3-flareon",          target_price_cents: 30000, bucket: "vintage" },
  { email: "john.c.craig24+wDIV02@gmail.com", card_slug: "base3-1-aerodactyl",       target_price_cents: 20000, bucket: "vintage" },
  { email: "john.c.craig24+wDIV03@gmail.com", card_slug: "gym1-1-blaines-moltres",   target_price_cents: 15000, bucket: "vintage" },
  { email: "john.c.craig24+wDIV04@gmail.com", card_slug: "neo1-4-feraligatr",        target_price_cents: 12000, bucket: "vintage" },

  // 4 modern chase — Sword & Shield era + Scarlet & Violet era. Targets
  // above current Browse prices.
  { email: "john.c.craig24+wDIV05@gmail.com", card_slug: "sv3pt5-198-venusaur-ex",   target_price_cents:  8000, bucket: "modern" },
  { email: "john.c.craig24+wDIV06@gmail.com", card_slug: "swsh9-18-charizard-vstar", target_price_cents:  9000, bucket: "modern" },
  { email: "john.c.craig24+wDIV07@gmail.com", card_slug: "swsh12pt5-19-charizard-vstar", target_price_cents: 11000, bucket: "modern" },
  { email: "john.c.craig24+wDIV08@gmail.com", card_slug: "cel25-11-mew",             target_price_cents:  6000, bucket: "modern" },

  // 2 mid-era substitute slots — catalog has no xy* or sm* (except
  // sm115). Per goal spec, substitute with additional modern chase.
  // Both are realistic borderline targets — current Browse price could
  // be either side of the threshold day-to-day.
  { email: "john.c.craig24+wDIV09@gmail.com", card_slug: "sm115-9-charizard-gx",     target_price_cents:  4000, bucket: "modern_substitute" },
  { email: "john.c.craig24+wDIV10@gmail.com", card_slug: "swsh7-29-gyarados-vmax",   target_price_cents:  2500, bucket: "modern_substitute" },

  // 2 intentionally-unreachable — target ~$1 will (almost) never meet
  // current price; exercises the cron's "found listing, didn't alert"
  // branch + still contributes a Browse call to the telemetry pool.
  { email: "john.c.craig24+wDIV11@gmail.com", card_slug: "swsh7-18-flareon-vmax",    target_price_cents:   100, bucket: "unreachable" },
  { email: "john.c.craig24+wDIV12@gmail.com", card_slug: "cel25-16-zacian-v",        target_price_cents:   100, bucket: "unreachable" },
];
