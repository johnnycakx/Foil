// One-click unsubscribe actually stops alerts (start-funnel-integrity, ADR-090).
//
// The CAN-SPAM hole this pins: /api/unsubscribe used to touch ONLY Beehiiv —
// neither `newsletter_subscribers` (the store the digest sends from) nor
// `watchlists` (the alert cron's scan) — and the confirmation page told the
// recipient to "email john…" to stop alerts. These tests cover the pause
// behavior (unit, fake client), the route wiring + the cron exclusion + the
// complaint leg (structural pins, same style as the other route tests), and
// the re-opt-in unpause on the shared upsert.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types.ts";
import { getAlertSuppression, pauseWatchlistAlerts } from "../wishlist/pause.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

// Minimal fake for the update().eq().is().select() chain.
function fakeClient(result: { data: { id: string }[] | null; error: { message: string } | null }, calls: Record<string, unknown>[]) {
  return {
    from(table: string) {
      return {
        update(payload: Record<string, unknown>) {
          return {
            eq(col: string, val: unknown) {
              return {
                is(gateCol: string, gateVal: unknown) {
                  return {
                    async select() {
                      calls.push({ table, payload, eq: [col, val], is: [gateCol, gateVal] });
                      return result;
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient<Database>;
}

test("pauseWatchlistAlerts: flips every active row for the (normalized) email", async () => {
  const calls: Record<string, unknown>[] = [];
  const out = await pauseWatchlistAlerts("  Collector@Gmail.com ", {
    getClient: () => fakeClient({ data: [{ id: "a" }, { id: "b" }, { id: "c" }], error: null }, calls),
    nowIso: "2026-07-01T00:00:00.000Z",
  });
  assert.equal(out.outcome, "paused");
  assert.equal(out.pausedCount, 3);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].eq, ["email", "collector@gmail.com"], "email must be normalized");
  assert.deepEqual(calls[0].is, ["alerts_paused_at", null], "gate on still-active rows (idempotent replay)");
  assert.deepEqual(calls[0].payload, { alerts_paused_at: "2026-07-01T00:00:00.000Z", paused_source: "unsubscribe" });
});

test("pauseWatchlistAlerts: replay / unknown email is a noop, DB failure is 'error', neither throws", async () => {
  const noop = await pauseWatchlistAlerts("nobody@example.com", {
    getClient: () => fakeClient({ data: [], error: null }, []),
  });
  assert.equal(noop.outcome, "noop");
  assert.equal(noop.pausedCount, 0);

  const failed = await pauseWatchlistAlerts("x@example.com", {
    getClient: () => fakeClient({ data: null, error: { message: "boom" } }, []),
  });
  assert.equal(failed.outcome, "error");

  const thrown = await pauseWatchlistAlerts("x@example.com", {
    getClient: () => {
      throw new Error("no client");
    },
  });
  assert.equal(thrown.outcome, "error");

  const empty = await pauseWatchlistAlerts("   ");
  assert.equal(empty.outcome, "noop");
});

test("/api/unsubscribe: stops BOTH the newsletter (tri-store sync) and the alerts", () => {
  const src = read("app/api/unsubscribe/route.ts");
  assert.match(src, /syncUnsubscribe\(verified\.email\)/, "newsletter legs (Supabase + Beehiiv)");
  assert.match(src, /pauseWatchlistAlerts\(verified\.email\)/, "alert pause leg");
  // The old Beehiiv-only call must not return.
  assert.doesNotMatch(src, /import \{ unsubscribeEmail \} from "@\/lib\/beehiiv"/);
});

test("/api/unsubscribe confirmation copy: no more 'email john to stop alerts'", () => {
  const src = read("app/api/unsubscribe/route.ts");
  assert.doesNotMatch(
    src,
    /To stop those too, email/,
    "the manual-email escape hatch for alerts is gone — unsubscribe stops everything",
  );
  assert.match(src, /every card price alert are both stopped/);
});

test("wishlist-alert cron: scan excludes paused rows", () => {
  const src = read("app/api/cron/wishlist-alerts/route.ts");
  assert.match(
    src,
    /\.is\("alerts_paused_at", null\)/,
    "the cron's due-row query must filter out paused addresses",
  );
});

test("resend webhook: a spam complaint pauses watchlist alerts too", () => {
  const src = read("app/api/webhooks/resend/route.ts");
  assert.match(src, /event\.type === "email\.complained"/);
  assert.match(src, /pauseWatchlistAlerts\(email, \{ source: "complaint" \}\)/);
});

test("shared watchlist upsert: suppression is STICKY — no unauthenticated path clears a pause", () => {
  // /security-review caught the bypass in the first cut of this goal: the
  // upsert cleared alerts_paused_at as "renewed consent", so anyone who KNEW
  // a victim's email could POST /api/start and resume alerts to an address
  // that spam-complained. Knowing an email is not consent. The upsert now
  // inherits suppression (new/updated rows for a suppressed email are written
  // paused) and never writes alerts_paused_at: null.
  const src = read("lib/wishlist/upsert.ts");
  assert.doesNotMatch(src, /alerts_paused_at:\s*null/, "the unauthenticated write path must never clear a pause");
  assert.match(src, /getAlertSuppression/, "the upsert must check per-email suppression");
  assert.match(src, /alerts_paused_at: suppression\.pausedAtIso, paused_source: suppression\.source/, "suppressed emails' rows inherit the pause AND its source (ADR-093)");
});

test("/api/start: precomputes suppression once per batch and passes it to every upsert", () => {
  const src = read("app/api/start/route.ts");
  assert.match(src, /const suppression = await getAlertSuppression\(admin, email\)/);
  assert.match(src, /\{ suppression \}/);
});

// Fake for the select().eq().not().in().order().limit() suppression chain.
function fakeSuppressionClient(result: {
  data: { alerts_paused_at: string | null; paused_source?: string | null }[] | null;
  error: { message: string } | null;
}) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                not() {
                  return {
                    in() {
                      return {
                        order() {
                          return { limit: async () => result };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient<Database>;
}

test("getAlertSuppression: returns the suppression record for a suppressed email, null otherwise, never throws", async () => {
  const paused = await getAlertSuppression(
    fakeSuppressionClient({
      data: [{ alerts_paused_at: "2026-07-01T00:00:00.000Z", paused_source: "complaint" }],
      error: null,
    }),
    "Victim@Example.com",
  );
  assert.deepEqual(paused, { pausedAtIso: "2026-07-01T00:00:00.000Z", source: "complaint" });

  const active = await getAlertSuppression(
    fakeSuppressionClient({ data: [], error: null }),
    "fresh@example.com",
  );
  assert.equal(active, null);

  const errored = await getAlertSuppression(
    fakeSuppressionClient({ data: null, error: { message: "boom" } }),
    "x@example.com",
  );
  assert.equal(errored, null, "DB error fails open for the write (shared DB health) without throwing");

  assert.equal(await getAlertSuppression(fakeSuppressionClient({ data: [], error: null }), "  "), null);
});

test("/api/unsubscribe copy: does not invite re-adding alerts at /start (suppression is sticky)", () => {
  const src = read("app/api/unsubscribe/route.ts");
  assert.doesNotMatch(src, /fresh alerts at/, "resuming alerts requires a verified action, not a form");
});

test("shared watchlist upsert: normalizes the email at the choke point (case-variant pause evasion)", () => {
  // /security-review residual: the legacy /api/watchlist endpoint wrote the
  // email verbatim, so a row born "Victim@Example.com" could NEVER be paused —
  // the one-click unsubscribe lowercases and matches case-sensitively. The
  // shared upsert now lowercases for every caller; the backfill migration
  // brings prior rows in line.
  const src = read("lib/wishlist/upsert.ts");
  assert.match(src, /const email = input\.email\.trim\(\)\.toLowerCase\(\)/);
  const migrations = read("supabase/migrations/20260701235000_watchlists_email_lower.sql");
  assert.match(migrations, /update watchlists set email = lower\(email\)/);
});
