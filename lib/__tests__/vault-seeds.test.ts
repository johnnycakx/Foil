// Seeded gift vaults (eve-vault, ADR-100; TEMPLATE model per the
// eve-vault-template-claims amendment). Pins the acceptance criteria:
//   - Token: seeded context is cryptographically separate from BOTH the
//     email-vault and unsubscribe audiences (no cross-audience verify).
//   - Curation (navigation-promise): every seed pocket is in CARD_CATALOG
//     AND has real committed sold data — no stub pockets on a gift.
//   - Claim = INSTANTIATE, unlimited: N emails → N independent instances
//     with zero cross-email leakage; idempotent per email (re-submit heals
//     rows, never duplicates); watch-cap checked before any write; rows born
//     with NULL targets (blank-target market basis) + the seed's src;
//     suppression inherited; welcome email only on first watch; this email's
//     log row released if every row write fails (other instances untouched).
//   - The page NEVER locks: no claimed-by-someone-else state, no email ever
//     rendered — post-submit state is per-visitor (?c= flag).
//   - Exposure: the claim path never echoes an email-vault token to the
//     browser (structural), and /eve 302s to the seeded vault with UTMs.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mintSeededVaultToken,
  verifySeededVaultToken,
  mintVaultToken,
  verifyVaultToken,
  buildSeededVaultUrl,
} from "../vault-token.ts";
import { mintUnsubscribeToken } from "../unsubscribe-token.ts";
import { SEEDED_VAULTS, getSeededVault, getSnapshotSold } from "../vault-seeds.ts";
import { getCatalogEntry } from "../cards/catalog.ts";
import { claimSeededVaultCore } from "../wishlist/seeded-claim.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const SECRET = "test-secret-key-that-is-long-enough";

function withSecret<T>(fn: () => T): T {
  const prev = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  process.env.UNSUBSCRIBE_TOKEN_SECRET = SECRET;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.UNSUBSCRIBE_TOKEN_SECRET;
    else process.env.UNSUBSCRIBE_TOKEN_SECRET = prev;
  }
}

// --- token audience separation ----------------------------------------------

test("seeded token: mint → verify round-trip; lowercased id; URL shape", () => {
  withSecret(() => {
    const token = mintSeededVaultToken("EVE");
    assert.ok(token);
    const v = verifySeededVaultToken(token!);
    assert.ok(v.ok);
    if (v.ok) assert.equal(v.vaultId, "eve");
    const url = buildSeededVaultUrl("eve", { baseUrl: "https://foiltcg.com" });
    assert.ok(url!.startsWith("https://foiltcg.com/w/"));
  });
});

test("audience separation: seeded ↛ email-vault ↛ seeded ↛ unsubscribe (all cross-verifies fail)", () => {
  withSecret(() => {
    const seeded = mintSeededVaultToken("eve")!;
    const emailVault = mintVaultToken("victim@example.com")!;
    const unsub = mintUnsubscribeToken("victim@example.com")!;
    assert.equal(verifyVaultToken(seeded).ok, false, "a seeded token must never open an email vault");
    assert.equal(verifySeededVaultToken(emailVault).ok, false, "an email-vault token must never open a seeded vault");
    assert.equal(verifySeededVaultToken(unsub).ok, false, "an unsubscribe token must never open a seeded vault");
  });
});

test("seeded token: tampering fails closed", () => {
  withSecret(() => {
    const token = mintSeededVaultToken("eve")!;
    const [payload, sig] = token.split(".");
    const other = mintSeededVaultToken("demo")!.split(".")[0];
    assert.equal(verifySeededVaultToken(`${other}.${sig}`).ok, false, "payload swap");
    const flipped = (sig.startsWith("A") ? "B" : "A") + sig.slice(1);
    assert.equal(verifySeededVaultToken(`${payload}.${flipped}`).ok, false, "signature bitflip");
    assert.equal(verifySeededVaultToken(payload).ok, false, "truncation");
    assert.equal(verifySeededVaultToken("").ok, false, "empty");
  });
});

// --- curation: the navigation-promise rule ----------------------------------

