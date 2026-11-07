// Catalog staleness scan — the measurement nobody had (audit 2026-07-14).
//
// The 2026-07-14 audit found ~6 of 10 card pages rendering a possibly-weeks-old
// "30-day sold avg" as if current, because the freshness gate discarded the
// date the moment it decided "fresh." Nothing measured the AGE DISTRIBUTION of
// what we actually display — so nothing flagged the drift. This is that gauge.
//
// For a catalog sample it resolves the EXACT headline the card page renders
// (pickSelectedVariant → resolveSoldPanel → the NM/default tier's fresh windowed
// figure) and records the age of that figure's `asOfIso`. It reports the
// distribution, names the worst offenders, and — via lib/deals/comp-staleness.ts
// — pings #errors when the sold spine has systemically cooled. The verdict
// primitive is shared with any future cron; the freshness gate stays the render
// rule, this measures how close to that edge the live catalog is sitting.
//
// Run: node --env-file=.env.local --experimental-strip-types scripts/staleness-scan.ts \
//        [--from-cache] [--cache <dir>] [--limit N] [--alarm]
//   --alarm : also ping #errors (DISCORD_WEBHOOK_ERRORS) when the verdict alarms.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSoldHistory, type SoldHistory } from "../lib/poketrace/by-uuid.ts";
import { CARD_CATALOG, cardTier } from "../lib/cards/catalog.ts";
import { resolveSoldPanel, SOLD_SOURCES, windowedValue } from "../lib/cards/sold-coherence.ts";
import { conditionToTier, DEFAULT_CONDITION } from "../lib/cards/conditions.ts";
import type { PoketraceVariant } from "../lib/poketrace/variant.ts";

// pickSelectedVariant/tradedScore live in lib/cards/sold-headline.ts, but that
// module pulls the `@/`-aliased getSoldHistory chain node can't resolve in a raw
// script. They're pure and tiny, so mirror them here (kept in lockstep with the
// render path — same traded-score ranking the card page uses).
function tradedScore(history: SoldHistory | null): number {
  if (!history) return 0;
  let score = 0;
  for (const src of SOLD_SOURCES) {
    const tiers = history.bySource[src];
    if (!tiers) continue;
    for (const s of Object.values(tiers)) score += (s.saleCount ?? 0) * (windowedValue(s) ?? s.avg ?? 0);
  }
  return score;
}
function pickSelectedVariant<T extends { history: SoldHistory | null }>(pairs: readonly T[]): T {
  return [...pairs].sort((a, b) => tradedScore(b.history) - tradedScore(a.history))[0];
}
import {
  assessCompStaleness,
  compStalenessAlarmMessage,
  COMP_STALE_DAYS,
} from "../lib/deals/comp-staleness.ts";
import { compAgeDays } from "../lib/cards/comp-age.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = "https://api.poketrace.com/v1";
const DAY = 86_400_000;

type BakedVariant = { variantKey: string; poketraceId: string; variantLabel?: string };
type BakedCard = { id: string; name: string; variants?: BakedVariant[] };

