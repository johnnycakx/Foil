// Structural guards for the ConditionPicker (Session 49b / ADR-043).
//
// The picker is a Client Component (interactive URL-state pills); node:test has
// no React renderer, so — matching the sold-history-panel.test.ts approach — we
// pin its source-level invariants: it's a client component, drives ?c= URL
// state via the router, reads the closed token set from conditions.ts, defaults
// to any-raw, renders a radiogroup, and stays on the cream/navy/gold palette.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

test("ConditionPicker: client component driving ?c= URL state", () => {
  const src = read("components/cards/condition-picker.tsx");
  assert.match(src, /^"use client"/m, "must be a Client Component for interactivity");
  assert.match(src, /useRouter|useSearchParams/, "reads/writes URL state via next/navigation");
  // Selecting a token sets (or clears, for the default) the ?c= param.
  assert.match(src, /\.set\("c"/);
  assert.match(src, /\.delete\("c"\)/);
  assert.match(src, /router\.replace\(/, "soft nav so the typed email survives");
});

test("ConditionPicker: sources the closed token set from conditions.ts", () => {
  const src = read("components/cards/condition-picker.tsx");
  assert.match(src, /RAW_CONDITION_TOKENS/);
  assert.match(src, /GRADED_CONDITION_TOKENS/);
  assert.match(src, /DEFAULT_CONDITION/);
  assert.match(src, /isValidConditionToken/);
});

test("ConditionPicker: radiogroup a11y + default selection", () => {
  const src = read("components/cards/condition-picker.tsx");
  assert.match(src, /role="radiogroup"/);
  assert.match(src, /role="radio"/);
  assert.match(src, /aria-checked=/);
  // Falls back to the default token when ?c is absent/invalid.
  assert.match(src, /isValidConditionToken\(raw\)\s*\?\s*raw\s*:\s*DEFAULT_CONDITION/);
});

test("ConditionPicker: palette discipline — foil tokens, no raw hex", () => {
  const src = read("components/cards/condition-picker.tsx");
  assert.match(src, /text-foil-navy/);
  assert.match(src, /foil-gold/);
  assert.doesNotMatch(src, /#[0-9a-fA-F]{6}/, "no raw hex — DESIGN.md tokens only");
});

test("ConditionPicker: mounted in the sold-history panel + watchlist form reads ?c", () => {
  const panel = read("components/cards/sold-history-panel.tsx");
  assert.match(panel, /<ConditionPicker\b/, "picker mounted in the panel (below the variant selector)");
  const form = read("components/cards/watchlist-form.tsx");
  assert.match(form, /params\.get\("c"\)/, "watchlist form reads the same ?c URL state");
  assert.match(form, /params\.get\("v"\)/, "and the ?v variant state");
  assert.match(form, /createWatchlist/, "submits via the Server Action");
});