test("every seed pocket is in CARD_CATALOG and has real committed sold data (no stub pockets on a gift)", () => {
  for (const vault of Object.values(SEEDED_VAULTS)) {
    assert.ok(vault.pockets.length >= 6 && vault.pockets.length <= 8, `${vault.id}: 6-8 pockets`);
    assert.equal(new Set(vault.pockets).size, vault.pockets.length, `${vault.id}: no duplicate pockets`);
    for (const slug of vault.pockets) {
      assert.ok(getCatalogEntry(slug), `${vault.id}/${slug}: must be in CARD_CATALOG`);
      const sold = getSnapshotSold(slug);
      assert.ok(sold && sold.soldCents > 0, `${vault.id}/${slug}: must have committed sold data`);
      assert.ok(sold!.saleCount >= 10, `${vault.id}/${slug}: sold basis too thin (${sold!.saleCount} sales)`);
    }
  }
});

test("eve's seed: the duo curation + attribution the goal pins", () => {
  const eve = getSeededVault("eve");
  assert.ok(eve);
  assert.equal(eve!.dedication, "@possiblyeve");
  assert.equal(eve!.src, "eve-vault");
  assert.deepEqual(eve!.utm, { source: "x", medium: "eve", campaign: null });
  assert.ok(eve!.pockets.includes("swsh7-215-umbreon-vmax-alt-art"), "Moonbreon is the anchor grail");
  assert.ok(eve!.pockets.includes("sv8pt5-155-espeon-ex"), "Espeon ex SIR");
  // A throwaway seed exists for John's live claim test (never eve's first).
  assert.ok(getSeededVault("demo"), "the demo seed is the claim-flow test target");
});

// --- the claim core (template instantiation) ---------------------------------

type Call = {
  table: string;
  op: string;
  payload?: unknown;
  opts?: Record<string, unknown>;
  eqs: Array<[string, unknown]>;
};

function fakeAdmin(state: {
  /** existing watch count PER EMAIL (default 0 for unlisted emails) */
  watchCounts?: Record<string, number>;
  /** emails that already instantiated the vault */
  claims?: string[];
  failWatchUpsert?: boolean;
  suppression?: { alerts_paused_at: string; paused_source: string } | null;
}) {
  const calls: Call[] = [];
  const claims = new Set<string>(state.claims ?? []);

  async function resolveCall(call: Call): Promise<unknown> {
    if (call.table === "watchlists" && call.op === "select" && call.opts?.head) {
      const email = String(call.eqs.find(([col]) => col === "email")?.[1] ?? "");
      return { count: state.watchCounts?.[email] ?? 0, error: null };
    }
    if (call.table === "watchlists" && call.op === "select") {
      // getAlertSuppression probe
      return { data: state.suppression ? [state.suppression] : [], error: null };
    }
    if (call.table === "watchlists" && call.op === "upsert") {
      return { error: state.failWatchUpsert ? { message: "boom" } : null };
    }
    if (call.table === "seeded_vault_claims" && call.op === "insert") {
      const row = call.payload as { claimed_email: string };
      // Composite-PK semantics: the only possible conflict is the SAME email.
      if (claims.has(row.claimed_email)) {
        return { error: { code: "23505", message: "duplicate key" } };
      }
      claims.add(row.claimed_email);
      return { error: null };
    }
    if (call.table === "seeded_vault_claims" && call.op === "delete") {
      const email = String(call.eqs.find(([col]) => col === "claimed_email")?.[1] ?? "");
      claims.delete(email);
      return { error: null };
    }
    if (call.table === "card_hydration") return { error: null };
    return { data: null, error: null };
  }

  const admin = {
    from(table: string) {
      const call: Call = { table, op: "", eqs: [] };
      calls.push(call);
      const b: Record<string, unknown> = {};
      const chain = (fn?: (...a: unknown[]) => void) => (...a: unknown[]) => {
        fn?.(...a);
        return b;
      };
      Object.assign(b, {
        select: chain((sel, o) => {
          if (!call.op) call.op = "select";
          call.opts = (o ?? {}) as Record<string, unknown>;
          void sel;
        }),
        insert: chain((row) => {
          call.op = "insert";
          call.payload = row;
        }),
        upsert: chain((row, o) => {
          call.op = "upsert";
          call.payload = row;
          call.opts = (o ?? {}) as Record<string, unknown>;
        }),
        delete: chain(() => {
          call.op = "delete";
        }),
        eq: chain((col, val) => {
          call.eqs.push([String(col), val]);
        }),
        not: chain(),
        in: chain(),
        order: chain(),
        limit: chain(),
        maybeSingle: chain(),
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
          return resolveCall(call).then(onFulfilled, onRejected);
        },
      });
      return b;
    },
  } as unknown as SupabaseClient;

  return { admin, calls, getClaims: () => [...claims] };
}

