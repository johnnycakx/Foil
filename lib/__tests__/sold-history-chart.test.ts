// Structural guards for the SoldHistoryChart (Session 49c / ADR-044).
//
// Client Component (interactive range pills + hover); node:test has no React
// renderer, so — matching sold-history-panel.test.ts — we pin source-level
// invariants: it's a client component, renders an inline SVG line + area over
// REAL daily PokeTrace history (median7d line), drives ?r= URL state with the
// 5-range selector, labels the x-axis by date, and stays on the palette.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

test("SoldHistoryChart: client component, inline SVG line + area, no chart library", () => {
  const src = read("components/cards/sold-history-chart.tsx");
  assert.match(src, /^"use client"/m);
  assert.match(src, /<svg\b/);
  assert.match(src, /<path\b/);
  assert.match(src, /strokeWidth=\{2\}/);
  assert.match(src, /foil-chart-fill|linearGradient/);
  assert.doesNotMatch(src, /from\s+["'](recharts|visx|chart\.js|d3)/);
});

test("SoldHistoryChart: plots median7d (fallback avg) over real PokeTrace daily history", () => {
  const src = read("components/cards/sold-history-chart.tsx");
  assert.match(src, /PriceHistoryRow/, "consumes the real daily-history row type");
  assert.match(src, /median7d\s*\?\?\s*r\.avg|r\.median7d\s*\?\?/, "line uses median7d with avg fallback");
  // x-axis is real dates, not window labels.
  assert.match(src, /shortDate/);
  assert.match(src, /toLocaleDateString/);
});

test("SoldHistoryChart: trend-coloured endpoint dot (accent up / coral down) + current dot", () => {
  const src = read("components/cards/sold-history-chart.tsx");
  assert.match(src, /color-foil-accent/); // design-loop-round2 §3 (night register)
  assert.match(src, /color-foil-coral/);
  assert.match(src, /<circle\b/);
  assert.match(src, /up\s*=|last\s*>=\s*first/);
});

test("SoldHistoryChart: 5-range selector 7D/1M/3M/1Y/MAX, default 1M, ?r= URL state", () => {
  const src = read("components/cards/sold-history-chart.tsx");
  for (const k of ['"7D"', '"1M"', '"3M"', '"1Y"', '"MAX"']) assert.match(src, new RegExp(k));
  assert.match(src, /DEFAULT_RANGE[^\n]*=[^\n]*"1M"/);
  assert.match(src, /\.set\("r"|\.delete\("r"\)/);
  assert.match(src, /router\.replace\(/);
  // Ranges without enough depth are disabled ("Limited history").
  assert.match(src, /Limited history/);
  assert.match(src, /disabled=\{!/);
});

test("SoldHistoryChart: hover tooltip with date + price + sale count", () => {
  const src = read("components/cards/sold-history-chart.tsx");
  assert.match(src, /onMouseMove|onTouchMove/);
  assert.match(src, /sale|saleCount/);
  // Empty/absent series → accumulating placeholder.
  assert.match(src, /Price history accumulating/);
});

test("SoldHistoryChart: palette discipline — no raw hex", () => {
  const src = read("components/cards/sold-history-chart.tsx");
  assert.doesNotMatch(src, /#[0-9a-fA-F]{6}/);
});
