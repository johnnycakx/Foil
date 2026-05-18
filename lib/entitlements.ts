import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import { FREE_DAILY_SCAN_LIMIT, FREE_TIER, PRO_TIER } from "./stripe";

type Client = SupabaseClient<Database>;

export type Tier = "free" | "pro";

export type Entitlements = {
  tier: Tier;
  scansToday: number;
  remainingFreeScans: number;  // Infinity for Pro
  rateLimited: boolean;        // true when a free user has no scans left today
  periodEnd: string | null;    // ISO timestamp for Pro; null for free
};

export async function getEntitlements(
  client: Client,
  userId: string,
): Promise<Entitlements> {
  const tier = await getTier(client, userId);
  const periodEnd = await getCurrentPeriodEnd(client, userId);

  if (tier === PRO_TIER) {
    return {
      tier,
      scansToday: 0,
      remainingFreeScans: Number.POSITIVE_INFINITY,
      rateLimited: false,
      periodEnd,
    };
  }

  const scansToday = await countScansToday(client, userId);
  const remainingFreeScans = Math.max(0, FREE_DAILY_SCAN_LIMIT - scansToday);
  return {
    tier: FREE_TIER,
    scansToday,
    remainingFreeScans,
    rateLimited: remainingFreeScans === 0,
    periodEnd: null,
  };
}

export async function getTier(
  client: Client,
  userId: string,
): Promise<Tier> {
  const { data, error } = await client
    .from("subscriptions")
    .select("tier, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error(`[entitlements] read failed: ${error.message}`);
    return FREE_TIER;
  }
  if (!data) return FREE_TIER;
  const rec = data as { tier: string; status: string | null; current_period_end: string | null };
  if (rec.tier !== PRO_TIER) return FREE_TIER;
  // Treat past_due / canceled / unpaid as free; trialing + active are Pro.
  if (rec.status && !["active", "trialing"].includes(rec.status)) return FREE_TIER;
  if (rec.current_period_end && Date.parse(rec.current_period_end) < Date.now()) {
    return FREE_TIER;
  }
  return PRO_TIER;
}

async function getCurrentPeriodEnd(client: Client, userId: string): Promise<string | null> {
  const { data } = await client
    .from("subscriptions")
    .select("current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  const rec = data as { current_period_end: string | null } | null;
  return rec?.current_period_end ?? null;
}

function utcDayBoundary(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function countScansToday(
  client: Client,
  userId: string,
): Promise<number> {
  const since = utcDayBoundary();
  const { count, error } = await client
    .from("scans")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("scanned_at", since);
  if (error) {
    console.error(`[entitlements] count failed: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}

export async function recordScan(
  client: Client,
  userId: string,
  imageMetadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await client.from("scans").insert({
    user_id: userId,
    image_metadata: imageMetadata,
  });
  if (error) {
    console.error(`[entitlements] insert scan failed: ${error.message}`);
  }
}
