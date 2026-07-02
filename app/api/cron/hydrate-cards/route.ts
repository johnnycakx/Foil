// Demand-driven PokeTrace hydration worker (demand-driven-data, ADR-092).
//
// Hourly Vercel Cron Job (vercel.json crons[] entry, :10 past — off the :00
// stampede). Drains card_hydration: for each pending/failed card (oldest
// first, capped at HYDRATION_RUN_CAP), resolves PokeTrace variants via the
// ONE shared resolution path (lib/poketrace/hydrate-core.ts — the same code
// the bake script runs) and persists the outcome on the row. The card page +
// the movers cron read hydrated variants as the fallback under the baked
// snapshot.
//
// Rate discipline: 200ms pacing between cards → ≤5 calls per card via the
// market ladder ≈ ≤250 PokeTrace calls per run, under the 30 req/10s burst
// and far under the 10K/day ceiling. NEVER bulk-hydrates the catalog —
// demand (watches) + the one-time top-100 seed allocate the budget.
//
// Auth: same bearer-secret contract as the other crons (ADR-024).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCatalogEntry } from "@/lib/cards/catalog";
import { getBakedCardMetadata, getBakedSetMetadata } from "@/lib/cards/sdk";
import { resolveVariantsForCard, HYDRATE_REQ_INTERVAL_MS } from "@/lib/poketrace/hydrate-core";
import {
  drainHydrationQueue,
  HYDRATION_MAX_ATTEMPTS,
  HYDRATION_RUN_CAP,
  type HydrationRow,
} from "@/lib/poketrace/hydration";
import { postError } from "@/lib/notifications/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.warn("[hydrate-cron] CRON_SECRET not set — returning 503");
    return new NextResponse("missing_cron_secret", { status: 503 });
  }
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (header !== `Bearer ${expected}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const apiKey = process.env.POKETRACE_API_KEY ?? "";
  const startedAt = Date.now();
  const db = supabaseAdmin() as unknown as SupabaseClient;

  const result = await drainHydrationQueue({
    async fetchDue(cap) {
      const { data, error } = await db
        .from("card_hydration")
        .select("card_slug, status, attempts")
        .in("status", ["pending", "failed"])
        .lt("attempts", HYDRATION_MAX_ATTEMPTS)
        .order("requested_at", { ascending: true })
        .limit(cap);
      if (error) return { rows: [], error: error.message };
      return { rows: (data ?? []) as HydrationRow[], error: null };
    },
    async resolve(cardSlug) {
      const entry = getCatalogEntry(cardSlug);
      if (!entry) return { status: "no_match", variants: [], note: "slug not in catalog" };
      const baked = getBakedCardMetadata(entry.pokemonTcgId);
      if (!baked) return { status: "error", variants: [], note: "no baked metadata for id" };
      // Real set total from the baked snapshot — the denominator match signal,
      // same fidelity the bake script gets.
      const set = getBakedSetMetadata(baked.setId);
      return resolveVariantsForCard(
        {
          slug: cardSlug,
          name: baked.name,
          setName: baked.setName,
          number: baked.number,
          setTotal: set?.total ?? 0,
        },
        { apiKey },
      );
    },
    async persist(cardSlug, patch) {
      const { error } = await db.from("card_hydration").update(patch).eq("card_slug", cardSlug);
      return { error: error ? error.message : null };
    },
    pace: () => sleep(HYDRATE_REQ_INTERVAL_MS),
    onExhausted(cardSlug, note) {
      const webhook = process.env.DISCORD_WEBHOOK_ERRORS;
      if (!webhook) return;
      void postError(webhook, {
        source: "hydrate-cron",
        errorType: "HydrationExhausted",
        message: `card failed ${HYDRATION_MAX_ATTEMPTS} hydration attempts`,
        context: { card_slug: cardSlug, note: note.slice(0, 200) },
      }).catch(() => {});
    },
    cap: HYDRATION_RUN_CAP,
  });

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    ...result,
  });
}
