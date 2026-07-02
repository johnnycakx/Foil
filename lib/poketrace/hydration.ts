// Demand-driven hydration plumbing (demand-driven-data, ADR-092).
//
// Three pieces, all soft-fail, all IO-injectable for tests:
//   enqueueHydrationIfNeeded — the TRIGGER. Called from the shared watchlist
//     upsert: a new watch on a card with no baked PokeTrace variants enqueues
//     it (idempotent PK insert). Demand allocates the data budget.
//   drainHydrationQueue — the WORKER core. Pure orchestration over injected
//     IO: fetch pending rows (capped), resolve each via the ONE shared
//     resolution path (hydrate-core), persist the outcome. The cron route
//     provides the live IO + pacing.
//   getHydratedVariants — the READER. Surfaces (card page, movers cron) merge
//     these under the baked snapshot: baked wins; DB fills the gap until the
//     next bake run folds hydrated cards in.
//
// Prioritization doctrine (recorded per the goal): watched > high-value >
// everything else. NEVER bulk-hydrate the full catalog — the 10K req/day
// PokeTrace ceiling and the renewal cost are the budget; demand spends it.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types.ts";
import { supabaseAdmin } from "../supabase/admin.ts";
import { getCatalogEntry } from "../cards/catalog.ts";
import { getBakedCardMetadata } from "../cards/sdk.ts";
import type { PoketraceVariant } from "./variant.ts";
import type { HydrateOutcome } from "./hydrate-core.ts";

/** Max cards resolved per worker run. Each card costs 1–5 PokeTrace calls
 *  (the market ladder), so 50 ≈ ≤250 calls/run — far under 10K/day even
 *  hourly, and the 200ms pacing keeps each run under the 30 req/10s burst. */
export const HYDRATION_RUN_CAP = 50;

/** Give up on a card after this many failed attempts (transient-error class);
 *  the worker pings #errors when a card crosses it. */
export const HYDRATION_MAX_ATTEMPTS = 3;

export type HydrationRow = {
  card_slug: string;
  status: "pending" | "hydrated" | "no_match" | "failed";
  attempts: number;
};

/**
 * Enqueue a card for hydration IF its catalog entry has no baked PokeTrace
 * variants. Idempotent (PK insert, duplicates ignored) + soft-fail — a queue
 * hiccup must never block the watch write that triggered it. Returns what
 * happened for telemetry/tests.
 */
export async function enqueueHydrationIfNeeded(
  cardSlug: string,
  deps: {
    getClient?: () => SupabaseClient<Database>;
    /** Injectable baked-variants probe (tests). Default: catalog → snapshot. */
    hasBakedVariants?: (slug: string) => boolean;
  } = {},
): Promise<"enqueued" | "already_hydrated" | "not_in_catalog" | "skipped" | "error"> {
  try {
    if (deps.hasBakedVariants) {
      if (deps.hasBakedVariants(cardSlug)) return "already_hydrated";
    } else {
      const entry = getCatalogEntry(cardSlug);
      if (!entry) return "not_in_catalog";
      const baked = getBakedCardMetadata(entry.pokemonTcgId);
      if ((baked?.variants?.length ?? 0) > 0) return "already_hydrated";
    }

    const db = (deps.getClient ? deps.getClient() : supabaseAdmin()) as unknown as SupabaseClient;
    const { error } = await db
      .from("card_hydration")
      .upsert({ card_slug: cardSlug }, { onConflict: "card_slug", ignoreDuplicates: true });
    if (error) {
      console.warn(`[hydration] enqueue failed for ${cardSlug}: ${error.message}`);
      return "error";
    }
    return "enqueued";
  } catch (err) {
    console.warn(`[hydration] enqueue threw for ${cardSlug}: ${(err as Error).message}`);
    return "error";
  }
}

/** DB-hydrated variants for a slug, or [] — the surfaces' merge fallback when
 *  the baked snapshot has none. Soft-fail to []. */
export async function getHydratedVariants(
  cardSlug: string,
  deps: { getClient?: () => SupabaseClient<Database> } = {},
): Promise<{ variants: PoketraceVariant[]; hydratedAt: string | null }> {
  try {
    const db = (deps.getClient ? deps.getClient() : supabaseAdmin()) as unknown as SupabaseClient;
    const { data, error } = await db
      .from("card_hydration")
      .select("variants, hydrated_at, status")
      .eq("card_slug", cardSlug)
      .eq("status", "hydrated")
      .maybeSingle();
    if (error || !data || !Array.isArray(data.variants)) return { variants: [], hydratedAt: null };
    return {
      variants: data.variants as PoketraceVariant[],
      hydratedAt: (data.hydrated_at as string | null) ?? null,
    };
  } catch {
    return { variants: [], hydratedAt: null };
  }
}

