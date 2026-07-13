// Free-tier product cap (offer item 1a; ADR-116): one binder page — 9 ACTIVE
// watches per email (`FREE_PAGE_SLEEVES`).
//
// Distinct from the 100-row abuse cap in lib/start/guards.ts — that one bounds
// abuse for everyone; this one is the free/pro product line. Seeded gift-vault
// rows (identified by their vault src tag) never count, and re-adding a card
// the email already watches is an update, not a new watch, so it always
// passes. On a DB read failure the check fails OPEN (a flaky read must not
// block a signup funnel; the abuse cap still bounds the damage).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import type { Tier } from "../entitlements";
import { getTierByEmail } from "../entitlements.ts";
import { FREE_WATCH_CAP, countsTowardFreeCap } from "../offer.ts";

type Client = SupabaseClient<Database>;

export type FreeCapResult = {
  allowed: boolean;
  tier: Tier;
  /** Active, cap-counting watches the email holds right now. */
  activeCount: number;
  cap: number;
};

type WatchRowLite = {
  card_slug: string;
  src: string | null;
  alerts_paused_at: string | null;
};

/** Pure core, test-pinnable: does adding `requestedSlugs` break the cap? */
export function evaluateFreeCap(
  tier: Tier,
  existing: WatchRowLite[],
  requestedSlugs: string[],
): FreeCapResult {
  const activeCount = existing.filter(
    (r) => r.alerts_paused_at === null && countsTowardFreeCap(r.src),
  ).length;
  if (tier === "pro") return { allowed: true, tier, activeCount, cap: FREE_WATCH_CAP };
  const known = new Set(existing.map((r) => r.card_slug));
  const newCount = new Set(requestedSlugs.filter((s) => !known.has(s))).size;
  return {
    allowed: activeCount + newCount <= FREE_WATCH_CAP,
    tier,
    activeCount,
    cap: FREE_WATCH_CAP,
  };
}

export async function checkFreeWatchCap(
  client: Client,
  email: string,
  requestedSlugs: string[],
): Promise<FreeCapResult> {
  const normalized = email.trim().toLowerCase();
  const tier = await getTierByEmail(client, normalized);
  if (tier === "pro") return { allowed: true, tier, activeCount: 0, cap: FREE_WATCH_CAP };
  const { data, error } = await client
    .from("watchlists")
    .select("card_slug, src, alerts_paused_at")
    .eq("email", normalized);
  if (error) {
    console.error(`[free-cap] watch read failed: ${error.message}`);
    return { allowed: true, tier, activeCount: 0, cap: FREE_WATCH_CAP };
  }
  return evaluateFreeCap(tier, (data ?? []) as WatchRowLite[], requestedSlugs);
}
