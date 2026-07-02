// Demand-driven hydration tests (demand-driven-data, ADR-092). Pins the
// goal's acceptance criteria:
//   1. Creating a watch on an unhydrated card enqueues it (and the shared
//      upsert is the trigger point — structural pin).
//   2. Idempotent: re-enqueueing does nothing (PK + ignoreDuplicates);
//      already-hydrated / non-catalog cards never enqueue.
//   3. The worker caps per run and paces (no PokeTrace call storms).
//   4. Outcome handling: matched persists variants + hydrated_at; no_match is
//      terminal; transient errors retry until the attempt cap, then ping
//      #errors (onExhausted).
//   5. The surfaces merge hydrated variants under the baked snapshot
//      (structural pins on the card page + the movers cron).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types.ts";
import {
  drainHydrationQueue,
  enqueueHydrationIfNeeded,
  HYDRATION_MAX_ATTEMPTS,
  HYDRATION_RUN_CAP,
  type DrainDeps,
  type HydrationRow,
} from "../poketrace/hydration.ts";
import type { HydrateOutcome } from "../poketrace/hydrate-core.ts";
import { getManualOverride } from "../poketrace/hydrate-core.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

// Minimal fake for the upsert(ignoreDuplicates) enqueue chain.
function fakeEnqueueClient(calls: Array<{ table: string; row: unknown; opts: unknown }>) {
  return {
    from(table: string) {
      return {
        async upsert(row: unknown, opts: unknown) {
          calls.push({ table, row, opts });
          return { error: null };
        },
      };
    },
  } as unknown as SupabaseClient<Database>;
}

test("enqueue: unhydrated catalog card → idempotent PK upsert into card_hydration", async () => {
  const calls: Array<{ table: string; row: unknown; opts: unknown }> = [];
  const out = await enqueueHydrationIfNeeded("ex13-103-mewtwo-star", {
    getClient: () => fakeEnqueueClient(calls),
    hasBakedVariants: () => false,
  });
  assert.equal(out, "enqueued");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, "card_hydration");
  assert.deepEqual(calls[0].row, { card_slug: "ex13-103-mewtwo-star" });
  assert.deepEqual(calls[0].opts, { onConflict: "card_slug", ignoreDuplicates: true });
});

test("enqueue: already-hydrated card and non-catalog slug never touch the queue", async () => {
  const calls: Array<{ table: string; row: unknown; opts: unknown }> = [];
  const hydrated = await enqueueHydrationIfNeeded("base1-4-charizard", {
    getClient: () => fakeEnqueueClient(calls),
    hasBakedVariants: () => true,
  });
  assert.equal(hydrated, "already_hydrated");
  // Default probe path: a slug not in the catalog is not our card.
  const missing = await enqueueHydrationIfNeeded("totally-fake-slug", {
    getClient: () => fakeEnqueueClient(calls),
  });
  assert.equal(missing, "not_in_catalog");
  assert.equal(calls.length, 0);
});

test("enqueue: real baked card (base1-4) short-circuits via the default probe — no DB touch", async () => {
  const calls: Array<{ table: string; row: unknown; opts: unknown }> = [];
  const out = await enqueueHydrationIfNeeded("base1-4-charizard", {
    getClient: () => fakeEnqueueClient(calls),
  });
  assert.equal(out, "already_hydrated", "base1-4 has baked variants in the committed snapshot");
  assert.equal(calls.length, 0);
});

