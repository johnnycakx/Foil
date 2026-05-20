// Data-injection tests. We mock the Supabase client so we can exercise the
// happy path and every "no data / error" graceful-skip path without standing
// up a real database.

import test from "node:test";
import assert from "node:assert/strict";
import {
  collectFoilData,
  emptySnapshot,
  renderDataInjectionPrompt,
  type DataClient,
} from "../seo/data-injection.ts";

type Tables = {
  scans?: { count?: number; error?: boolean };
  waitlist?:
    | { data: Array<{ source: string | null }>; error?: false }
    | { error: true }
    | undefined;
  waitlistCount?: { count?: number; error?: boolean };
};

function mockClient(tables: Tables): DataClient {
  return {
    from(table: string) {
      // The builder is intentionally minimal — covers exactly the shape used
      // by the helpers under test (select+head+count for counts, select+gte
      // for waitlist rows).
      const chain = {
        select(_: string, opts?: { count?: string; head?: boolean }) {
          if (table === "scans" && opts?.head) {
            return Object.assign(this, {
              gte: async () => ({
                count: tables.scans?.count ?? null,
                error: tables.scans?.error ? new Error("scans query failed") : null,
              }),
            });
          }
          if (table === "waitlist" && opts?.head) {
            return Object.assign(this, {
              then: undefined,
              gte: undefined,
              // Direct await on .select(...) result for total count
              count: tables.waitlistCount?.count ?? null,
              error: tables.waitlistCount?.error ? new Error("wl count failed") : null,
            });
          }
          if (table === "waitlist") {
            return Object.assign(this, {
              gte: async () => {
                const wl = tables.waitlist;
                if (!wl) return { data: null, error: new Error("no data") };
                if ("error" in wl && wl.error) return { data: null, error: new Error("query failed") };
                return { data: wl.data, error: null };
              },
            });
          }
          return this;
        },
      };
      return chain as unknown as ReturnType<DataClient["from"]>;
    },
  } as DataClient;
}

test("emptySnapshot returns all nulls so the prompt renders the no-data branch", () => {
  const snap = emptySnapshot();
  assert.equal(snap.totalScans, null);
  assert.equal(snap.waitlistBySource, null);
  assert.equal(snap.waitlistTotal, null);
});

test("renderDataInjectionPrompt emits no-data copy when snapshot is empty", () => {
  const out = renderDataInjectionPrompt(emptySnapshot());
  assert.ok(out.includes("No proprietary Foil data"));
  // Still suggests a Foil-citation phrase for gate (d) compliance
  assert.ok(out.toLowerCase().includes("foil"));
});

test("renderDataInjectionPrompt formats totalScans with locale-aware commas", () => {
  const out = renderDataInjectionPrompt({
    totalScans: { count: 12345, days: 30 },
    waitlistBySource: null,
    waitlistTotal: null,
  });
  assert.ok(out.includes("12,345"));
  assert.ok(out.includes("last 30 days"));
  assert.ok(out.includes("Foil's scan data"));
});

test("renderDataInjectionPrompt includes waitlist-source mix when present", () => {
  const out = renderDataInjectionPrompt({
    totalScans: null,
    waitlistBySource: [
      { source: "japanese_guide", count: 50, pct: 50 },
      { source: "homepage_hero", count: 30, pct: 30 },
      { source: "value_calculator_guide", count: 20, pct: 20 },
    ],
    waitlistTotal: 100,
  });
  assert.ok(out.includes("japanese_guide 50%"));
  assert.ok(out.includes("100 collectors"));
});

test("collectFoilData returns a snapshot when the scans table has data", async () => {
  const client = mockClient({
    scans: { count: 250 },
    waitlist: { data: [{ source: "homepage" }, { source: "homepage" }, { source: "blog" }] },
    waitlistCount: { count: 3 },
  });
  const snap = await collectFoilData(client);
  assert.equal(snap.totalScans?.count, 250);
  assert.equal(snap.totalScans?.days, 30);
  assert.equal(snap.waitlistTotal, 3);
  assert.equal(snap.waitlistBySource?.[0].source, "homepage");
  assert.equal(snap.waitlistBySource?.[0].pct, 67);
});

test("collectFoilData silently nulls fields when individual queries fail", async () => {
  const client = mockClient({
    scans: { error: true },
    waitlist: { error: true },
    waitlistCount: { error: true },
  });
  const snap = await collectFoilData(client);
  assert.equal(snap.totalScans, null);
  assert.equal(snap.waitlistBySource, null);
  assert.equal(snap.waitlistTotal, null);
});

test("collectFoilData returns null waitlistBySource when zero rows in window", async () => {
  const client = mockClient({
    scans: { count: 100 },
    waitlist: { data: [] },
    waitlistCount: { count: 0 },
  });
  const snap = await collectFoilData(client);
  assert.equal(snap.totalScans?.count, 100);
  assert.equal(snap.waitlistBySource, null);
});
