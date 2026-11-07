// The comp-staleness alarm (audit 2026-07-14). board-freshness watches OUR cache
// time (computed_at); this watches the MARKET's pulse (sold_as_of). These tests
// pin that an undated comp counts as stale, that the alarm needs a systemic
// shift on a real sample (not a couple of sleepy long-tail cards), and that the
// distribution stats are honest.

import test from "node:test";
import assert from "node:assert/strict";
import {
  assessCompStaleness,
  compStalenessAlarmMessage,
  COMP_STALE_DAYS,
  COMP_STALE_ALARM_FRACTION,
} from "../deals/comp-staleness.ts";

const NOW = Date.parse("2026-07-14T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

test("undated comps count as stale, never as fresh", () => {
  const v = assessCompStaleness({ soldAsOfIsos: [null, null, "garbage"], nowMs: NOW });
  assert.equal(v.measured, 3);
  assert.equal(v.undated, 3);
  assert.equal(v.stale, 3);
  assert.equal(v.medianAgeDays, null, "no dated comps → no median");
});

test("median + p90 describe only the DATED comps", () => {
  const isos = [daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(10), daysAgo(40)];
  const v = assessCompStaleness({ soldAsOfIsos: isos, nowMs: NOW });
  assert.equal(v.measured, 5);
  assert.equal(v.medianAgeDays, 3);
  // Nearest-rank p90 on 5 sorted ages [1,2,3,10,40] → index floor(4*0.9)=3 → 10.
  assert.equal(v.p90AgeDays, 10);
  assert.equal(v.stale, 1, "only the 40-day comp is past 35d");
});

test("alarm needs BOTH a real sample and a majority-stale spine", () => {
  // A fresh catalog never alarms.
  const fresh = assessCompStaleness({ soldAsOfIsos: Array.from({ length: 40 }, () => daysAgo(3)), nowMs: NOW });
  assert.equal(fresh.alarm, false);

  // A mostly-stale catalog alarms.
  const stale = assessCompStaleness({
    soldAsOfIsos: Array.from({ length: 40 }, (_, i) => (i < 30 ? daysAgo(60) : daysAgo(2))),
    nowMs: NOW,
  });
  assert.ok(stale.staleFraction > COMP_STALE_ALARM_FRACTION);
  assert.equal(stale.alarm, true);

  // The SAME stale fraction on a tiny sample does NOT alarm (guard against a
  // near-empty cache from an unrelated outage tripping a false market signal).
  const tiny = assessCompStaleness({ soldAsOfIsos: [daysAgo(60), daysAgo(60), daysAgo(2)], nowMs: NOW });
  assert.ok(tiny.staleFraction > COMP_STALE_ALARM_FRACTION);
  assert.equal(tiny.alarm, false, "sample under 20 never alarms");
});

test("empty input is inert, not a divide-by-zero alarm", () => {
  const v = assessCompStaleness({ soldAsOfIsos: [], nowMs: NOW });
  assert.equal(v.measured, 0);
  assert.equal(v.staleFraction, 0);
  assert.equal(v.alarm, false);
});

test("the alarm message states the real numbers", () => {
  const v = assessCompStaleness({
    soldAsOfIsos: Array.from({ length: 40 }, (_, i) => (i < 30 ? daysAgo(60) : daysAgo(2))),
    nowMs: NOW,
  });
  const msg = compStalenessAlarmMessage(v);
  assert.match(msg, /30\/40/);
  assert.match(msg, new RegExp(`older than ${COMP_STALE_DAYS} days`));
  assert.match(msg, /PokeTrace/);
});