function deps(admin: SupabaseClient) {
  const subscribed: string[] = [];
  const welcomed: string[] = [];
  return {
    deps: {
      admin,
      subscribe: async (email: string) => {
        subscribed.push(email);
      },
      sendWelcome: async (email: string) => {
        welcomed.push(email);
      },
    },
    subscribed,
    welcomed,
  };
}

const EVE = SEEDED_VAULTS.eve;

test("claim: fresh claim logs the instantiation + one NULL-target row per pocket with the seed src, subscribes, welcomes", async () => {
  const { admin, calls, getClaims } = fakeAdmin({});
  const d = deps(admin);
  const result = await claimSeededVaultCore(EVE, "Eve@Example.com", d.deps);
  assert.deepEqual(result, { ok: true, status: "claimed" });
  assert.deepEqual(getClaims(), ["eve@example.com"], "log row holds the lowercased email");

  const upserts = calls.filter((c) => c.table === "watchlists" && c.op === "upsert");
  assert.equal(upserts.length, EVE.pockets.length, "one watch row per pocket");
  for (const u of upserts) {
    const row = u.payload as Record<string, unknown>;
    assert.equal(row.email, "eve@example.com");
    assert.equal(row.target_price_cents, null, "smart target = blank-target market basis (ADR-091)");
    assert.equal(row.src, EVE.src);
    assert.equal(row.variant, "default");
    assert.equal(row.condition, "any-raw");
  }
  assert.deepEqual(d.subscribed, ["eve@example.com"], "tri-store opt-in runs once");
  assert.deepEqual(d.welcomed, ["eve@example.com"], "first watch → welcome email with HER vault link");
});

test("claim: TEMPLATE — two different emails get two independent instances, zero cross-email leakage", async () => {
  const { admin, calls, getClaims } = fakeAdmin({});
  const d = deps(admin);

  const first = await claimSeededVaultCore(EVE, "first@example.com", d.deps);
  const second = await claimSeededVaultCore(EVE, "second@example.com", d.deps);
  assert.deepEqual(first, { ok: true, status: "claimed" }, "first claimer instantiates");
  assert.deepEqual(second, { ok: true, status: "claimed" }, "second claimer is NOT locked out — same experience");
  assert.deepEqual(getClaims().sort(), ["first@example.com", "second@example.com"], "one log row per claimer");

  const upserts = calls.filter((c) => c.table === "watchlists" && c.op === "upsert");
  assert.equal(upserts.length, EVE.pockets.length * 2, "each instance gets its own full pocket set");
  const emails = new Set(upserts.map((u) => (u.payload as Record<string, unknown>).email));
  assert.deepEqual([...emails].sort(), ["first@example.com", "second@example.com"]);
  for (const u of upserts) {
    const row = u.payload as Record<string, unknown>;
    assert.ok(
      row.email === "first@example.com" || row.email === "second@example.com",
      "every row belongs to exactly one claimer — no cross-email writes",
    );
  }
  assert.deepEqual(d.welcomed.sort(), ["first@example.com", "second@example.com"], "each first-watch claimer gets THEIR OWN welcome");
});

test("claim: an address with existing watches gets NO duplicate welcome (inbox-only bearer rule)", async () => {
  const { admin } = fakeAdmin({ watchCounts: { "collector@example.com": 3 } });
  const d = deps(admin);
  const result = await claimSeededVaultCore(EVE, "collector@example.com", d.deps);
  assert.ok(result.ok);
  assert.deepEqual(d.welcomed, [], "welcome only on the FIRST watch for the address");
});

test("claim: idempotent re-claim by the same email heals the rows, no duplicates, no second welcome", async () => {
  const { admin, calls, getClaims } = fakeAdmin({
    claims: ["eve@example.com"],
    watchCounts: { "eve@example.com": 6 },
  });
  const d = deps(admin);
  const result = await claimSeededVaultCore(EVE, "EVE@example.com", d.deps);
  assert.deepEqual(result, { ok: true, status: "already_yours" });
  assert.deepEqual(getClaims(), ["eve@example.com"], "still exactly one log row for the email");
  assert.equal(
    calls.filter((c) => c.table === "watchlists" && c.op === "upsert").length,
    EVE.pockets.length,
    "re-claim re-runs the upserts (heals a partially-failed first claim; upsert = no duplicate rows)",
  );
  assert.deepEqual(d.welcomed, [], "no duplicate welcome");
});