function loadUniverse(): Array<{ slug: string; name: string; variants: PoketraceVariant[] }> {
  const baked = JSON.parse(readFileSync(join(ROOT, "lib/cards/baked-metadata.json"), "utf8")) as {
    cards: Record<string, BakedCard>;
  };
  const catalogBySlug = new Map(CARD_CATALOG.map((e) => [e.slug, e.pokemonTcgId]));
  const out: Array<{ slug: string; name: string; variants: PoketraceVariant[] }> = [];
  for (const e of CARD_CATALOG) {
    if (cardTier(e.slug) !== "curated") continue;
    const card = baked.cards[catalogBySlug.get(e.slug) ?? ""];
    if (!card?.variants?.length) continue;
    out.push({
      slug: e.slug,
      name: card.name,
      variants: card.variants.map((v) => ({
        variantKey: v.variantKey,
        poketraceId: v.poketraceId,
        variantLabel: v.variantLabel ?? v.variantKey,
      })) as PoketraceVariant[],
    });
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHistory(uuid: string, cacheDir: string, fromCache: boolean, apiKey: string): Promise<SoldHistory | null> {
  const cachePath = join(cacheDir, `${uuid}.json`);
  if (existsSync(cachePath)) return parseSoldHistory(uuid, JSON.parse(readFileSync(cachePath, "utf8")));
  if (fromCache) return null;
  const res = await fetch(`${BASE_URL}/cards/${encodeURIComponent(uuid)}?market=US`, {
    headers: { "X-API-Key": apiKey, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: unknown };
  writeFileSync(cachePath, JSON.stringify(json?.data ?? null));
  return parseSoldHistory(uuid, json?.data ?? null);
}

async function main() {
  const args = process.argv.slice(2);
  const fromCache = args.includes("--from-cache");
  const doAlarm = args.includes("--alarm");
  const limitArg = args.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;
  const cacheArg = args.indexOf("--cache");
  const cacheDir = cacheArg >= 0 ? args[cacheArg + 1] : join(ROOT, ".staleness-cache");
  mkdirSync(cacheDir, { recursive: true });
  const apiKey = process.env.POKETRACE_API_KEY ?? "";
  if (!apiKey && !fromCache) throw new Error("POKETRACE_API_KEY required (or pass --from-cache)");

  const universe = loadUniverse().slice(0, Number.isFinite(limit) ? limit : undefined);
  console.log(`sampling ${universe.length} curated cards${fromCache ? " (from cache)" : ""}…`);

  const now = Date.now();
  const target = conditionToTier(DEFAULT_CONDITION);
  type Row = { slug: string; name: string; renders: "dated" | "degraded" | "none"; ageDays: number | null; value: number | null };
  const rows: Row[] = [];
  const soldAsOfIsos: Array<string | null> = [];
  let fetched = 0;

  for (const card of universe) {
    const pairs: Array<{ variant: PoketraceVariant; history: SoldHistory | null }> = [];
    for (const v of card.variants) {
      const h = await fetchHistory(v.poketraceId, cacheDir, fromCache, apiKey);
      if (h && !fromCache) {
        if (++fetched % 25 === 0) console.log(`  fetched ${fetched}…`);
        await sleep(400); // 30 req / 10s burst ceiling
      }
      pairs.push({ variant: v, history: h });
    }
    const selected = pickSelectedVariant(pairs);
    const model = resolveSoldPanel(selected.history, target, now);
    if (model.headline) {
      const ageDays = compAgeDays(model.headline.asOfIso, now);
      rows.push({ slug: card.slug, name: card.name, renders: "dated", ageDays, value: model.headline.value });
      soldAsOfIsos.push(model.headline.asOfIso);
    } else {
      // Degraded (dated last-sale) or nothing — either way the page is NOT
      // claiming a current 30-day figure, so it does not enter the alarm's
      // "rendered as fresh" population, but we still count it for context.
      rows.push({ slug: card.slug, name: card.name, renders: model.lastSale ? "degraded" : "none", ageDays: null, value: null });
    }
  }

  const verdict = assessCompStaleness({ soldAsOfIsos, nowMs: now });
  const dated = rows.filter((r) => r.renders === "dated");
  const buckets: Array<[string, (a: number) => boolean]> = [
    ["0-2d   genuinely current", (a) => a <= 2],
    ["3-7d   defensible", (a) => a > 2 && a <= 7],
    ["8-14d  drifting", (a) => a > 7 && a <= 14],
    ["15-35d weak (still a headline)", (a) => a > 14 && a <= COMP_STALE_DAYS],
    [`>${COMP_STALE_DAYS}d  should not headline`, (a) => a > COMP_STALE_DAYS],
  ];

  const lines: string[] = [];
  lines.push(`# Catalog staleness scan — ${new Date(now).toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(`Sampled ${rows.length} curated cards. Headline resolution mirrors the card page exactly.`);
  lines.push("");
  lines.push("## What the page renders");
  lines.push(`- dated 30-day headline:  ${dated.length}`);
  lines.push(`- degraded (dated last-sale): ${rows.filter((r) => r.renders === "degraded").length}`);
  lines.push(`- honest pending (no figure): ${rows.filter((r) => r.renders === "none").length}`);
  lines.push("");
  lines.push("## Age of the DATED headline figures");
  lines.push(`median ${verdict.medianAgeDays ?? "?"}d · p90 ${verdict.p90AgeDays ?? "?"}d · stale(>${COMP_STALE_DAYS}d incl. undated) ${verdict.stale}/${verdict.measured} (${Math.round(verdict.staleFraction * 100)}%)`);
  lines.push("");
  for (const [label, pred] of buckets) {
    const n = dated.filter((r) => r.ageDays != null && pred(r.ageDays)).length;
    const bar = "#".repeat(Math.round((n / Math.max(1, dated.length)) * 40));
    lines.push(`${label.padEnd(32)} ${String(n).padStart(4)}  ${bar}`);
  }
  lines.push("");
  lines.push("## Oldest headlines still rendering");
  for (const r of dated.filter((r) => r.ageDays != null).sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0)).slice(0, 15)) {
    lines.push(`  ${String(r.ageDays).padStart(3)}d  $${String(Math.round(r.value ?? 0)).padStart(6)}  ${r.name} (${r.slug})`);
  }
  lines.push("");
  lines.push(`ALARM: ${verdict.alarm ? "YES — sold spine has systemically cooled" : "no"}`);

  const report = lines.join("\n");
  console.log("\n" + report);
  const outDir = join(ROOT, "docs/goals/_results");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "staleness-scan.md"), report);
  writeFileSync(join(outDir, "staleness-scan.json"), JSON.stringify({ now, verdict, rows }, null, 2));
  console.log(`\nwrote docs/goals/_results/staleness-scan.{md,json}`);

  if (doAlarm && verdict.alarm) {
    const webhook = process.env.DISCORD_WEBHOOK_ERRORS;
    if (webhook) {
      const { notifyChannel } = await import("../lib/notifications/discord.ts");
      await notifyChannel(webhook, `⚠️ ${compStalenessAlarmMessage(verdict)}`);
      console.log("pinged #errors");
    } else {
      console.log("--alarm set but DISCORD_WEBHOOK_ERRORS missing — skipped");
    }
  }
}

main().catch((e) => {
  console.error("FAILED:", e?.message ?? e);
  process.exit(1);
});