test("the shared watchlist upsert is the hydration trigger (structural)", () => {
  const src = read("lib/wishlist/upsert.ts");
  assert.match(src, /enqueueHydrationIfNeeded\(input\.card_slug/);
  assert.match(src, /if \(!error\)/, "only a successful watch write triggers hydration");
});

// ---------------------------------------------------------------------------
// Worker core
// ---------------------------------------------------------------------------

function drainHarness(over: Partial<DrainDeps> & { rows?: HydrationRow[]; outcome?: HydrateOutcome }) {
  const persisted: Array<{ slug: string; patch: Record<string, unknown> }> = [];
  const exhausted: string[] = [];
  let paceCount = 0;
  const deps: DrainDeps = {
    async fetchDue() {
      return { rows: over.rows ?? [], error: null };
    },
    async resolve() {
      return over.outcome ?? { status: "matched", variants: [{ x: 1 } as never], note: "ok" };
    },
    async persist(slug, patch) {
      persisted.push({ slug, patch: patch as Record<string, unknown> });
      return { error: null };
    },
    pace: async () => {
      paceCount += 1;
    },
    onExhausted: (slug) => exhausted.push(slug),
    nowIso: "2026-07-02T00:00:00.000Z",
    ...over,
  };
  return { deps, persisted, exhausted, paceCount: () => paceCount };
}

function pendingRows(n: number, attempts = 0): HydrationRow[] {
  return Array.from({ length: n }, (_, i) => ({
    card_slug: `slug-${i}`,
    status: "pending" as const,
    attempts,
  }));
}

test("worker: caps the batch and paces every card (no call storms)", async () => {
  const h = drainHarness({ rows: pendingRows(10), cap: 3 });
  const out = await drainHydrationQueue(h.deps);
  assert.equal(out.processed, 3, "the cap bounds the batch even when fetchDue over-returns");
  assert.equal(h.paceCount(), 3, "one pace await per card");
  assert.equal(out.hydrated, 3);
  assert.equal(HYDRATION_RUN_CAP, 50, "production cap: ≤50 cards/run ≈ ≤250 PokeTrace calls");
});

test("worker: matched persists variants + hydrated_at; no_match is terminal", async () => {
  const matched = drainHarness({ rows: pendingRows(1) });
  await drainHydrationQueue(matched.deps);
  assert.equal(matched.persisted[0].patch.status, "hydrated");
  assert.ok(Array.isArray(matched.persisted[0].patch.variants));
  assert.equal(matched.persisted[0].patch.hydrated_at, "2026-07-02T00:00:00.000Z");

  const gap = drainHarness({
    rows: pendingRows(1),
    outcome: { status: "no_match", variants: [], note: "vendor gap" },
  });
  const out = await drainHydrationQueue(gap.deps);
  assert.equal(out.noMatch, 1);
  assert.equal(gap.persisted[0].patch.status, "no_match");
  assert.equal(gap.exhausted.length, 0, "a genuine gap is terminal, not an error to escalate");
});

test("worker: transient errors retry via attempts; crossing the cap pings onExhausted", async () => {
  const failing = drainHarness({
    rows: [{ card_slug: "flaky", status: "failed", attempts: HYDRATION_MAX_ATTEMPTS - 1 }],
    outcome: { status: "error", variants: [], note: "PokeTrace 503" },
  });
  const out = await drainHydrationQueue(failing.deps);
  assert.equal(out.failed, 1);
  assert.equal(out.exhausted, 1);
  assert.deepEqual(failing.exhausted, ["flaky"]);
  assert.equal(failing.persisted[0].patch.attempts, HYDRATION_MAX_ATTEMPTS);

  const early = drainHarness({
    rows: [{ card_slug: "flaky", status: "pending", attempts: 0 }],
    outcome: { status: "error", variants: [], note: "PokeTrace 503" },
  });
  const out2 = await drainHydrationQueue(early.deps);
  assert.equal(out2.exhausted, 0, "first failure just increments attempts");
});

test("worker: fetchDue error returns empty stats without throwing", async () => {
  const h = drainHarness({
    fetchDue: async () => ({ rows: [], error: "db down" }),
  });
  const out = await drainHydrationQueue(h.deps);
  assert.equal(out.processed, 0);
  assert.match(out.errors[0], /db down/);
});

// ---------------------------------------------------------------------------
// The ONE resolution path + surface merges (structural)
// ---------------------------------------------------------------------------

test("one ingestion path: bake script + cron worker + seed all import hydrate-core", () => {
  for (const rel of [
    "scripts/bake-poketrace-uuids.ts",
    "app/api/cron/hydrate-cards/route.ts",
    "scripts/seed-hydration.ts",
  ]) {
    assert.match(read(rel), /resolveVariantsForCard/, `${rel} must use the shared resolver`);
  }
  // The bake script's own search/ladder is GONE — hydrate-core owns it.
  assert.doesNotMatch(read("scripts/bake-poketrace-uuids.ts"), /async function searchCards/);
});

test("manual overrides live in the shared core and win unconditionally", () => {
  // cel25-19 is a known override entry (Session 49.1) — sanity check the loader.
  const raw = JSON.parse(read("lib/cards/poketrace-overrides.json")) as Record<string, unknown>;
  const anySlug = Object.keys(raw).find((k) => !k.startsWith("_"));
  if (anySlug) {
    const o = getManualOverride(anySlug);
    assert.ok(o && o.length > 0, "override loader resolves a known slug");
  }
  assert.equal(getManualOverride("no-such-slug"), null);
});

test("card page merges hydrated variants under the baked snapshot (structural)", () => {
  const src = read("app/(site)/cards/[slug]/page.tsx");
  assert.match(src, /getHydratedVariants\(slug\)/);
  assert.match(src, /variants\.length === 0/, "DB fallback only when baked is empty — baked wins");
  assert.match(src, /hydratedSince=\{hydratedSince\}/, "freshness reaches the sold-history panel");
});

test("sold-history panel renders the tracked-since line when hydrated (structural)", () => {
  const src = read("components/cards/sold-history-panel.tsx");
  assert.match(src, /Sold data tracked since/);
  assert.match(src, /hydratedSince \? /, "line renders only for hydrated cards");
});

test("movers cron includes hydrated slugs + merges their variants (the blank-target alert coordination)", () => {
  const src = read("app/api/cron/market-movers/route.ts");
  assert.match(src, /getAllHydratedVariants\(\)/);
  assert.match(src, /hydrated\.has\(e\.slug\)/, "hydrated cards join the momentum universe");
  assert.match(src, /variants: hv/, "hydrated variants fill the baked gap for the walk");
});

test("watch validators accept hydrated variants — the form/validator merge can't drift (security-review fix)", () => {
  // The page offers hydrated variants in the form; both server-side watch
  // validators must derive their whitelist from the SAME merge (baked →
  // hydrated fallback), or a legitimate hydrated-variant watch gets rejected.
  for (const rel of ["app/actions/create-watchlist.ts", "app/api/watchlist/route.ts"]) {
    const src = read(rel);
    assert.match(src, /getHydratedVariants\(/, `${rel} must merge hydrated variants`);
    assert.match(src, /variantsForCard\.length === 0/, `${rel}: baked wins; DB fills the gap`);
  }
});

test("hydration cron is scheduled hourly off the :00 stampede", () => {
  const vercel = JSON.parse(read("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };
  const cron = vercel.crons.find((c) => c.path === "/api/cron/hydrate-cards");
  assert.ok(cron, "hydrate-cards cron must be scheduled");
  assert.equal(cron!.schedule, "10 * * * *");
});
