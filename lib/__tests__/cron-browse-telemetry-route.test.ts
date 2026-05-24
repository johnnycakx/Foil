// Contract tests for the daily Browse-telemetry cron's auth gate + the
// shape of the Discord embed it posts.
//
// Mirror of the bearer predicate from app/api/cron/browse-telemetry/route.ts
// — the route file imports next/server + path-aliased modules and can't be
// loaded under node --experimental-strip-types directly. Keep this byte-
// identical with the route's check; the embed-shape tests below exercise
// lib/notifications/discord.ts::postBrowseTelemetry which IS loadable.

import test from "node:test";
import assert from "node:assert/strict";
import { postBrowseTelemetry } from "../notifications/discord.ts";

function isAuthorized(headerValue: string | null, expected: string | undefined): boolean {
  if (!expected) return false;
  return headerValue === `Bearer ${expected}`;
}

const SECRET = "test-telemetry-secret";

test("cron auth: rejects missing header", () => {
  assert.equal(isAuthorized(null, SECRET), false);
});

test("cron auth: rejects wrong bearer", () => {
  assert.equal(isAuthorized("Bearer not-it", SECRET), false);
});

test("cron auth: rejects when CRON_SECRET unset on server", () => {
  assert.equal(isAuthorized(`Bearer ${SECRET}`, undefined), false);
});

test("cron auth: accepts exact-match Bearer + secret", () => {
  assert.equal(isAuthorized(`Bearer ${SECRET}`, SECRET), true);
});

// ---------------------------------------------------------------------------
// Discord embed shape — covers the route's effect, not the auth gate.
// ---------------------------------------------------------------------------

type Posted = { url: string; init: RequestInit };

function fakeFetch(): { fetch: typeof fetch; posted: Posted[] } {
  const posted: Posted[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    posted.push({
      url: typeof url === "string" ? url : url.toString(),
      init: init ?? {},
    });
    return new Response("ok", { status: 200 });
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, posted };
}

test("postBrowseTelemetry: idle-day shape (orange + 📊 title)", async () => {
  const { fetch, posted } = fakeFetch();
  await postBrowseTelemetry(
    "https://discord.example/webhook",
    {
      date: "2026-05-24",
      total24h: 17,
      byCounts: { page_render: 12, wishlist_cron: 5, manual: 0 },
      successRatePct: 100,
      pctOfCeiling: 0.3,
      approachingCeiling: false,
      daily7: [
        { date: "2026-05-18", total: 0 },
        { date: "2026-05-19", total: 0 },
        { date: "2026-05-20", total: 5 },
        { date: "2026-05-21", total: 8 },
        { date: "2026-05-22", total: 12 },
        { date: "2026-05-23", total: 14 },
        { date: "2026-05-24", total: 17 },
      ],
    },
    { fetchImpl: fetch },
  );
  assert.equal(posted.length, 1);
  const body = JSON.parse(posted[0].init.body as string);
  assert.equal(body.embeds[0].color, 0xff6b5c); // orange — not approaching
  assert.match(body.embeds[0].title, /^📊 Browse telemetry \(2026-05-24\)/);
  const fields = body.embeds[0].fields as Array<{ name: string; value: string }>;
  const find = (n: string) => fields.find((f) => f.name === n)?.value;
  assert.equal(find("24h total"), "17");
  assert.equal(find("page_render"), "12");
  assert.equal(find("wishlist_cron"), "5");
  assert.equal(find("manual"), "0");
  // 7-day chart present (last line should mention today's count)
  const chart = find("Last 7 days") ?? "";
  assert.match(chart, /05-24:.*17/);
});

test("postBrowseTelemetry: approaching-ceiling shape (red + ⚠ title)", async () => {
  const { fetch, posted } = fakeFetch();
  await postBrowseTelemetry(
    "https://discord.example/webhook",
    {
      date: "2026-05-24",
      total24h: 4200,
      byCounts: { page_render: 200, wishlist_cron: 4000, manual: 0 },
      successRatePct: 99.0,
      pctOfCeiling: 84.0,
      approachingCeiling: true,
      daily7: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-05-${String(18 + i).padStart(2, "0")}`,
        total: 4200,
      })),
    },
    { fetchImpl: fetch },
  );
  const body = JSON.parse(posted[0].init.body as string);
  assert.equal(body.embeds[0].color, 0xef4444); // red
  assert.match(body.embeds[0].title, /^⚠ Approaching daily ceiling/);
});

test("postBrowseTelemetry: includes purgedRows field when > 0", async () => {
  const { fetch, posted } = fakeFetch();
  await postBrowseTelemetry(
    "https://discord.example/webhook",
    {
      date: "2026-05-24",
      total24h: 10,
      byCounts: { page_render: 10, wishlist_cron: 0, manual: 0 },
      successRatePct: 100,
      pctOfCeiling: 0.2,
      approachingCeiling: false,
      daily7: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-05-${String(18 + i).padStart(2, "0")}`,
        total: 10,
      })),
      purgedRows: 42,
    },
    { fetchImpl: fetch },
  );
  const body = JSON.parse(posted[0].init.body as string);
  const fields = body.embeds[0].fields as Array<{ name: string; value: string }>;
  const purge = fields.find((f) => f.name === "Retention sweep");
  assert.ok(purge);
  assert.match(purge!.value, /42 rows purged \(>90d\)/);
});

test("postBrowseTelemetry: omits purgedRows field when zero or undefined", async () => {
  const { fetch, posted } = fakeFetch();
  await postBrowseTelemetry(
    "https://discord.example/webhook",
    {
      date: "2026-05-24",
      total24h: 0,
      byCounts: { page_render: 0, wishlist_cron: 0, manual: 0 },
      successRatePct: 100,
      pctOfCeiling: 0,
      approachingCeiling: false,
      daily7: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-05-${String(18 + i).padStart(2, "0")}`,
        total: 0,
      })),
    },
    { fetchImpl: fetch },
  );
  const body = JSON.parse(posted[0].init.body as string);
  const fields = body.embeds[0].fields as Array<{ name: string; value: string }>;
  const purge = fields.find((f) => f.name === "Retention sweep");
  assert.equal(purge, undefined);
});