/** ALL hydrated variants as slug → variants — the movers cron's merge input
 *  (one query for the whole sweep instead of one per card). Soft-fail to an
 *  empty map. */
export async function getAllHydratedVariants(
  deps: { getClient?: () => SupabaseClient<Database> } = {},
): Promise<Map<string, PoketraceVariant[]>> {
  const out = new Map<string, PoketraceVariant[]>();
  try {
    const db = (deps.getClient ? deps.getClient() : supabaseAdmin()) as unknown as SupabaseClient;
    const { data, error } = await db
      .from("card_hydration")
      .select("card_slug, variants")
      .eq("status", "hydrated");
    if (error || !data) return out;
    for (const r of data) {
      if (typeof r.card_slug === "string" && Array.isArray(r.variants) && r.variants.length > 0) {
        out.set(r.card_slug, r.variants as PoketraceVariant[]);
      }
    }
    return out;
  } catch {
    return out;
  }
}

// ---------------------------------------------------------------------------
// Worker core — pure orchestration over injected IO.
// ---------------------------------------------------------------------------

export type DrainDeps = {
  /** Oldest pending/failed rows, capped. The cron route implements via SQL. */
  fetchDue(cap: number): Promise<{ rows: HydrationRow[]; error: string | null }>;
  /** The ONE resolution path (hydrate-core) — injected so tests never hit
   *  PokeTrace and the route wires pacing + the API key. */
  resolve(cardSlug: string): Promise<HydrateOutcome>;
  /** Persist one outcome. */
  persist(
    cardSlug: string,
    patch: {
      status: "hydrated" | "no_match" | "failed";
      variants?: PoketraceVariant[];
      attempts: number;
      note?: string;
      hydrated_at?: string;
    },
  ): Promise<{ error: string | null }>;
  /** Pace between cards (the route sleeps; tests no-op). */
  pace?: () => Promise<void>;
  /** Ping #errors when a card exhausts its attempts. */
  onExhausted?: (cardSlug: string, note: string) => void;
  nowIso?: string;
  cap?: number;
};

export type DrainResult = {
  processed: number;
  hydrated: number;
  noMatch: number;
  failed: number;
  exhausted: number;
  errors: string[];
};

/**
 * Drain one worker pass. Caps the batch, resolves each card through the
 * shared path, persists per-card outcomes, never throws. `failed` rows keep
 * accumulating attempts until HYDRATION_MAX_ATTEMPTS; crossing it pings
 * #errors (via onExhausted) and the row stops being fetched (fetchDue's SQL
 * excludes exhausted rows).
 */
export async function drainHydrationQueue(deps: DrainDeps): Promise<DrainResult> {
  const cap = deps.cap ?? HYDRATION_RUN_CAP;
  const result: DrainResult = { processed: 0, hydrated: 0, noMatch: 0, failed: 0, exhausted: 0, errors: [] };

  const due = await deps.fetchDue(cap);
  if (due.error) {
    result.errors.push(`fetch_due: ${due.error}`);
    return result;
  }

  for (const row of due.rows.slice(0, cap)) {
    result.processed += 1;
    if (deps.pace) await deps.pace();

    let outcome: HydrateOutcome;
    try {
      outcome = await deps.resolve(row.card_slug);
    } catch (err) {
      outcome = { status: "error", variants: [], note: (err as Error).message };
    }

    if (outcome.status === "matched" || outcome.status === "ambiguous") {
      const wrote = await deps.persist(row.card_slug, {
        status: "hydrated",
        variants: outcome.variants,
        attempts: row.attempts + 1,
        note: outcome.note,
        hydrated_at: deps.nowIso ?? new Date().toISOString(),
      });
      if (wrote.error) result.errors.push(`persist ${row.card_slug}: ${wrote.error}`);
      else result.hydrated += 1;
      continue;
    }

    if (outcome.status === "no_match") {
      // Terminal — PokeTrace genuinely lacks the card; never retried.
      const wrote = await deps.persist(row.card_slug, {
        status: "no_match",
        attempts: row.attempts + 1,
        note: outcome.note,
      });
      if (wrote.error) result.errors.push(`persist ${row.card_slug}: ${wrote.error}`);
      else result.noMatch += 1;
      continue;
    }

    // Transient error — retry on later runs until the attempt cap.
    const attempts = row.attempts + 1;
    const wrote = await deps.persist(row.card_slug, {
      status: "failed",
      attempts,
      note: outcome.note,
    });
    if (wrote.error) result.errors.push(`persist ${row.card_slug}: ${wrote.error}`);
    result.failed += 1;
    if (attempts >= HYDRATION_MAX_ATTEMPTS) {
      result.exhausted += 1;
      deps.onExhausted?.(row.card_slug, outcome.note);
    }
  }

  return result;
}
