// Structural guards for the SoldHistoryChart (Session 49c / ADR-044).
//
// Client Component (interactive range pills + hover); node:test has no React
// renderer, so — matching sold-history-panel.test.ts — we pin source-level
// invariants: it's a client component, renders an inline SVG line + area + a
// trend-coloured endpoint, drives ?r= URL state, disables ranges past the real
// 30-day data window, and stays on the cream/navy/gold palette.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

test("SoldHistoryChart: client component, inline SVG line + area fill, no chart library", () => {
  const src = read("components/cards/sold-history-chart.tsx");
  assert.match(src, /^"use client"/m);
  assert.match(src, /<svg\b/, "inline SVG (no JS charting dependency)");
  assert.match(src, /<path\b/, "line + area paths");
  // 2px navy line + a navy area fill gradient.
  assert.match(src, /strokeWidth=\{2\}/);
  assert.match(src, /foil-chart-fill|linearGradient/);
  // No external charting import (recharts/visx/chart.js/d3).
  assert.doesNotMatch(src, /from\s+["'](recharts|visx|chart\.js|d3)/);
});

test("SoldHistoryChart: trend-coloured endpoint dot (gold up / coral down)", () => {
  const src = read("components/cards/sold-history-chart.tsx");
  assert.match(src, /color-foil-gold/);
  assert.match(src, /color-foil-coral/);
  assert.match(src, /<circle\b/, "endpoint dot at the current price");
  assert.match(src, /last\s*>=\s*first|up\s*=/, "endpoint colour keyed to range direction");
});

test("SoldHistoryChart: range selector drives ?r= URL state; 90D/ALL disabled (no data)", () => {
  const src = read("components/cards/sold-history-chart.tsx");
  assert.match(src, /"7D"/);
  assert.match(src, /"30D"/);
  assert.match(src, /"90D"/);
  assert.match(src, /"ALL"/);
  // Default 30D; ?r param plumbing.
  assert.match(src, /DEFAULT_RANGE[^\n]*=[^\n]*"30D"/);
  assert.match(src, /\.set\("r"|\.delete\("r"\)/);
  assert.match(src, /router\.replace\(/);
  // 90D + ALL are present but disabled — PokeTrace has no data past 30 days.
  assert.match(src, /enabled:\s*false/);
  assert.match(src, /disabled=\{!r\.enabled\}|disabled=\{!/);
});

test("SoldHistoryChart: honest labelling — window labels, not fabricated dates", () => {
  const src = read("components/cards/sold-history-chart.tsx");
  assert.match(src, /30d avg|7d avg|24h avg/, "x-axis labelled by averaging window");
  assert.match(src, /trailing averages|Recent trend/i);
  // Graceful degradation when <2 points.
  assert.match(src, /Not enough recent sales/);
});

test("SoldHistoryChart: palette discipline — no raw hex", () => {
  const src = read("components/cards/sold-history-chart.tsx");
  assert.doesNotMatch(src, /#[0-9a-fA-F]{6}/, "tokens/CSS vars only, no raw hex");
});
