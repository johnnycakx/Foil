// Tests for the "good buys this week" newsletter digest serializer (ADR-069).
//
// The honesty discipline is enforced HERE: this is a deterministic, no-LLM path,
// so the test pins that EVERY dollar figure in the body traces back to a real
// input aggregate (avg7d/avg30d) — fabrication is structurally impossible — plus
// brand-voice (no em dashes, Pokémon with é), the candidate framing, the
// card-level browse links, the lead-magnet CTA, and an honest empty state.

import test from "node:test";
import assert from "node:assert/strict";
import { serializeMoversDigest, formatUsd, MOVERS_DIGEST_SEPARATOR } from "../newsletter/movers-digest.ts";
import type { MarketMovers, MoverRow } from "../deals/market-movers-read.ts";

function mover(over: Partial<MoverRow>): MoverRow {
  return {
    cardSlug: "es-215-umbreon-vmax",
    cardName: "Umbreon VMAX",
    setName: "Evolving Skies",
    imageUrl: "",
    direction: "down",
    momentumPct: -12,
    avg7d: 880,
    avg30d: 1000,
    saleCount: 40,
    matchedTier: "NEAR_MINT",
    computedAt: "2026-06-25T09:00:00Z",
    ...over,
  };
}

const MOVERS: MarketMovers = {
  down: [
    mover({}),
    mover({ cardSlug: "base1-4-charizard", cardName: "Charizard", setName: "Base", avg7d: 305, avg30d: 360, momentumPct: -15.3, saleCount: 22 }),
  ],
  up: [
    mover({ cardSlug: "sv3pt5-199-charizard-ex", cardName: "Charizard ex", setName: "151", direction: "up", avg7d: 95.5, avg30d: 80, momentumPct: 19.4, saleCount: 31 }),
  ],
};

function dollarFigures(text: string): string[] {
  return text.match(/\$\d[\d,]*(?:\.\d+)?/g) ?? [];
}

test("serializeMoversDigest: every dollar figure traces to a real input aggregate", () => {
  const md = serializeMoversDigest({ movers: MOVERS, generatedAt: "2026-06-25T09:00:00Z" });
  const allowed = new Set<string>();
  for (const m of [...MOVERS.down, ...MOVERS.up]) {
    if (m.avg7d != null) allowed.add(formatUsd(m.avg7d));
    if (m.avg30d != null) allowed.add(formatUsd(m.avg30d));
  }
  const figs = dollarFigures(md);
  assert.ok(figs.length > 0, "digest should cite figures");
  for (const f of figs) {
    assert.ok(allowed.has(f), `fabricated dollar figure not from any input aggregate: ${f}`);
  }
});

test("serializeMoversDigest: no em dashes (BRAND-VOICE Gate 12)", () => {
  const md = serializeMoversDigest({ movers: MOVERS, generatedAt: "2026-06-25T09:00:00Z" });
  assert.equal((md.match(/—/g) || []).length, 0);
});

test("serializeMoversDigest: Pokémon keeps the é", () => {
  const md = serializeMoversDigest({ movers: MOVERS, generatedAt: "2026-06-25T09:00:00Z" });
  assert.ok(md.includes("Pokémon"));
  assert.ok(!/Pokemon\b/.test(md.replace(/Pokémon/g, "")));
});

test("serializeMoversDigest: candidate framing, not a guarantee", () => {
  const md = serializeMoversDigest({ movers: MOVERS, generatedAt: "2026-06-25T09:00:00Z" }).toLowerCase();
  assert.ok(md.includes("candidate"));
  assert.ok(md.includes("not a guarantee"));
});

test("serializeMoversDigest: card-level eBay browse links + lead-magnet CTA", () => {
  const md = serializeMoversDigest({ movers: MOVERS, generatedAt: "2026-06-25T09:00:00Z", siteUrl: "https://foiltcg.com" });
  assert.match(md, /ebay\.com\/sch/); // affiliate SEARCH (browse), not a single /itm/ listing
  assert.ok(!md.includes("ebay.com/itm/"), "must not link a single listing");
  assert.ok(md.includes("foiltcg.com/free/pokemon-card-pricing-cheat-sheet"), "lead-magnet CTA");
  assert.ok(md.includes(MOVERS_DIGEST_SEPARATOR.trim()));
  // Frontmatter counts reflect the full input, not the truncated body.
  assert.match(md, /downCount: 2/);
  assert.match(md, /upCount: 1/);
});

test("serializeMoversDigest: empty movers → honest no-deal body, zero fabricated figures", () => {
  const md = serializeMoversDigest({ movers: { down: [], up: [] }, generatedAt: "2026-06-25T09:00:00Z" });
  assert.equal(dollarFigures(md).length, 0);
  assert.match(md, /No cards cleared the good-buy bar/i);
  assert.match(md, /downCount: 0/);
});

test("formatUsd: exact, thousands-separated, trailing .00 dropped", () => {
  assert.equal(formatUsd(1000), "$1,000");
  assert.equal(formatUsd(880.5), "$880.50");
  assert.equal(formatUsd(95.5), "$95.50");
  assert.equal(formatUsd(2161.43), "$2,161.43");
});
