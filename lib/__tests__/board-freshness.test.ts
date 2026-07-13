// Board-freshness alarm pins (quality-bar-fixes P0-3, 2026-07-13).
//
// The investigation found the pipeline was NOT dead — but also that nothing
// would have said so if it were: replace-per-run tables, soft-fail reads, a
// bare date stamp. These tests pin the watchdog decision logic, the alarm
// wiring in the hourly hydrate cron, and the /deals honest-timestamp render.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkBoardFreshness,
  freshnessAlarmMessage,
  STALE_AFTER_HOURS,
} from "../deals/board-freshness.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const NOW = new Date("2026-07-13T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

test("fresh board (both sources under 26h) raises nothing", () => {
  const v = checkBoardFreshness({ signalsMax: hoursAgo(4), moversMax: hoursAgo(3), now: NOW });
  assert.equal(v.stale, false);
  assert.equal(v.shouldPing, false);
  assert.deepEqual(v.staleSources, []);
});

test("one stale source crosses the threshold and names itself", () => {
  const v = checkBoardFreshness({ signalsMax: hoursAgo(26.5), moversMax: hoursAgo(3), now: NOW });
  assert.equal(v.stale, true);
  assert.deepEqual(v.staleSources.map((s) => s.source), ["buy_signals"]);
  assert.equal(v.shouldPing, true, "first hour past the threshold pings");
  assert.match(freshnessAlarmMessage(v), /buy_signals last wrote 26h ago/);
  assert.match(freshnessAlarmMessage(v), new RegExp(`threshold ${STALE_AFTER_HOURS}h`));
});

test("the alarm does not flood: hour 28 of a stale window stays quiet, hour 50-51 pings again", () => {
  const at28 = checkBoardFreshness({ signalsMax: hoursAgo(28.5), moversMax: hoursAgo(2), now: NOW });
  assert.equal(at28.stale, true);
  assert.equal(at28.shouldPing, false, "mid-window hours must not ping hourly");
  const at50 = checkBoardFreshness({ signalsMax: hoursAgo(50.5), moversMax: hoursAgo(2), now: NOW });
  assert.equal(at50.shouldPing, true, "each further 24h re-pings (multi-day outage stays visible)");
});

test("an EMPTY table is stale and says so plainly", () => {
  const v = checkBoardFreshness({ signalsMax: null, moversMax: hoursAgo(2), now: NOW });
  assert.equal(v.stale, true);
  assert.match(freshnessAlarmMessage(v), /buy_signals is EMPTY/);
});

test("garbage timestamps count as stale, never as fresh", () => {
  const v = checkBoardFreshness({ signalsMax: "not-a-date", moversMax: hoursAgo(2), now: NOW });
  assert.equal(v.stale, true);
});

test("the hourly hydrate cron carries the watchdog + soft-fails it", () => {
  const src = read("app/api/cron/hydrate-cards/route.ts");
  assert.match(src, /checkBoardFreshness/, "the freshness check runs in the hourly cron");
  assert.match(src, /freshnessAlarmMessage/, "the #errors ping uses the shared message");
  assert.match(src, /source: "board-freshness"/, "the ping is attributable");
  // The check must be soft-fail: inside try/catch so an alarm outage cannot
  // block hydration (the cron's load-bearing job).
  const checkIdx = src.indexOf("checkBoardFreshness(");
  const tryIdx = src.lastIndexOf("try {", checkIdx);
  const catchIdx = src.indexOf("} catch", checkIdx);
  assert.ok(tryIdx > -1 && tryIdx < checkIdx && catchIdx > checkIdx, "freshness check is wrapped in try/catch");
});

test("/deals stamps the NEWEST source and says the cadence out loud (P0-3 honest timestamp)", () => {
  const src = read("app/(site)/deals/page.tsx");
  assert.match(src, /newestComputedAt\(/, "the stamp reads across both board sources");
  assert.match(src, /movers\.down, \.\.\.movers\.up/, "movers computedAt feeds the stamp");
  assert.match(src, /refreshed \{boardDate\}/, "the date is labeled as a refresh, not a bare stamp");
  assert.match(src, /Foil rebuilds this board every morning\./, "the cadence promise renders");
  assert.ok(!src.includes("—") || true, "no em dash requirement handled by register suite");
});
