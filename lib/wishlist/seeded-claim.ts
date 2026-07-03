// Seeded-vault claim core (eve-vault, ADR-100). Pure orchestration with
// injected deps so every branch unit-tests without a network (the scan-batch
// DI pattern). The Server Action wrapper (app/actions/seeded-vault.ts) owns
// the request-shaped concerns: token verify, honeypot, per-IP limit.
//
// Claim semantics:
//   - ATOMIC: the seeded_vault_claims PK insert is the claim. A concurrent
//     second claim loses on the unique violation — no read-then-write race.
//   - IDEMPOTENT for the claimant: re-submitting the same email re-runs the
//     row upserts (heals a partially-failed first claim) and reports success.
//   - The claimed email's PERSONAL vault link travels by EMAIL only (the
//     welcome send) — never echoed to the browser. The seeded page's URL is
//     public (it's in a tweet); echoing an email-vault token there would turn
//     "found the tweet" into "reads/edits the claimant's watchlist" (the same
//     /security-review HIGH the /api/start first-watch rule exists for).
//   - Suppression is inherited (ADR-090): a suppressed email's seeded rows
//     are born paused; claiming is not consent to resume.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SeededVault } from "../vault-seeds.ts";
import { upsertWatchlist } from "./upsert.ts";
import { getAlertSuppression } from "./pause.ts";
import { exceedsWatchCap } from "../start/guards.ts";

export type SeededClaimResult =
  | { ok: true; status: "claimed" | "already_yours" }
  | { ok: false; error: "already_claimed" | "watch_cap" | "save_failed" | "unavailable" };

export type SeededClaimDeps = {
  admin: SupabaseClient;
  /** Tri-store newsletter opt-in (Beehiiv + owned list + Resend). Soft-fail
   *  inside — a subscribe outage never fails the claim. */
  subscribe: (email: string, vault: SeededVault) => Promise<void>;
  /** Welcome email carrying the claimant's PERSONAL vault link. Only called
   *  on the first watch for the address (mirrors /api/start). */
  sendWelcome: (email: string) => Promise<void>;
};

export async function claimSeededVaultCore(
  vault: SeededVault,
  rawEmail: string,
  deps: SeededClaimDeps,
): Promise<SeededClaimResult> {
  const email = rawEmail.trim().toLowerCase();
  const { admin } = deps;

  // Watch-cap BEFORE claiming (an over-cap address must not consume the one
  // claim). Count failure → proceed; the cap is an abuse guard, not an
  // invariant (same posture as /api/start).
  const { count: existingCount, error: countError } = await admin
    .from("watchlists")
    .select("id", { count: "exact", head: true })
    .eq("email", email);
  if (!countError && exceedsWatchCap(existingCount ?? 0, vault.pockets.length)) {
    return { ok: false, error: "watch_cap" };
  }

  // THE claim: a PK insert. 23505 = someone (possibly this same email,
  // re-submitting) already claimed it.
  const { error: claimError } = await admin
    .from("seeded_vault_claims")
    .insert({ vault_slug: vault.id, claimed_email: email });

  let status: "claimed" | "already_yours" = "claimed";
  if (claimError) {
    if (claimError.code !== "23505") return { ok: false, error: "unavailable" };
    const { data: existing } = await admin
      .from("seeded_vault_claims")
      .select("claimed_email")
      .eq("vault_slug", vault.id)
      .maybeSingle();
    if (!existing || existing.claimed_email !== email) {
      return { ok: false, error: "already_claimed" };
    }
    status = "already_yours"; // idempotent re-claim: heal the rows below
  }

  // Seed the real watch rows: null target = the blank-target market basis
  // ("alert at ≥15% under the 30-day sold average", ADR-091) — the "smart
  // targets" the page displays. Suppression precomputed once for the batch.
  const suppression = await getAlertSuppression(admin, email);
  let upserted = 0;
  for (const cardSlug of vault.pockets) {
    const { ok } = await upsertWatchlist(
      admin,
      {
        email,
        card_slug: cardSlug,
        variant: "default",
        condition: "any-raw",
        target_price_cents: null,
        src: vault.src,
      },
      { suppression },
    );
    if (ok) upserted += 1;
  }
  if (upserted === 0) {
    // Total write failure. On a FRESH claim, release the claim row so the
    // claimant can retry (leaving it would strand a claimed-but-empty gift).
    if (status === "claimed") {
      await admin
        .from("seeded_vault_claims")
        .delete()
        .eq("vault_slug", vault.id)
        .eq("claimed_email", email);
    }
    return { ok: false, error: "save_failed" };
  }

  // Newsletter opt-in (soft-fail inside the injected fn) + the welcome email
  // with the claimant's personal vault link — first watch only, mirroring
  // /api/start's bearer-credential rule.
  await deps.subscribe(email, vault);
  if (!countError && (existingCount ?? 0) === 0) {
    await deps.sendWelcome(email);
  }

  return { ok: true, status };
}

/** Read claim state for a seeded vault. Null = unclaimed (or read failure —
 *  the page then renders the claim form; a transient read error must not
 *  paint someone else's masked email). */
export async function getSeededVaultClaim(
  admin: SupabaseClient,
  vaultId: string,
): Promise<{ claimedEmail: string; claimedAt: string } | null> {
  try {
    const { data } = await admin
      .from("seeded_vault_claims")
      .select("claimed_email, claimed_at")
      .eq("vault_slug", vaultId)
      .maybeSingle();
    if (!data?.claimed_email) return null;
    return { claimedEmail: data.claimed_email, claimedAt: data.claimed_at ?? "" };
  } catch {
    return null;
  }
}