test("claim: watch-cap is checked BEFORE any write (no log row, no watch rows)", async () => {
  const { admin, calls, getClaims } = fakeAdmin({ watchCounts: { "hoarder@example.com": 97 } });
  const d = deps(admin);
  const result = await claimSeededVaultCore(EVE, "hoarder@example.com", d.deps);
  assert.deepEqual(result, { ok: false, error: "watch_cap" });
  assert.deepEqual(getClaims(), [], "an over-cap address writes nothing");
  assert.equal(calls.filter((c) => c.table === "seeded_vault_claims" && c.op === "insert").length, 0);
});

test("claim: total row-write failure releases only THIS email's log row (other instances untouched)", async () => {
  const { admin, getClaims } = fakeAdmin({ claims: ["earlier@example.com"], failWatchUpsert: true });
  const d = deps(admin);
  const result = await claimSeededVaultCore(EVE, "eve@example.com", d.deps);
  assert.deepEqual(result, { ok: false, error: "save_failed" });
  assert.deepEqual(getClaims(), ["earlier@example.com"], "the failed claimer's row is released; earlier instances survive");
  assert.deepEqual(d.welcomed, [], "no welcome on failure");
});

test("claim: a suppressed address's seeded rows are born paused (claiming ≠ consent to resume, ADR-090)", async () => {
  const { admin, calls } = fakeAdmin({
    watchCounts: { "optedout@example.com": 2 },
    suppression: { alerts_paused_at: "2026-06-01T00:00:00Z", paused_source: "unsubscribe" },
  });
  const d = deps(admin);
  const result = await claimSeededVaultCore(EVE, "optedout@example.com", d.deps);
  assert.ok(result.ok);
  const upserts = calls.filter((c) => c.table === "watchlists" && c.op === "upsert");
  assert.ok(upserts.length > 0);
  for (const u of upserts) {
    const row = u.payload as Record<string, unknown>;
    assert.equal(row.alerts_paused_at, "2026-06-01T00:00:00Z", "inherited pause");
    assert.equal(row.paused_source, "unsubscribe", "inherited source");
  }
});

// --- exposure + wiring (structural pins) -------------------------------------

test("the claim path never mints or echoes an email-vault token to the browser", () => {
  const action = read("app/actions/seeded-vault.ts");
  assert.doesNotMatch(action, /buildVaultUrl|mintVaultToken/, "the personal vault link travels by EMAIL only (sendVaultLinkEmail)");
  assert.match(action, /sendVaultLinkEmail/, "the welcome send is the only link channel");
  assert.match(action, /isHoneypotTripped/, "honeypot guard present");
  assert.match(action, /createIpRateLimiter/, "per-IP budget present");
  const core = read("lib/wishlist/seeded-claim.ts");
  assert.doesNotMatch(core, /buildVaultUrl|mintVaultToken/, "the core cannot leak the bearer credential either");
});

test("the public page NEVER locks: no cross-email claim state, no email ever rendered, form always available to a fresh visitor", () => {
  const view = read("app/(site)/w/[token]/seeded-vault-view.tsx");
  assert.match(view, /claimSeededVault/, "form posts the claim action");
  assert.match(view, /name="website"/, "honeypot field rendered");
  // Template model: the view reads NO claim state from the DB and renders no
  // claimant identity — post-submit state is per-visitor via the ?c= flag.
  assert.doesNotMatch(view, /getSeededVaultClaim/, "the view must not read cross-visitor claim state");
  assert.doesNotMatch(view, /publicMask|claimedEmail|claimed_email/, "no email (masked or raw) ever renders on the public page");
  assert.doesNotMatch(view, /first email claims/i, "the single-claim copy is retired");
  assert.match(view, /claimFlag === "ok"/, "post-submit confirmation is per-visitor (?c=ok)");
  assert.match(view, /claimFlag === "again"/, "idempotent re-claim gets the friendly already-watching state");
  assert.match(view, /-fork/, "fork CTA carries the -fork src");
  assert.match(view, /Made for \{vault\.dedication\}/, "dedication chip (the /lines pattern)");
  const action = read("app/actions/seeded-vault.ts");
  assert.doesNotMatch(action, /"taken"|already_claimed/, "no claimed-by-someone-else outcome exists anywhere in the action");
  const core = read("lib/wishlist/seeded-claim.ts");
  assert.doesNotMatch(core, /already_claimed/, "the core has no cross-email lock error");
  const page = read("app/(site)/w/[token]/page.tsx");
  assert.match(page, /verifySeededVaultToken/, "the page branches to the seeded view");
  assert.match(page, /notFound\(\)/, "both token failures still render the uniform 404");
});
