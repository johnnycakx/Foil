// The ONE PokeTrace card-resolution path (demand-driven-data, ADR-092).
//
// Given a catalog card's identity (name / set / number / set total), search
// PokeTrace, walk the market fallback ladder, and match candidates to derive
// the card's `PoketraceVariant[]`. Extracted from scripts/bake-poketrace-uuids.ts
// (Session 49.2's ladder) so the BAKE script and the runtime hydration worker
// share one ingestion path — the goal's hard boundary: never build a second
// one. Matching itself stays in lib/poketrace/variant.ts (pure + unit-tested).
//
// Market fallback ladder (Session 49.2): PokeTrace's catalog is market-
// partitioned — some cards (vintage holos, Classic Collection) are
// systematically EU-only and never surface under `market=US`:
//   1. name-only, market=US       (the bulk of the catalog)
//   2. set-scoped, market=US
//   3. set-scoped, market=EU
//   4. name-only,  market=EU
//   5. name-only,  no market      (broadest)
//
// Manual UUID overrides (lib/cards/poketrace-overrides.json, Session 49.1)
// win unconditionally — for cards whose SDK collector number doesn't line up
// with PokeTrace's numbering.
//
// IO is injectable (fetch, key, sleep) so the ladder is unit-testable and the
// worker can pace calls under the 30 req/10s burst ceiling.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  matchCatalogCard,
  slugifyName,
  type PtCardLite,
  type PoketraceVariant,
} from "./variant.ts";

const BASE_URL = "https://api.poketrace.com/v1";

/** Pace between PokeTrace calls: ~50 req/10s, under the 60/10s Scale burst
 *  (and far under the 30/10s Pro figure the crons budget for). */
export const HYDRATE_REQ_INTERVAL_MS = 200;

export type HydrateCardInput = {
  /** Catalog slug — used for the manual-override lookup. */
  slug: string;
  name: string;
  setName: string;
  /** Collector number as printed (e.g. "103"). */
  number: string;
  /** The set's printed total (0 when unknown). */
  setTotal: number;
};

export type HydrateDeps = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  /** Await between ladder rungs — the worker's pacing hook. */
  sleep?: (ms: number) => Promise<void>;
};

export type HydrateOutcome =
  | { status: "matched" | "ambiguous"; variants: PoketraceVariant[]; note: string }
  | { status: "no_match"; variants: []; note: string }
  | { status: "error"; variants: []; note: string };

// Loaded via readFileSync + JSON.parse rather than an ESM JSON import so the
// loader path works under `node --experimental-strip-types` (the test runner
// + scripts) without import attributes — the same pattern lib/cards/sdk.ts
// uses for the baked snapshot. Soft-fail to no overrides.
function loadOverrides(): Record<string, PoketraceVariant[]> {
  const out: Record<string, PoketraceVariant[]> = {};
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = JSON.parse(
      readFileSync(join(here, "..", "cards", "poketrace-overrides.json"), "utf8"),
    ) as Record<string, unknown>;
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith("_")) continue; // skip _comment
      if (Array.isArray(v)) out[k] = v as PoketraceVariant[];
    }
  } catch {
    /* missing/unparseable overrides file is non-fatal — no overrides */
  }
  return out;
}
const OVERRIDES = loadOverrides();

/** The manual override for a slug, or null. Exposed so the bake script can
 *  re-apply overrides over already-baked values (they win unconditionally,
 *  Session 49.1) without a second overrides loader. */
export function getManualOverride(slug: string): PoketraceVariant[] | null {
  const o = OVERRIDES[slug];
  return o && o.length > 0 ? o : null;
}

async function searchCards(
  deps: Required<Pick<HydrateDeps, "apiKey">> & HydrateDeps,
  name: string,
  setSlug?: string,
  market: string | null = "US",
): Promise<PtCardLite[]> {
  let url = `${BASE_URL}/cards?search=${encodeURIComponent(name)}&limit=50`;
  if (market) url += `&market=${encodeURIComponent(market)}`;
  if (setSlug) url += `&set=${encodeURIComponent(setSlug)}`;
  const fetchFn = deps.fetchImpl ?? fetch;
  const res = await fetchFn(url, {
    headers: { "X-API-Key": deps.apiKey, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PokeTrace ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  }
  const json = (await res.json()) as { data?: PtCardLite[] };
  return Array.isArray(json.data) ? json.data : [];
}

function mergeCandidates(a: PtCardLite[], b: PtCardLite[]): PtCardLite[] {
  const seen = new Set(a.map((c) => c.id));
  return [...a, ...b.filter((c) => !seen.has(c.id))];
}

/**
 * Resolve one catalog card's PokeTrace variants. Never throws — a search
 * failure returns `{ status: "error" }` so callers can count attempts and
 * retry later; a genuine catalog gap returns `no_match` (terminal).
 */
export async function resolveVariantsForCard(
  input: HydrateCardInput,
  deps: HydrateDeps,
): Promise<HydrateOutcome> {
  // Manual override wins unconditionally (Session 49.1).
  const override = OVERRIDES[input.slug];
  if (override && override.length > 0) {
    return { status: "matched", variants: override, note: "manual override" };
  }
  if (!deps.apiKey) return { status: "error", variants: [], note: "missing POKETRACE_API_KEY" };

  const pause = deps.sleep ?? (async (ms: number) => new Promise((r) => setTimeout(r, ms)));
  const identity = { name: input.name, setName: input.setName, setTotal: input.setTotal, number: input.number };

  let candidates: PtCardLite[] = [];
  try {
    candidates = await searchCards(deps, input.name);
  } catch (err) {
    return { status: "error", variants: [], note: `search error: ${(err as Error).message}` };
  }
  let result = matchCatalogCard(identity, candidates);

  // The fallback ladder — only walked on a miss.
  if (result.status === "miss" || result.variants.length === 0) {
    const setSlug = slugifyName(input.setName) || undefined;
    const rungs: Array<[setSlug: string | undefined, market: string | null]> = [
      [setSlug, "US"],
      [setSlug, "EU"],
      [undefined, "EU"],
      [undefined, null],
    ];
    for (const [rungSet, rungMarket] of rungs) {
      if (result.status !== "miss" && result.variants.length > 0) break;
      try {
        await pause(HYDRATE_REQ_INTERVAL_MS);
        const more = await searchCards(deps, input.name, rungSet, rungMarket);
        candidates = mergeCandidates(candidates, more);
        result = matchCatalogCard(identity, candidates);
      } catch {
        /* keep the prior miss; try the next rung */
      }
    }
  }

  if (result.status === "miss" || result.variants.length === 0) {
    return { status: "no_match", variants: [], note: result.note };
  }
  return {
    status: result.status === "ambiguous" ? "ambiguous" : "matched",
    variants: result.variants,
    note: result.note,
  };
}
