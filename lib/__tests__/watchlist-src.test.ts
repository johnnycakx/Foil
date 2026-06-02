// F2: per-source attribution for watchlist email captures. Pins that the
// inbound `?src=` tag reaches the DB write (the end of the form -> action ->
// upsert -> row chain) when present, and is omitted (never null-overwritten)
// when absent.

import test from "node:test";
import assert from "node:assert/strict";
import { upsertWatchlist } from "../wishlist/upsert.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types.ts";

function fakeAdmin(): { admin: SupabaseClient<Database>; captured: () => Record<string, unknown> | null } {
  let row: Record<string, unknown> | null = null;
  const admin = {
    from() {
      return { upsert(r: Record<string, unknown>) { row = r; return { error: null }; } };
    },
  } as unknown as SupabaseClient<Database>;
  return { admin, captured: () => row };
}

const base = {
  email: "buyer@example.com",
  card_slug: "swsh7-218-rayquaza-vmax-alt-art",
  variant: "default",
  condition: "any-raw",
  target_price_cents: 12000,
};

test("upsertWatchlist persists src to the row when the pilot tag is present", async () => {
  const { admin, captured } = fakeAdmin();
  const res = await upsertWatchlist(admin, { ...base, src: "pokebeard" });
  assert.ok(res.ok);
  assert.equal(captured()?.src, "pokebeard");
});

test("upsertWatchlist omits src entirely when absent (no null-overwrite on a later price update)", async () => {
  const { admin, captured } = fakeAdmin();
  await upsertWatchlist(admin, base);
  assert.ok(!("src" in (captured() ?? {})), "src key must be absent, not null");

  const n = fakeAdmin();
  await upsertWatchlist(n.admin, { ...base, src: null });
  assert.ok(!("src" in (n.captured() ?? {})), "explicit null src is also omitted");
});
