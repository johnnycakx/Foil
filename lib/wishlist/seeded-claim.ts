// Seeded-vault claim core (eve-vault, ADR-100; TEMPLATE model per the
// eve-vault-template-claims amendment). Pure orchestration with injected deps
// so every branch unit-tests without a network (the scan-batch DI pattern).
// The Server Action wrapper (app/actions/seeded-vault.ts) owns the
// request-shaped concerns: token verify, honeypot, per-IP limit.
//
// Claim semantics (template instantiation — the link lives in a PUBLIC reply,
// so anyone clicking it gets the same experience):
//   - UNLIMITED: every email that claims gets its OWN watch-set (the seeded
//     pockets applied as a template through the real funnel machinery). There
//     is no cross-email lock and no "claimed by someone else" state.
//   - IDEMPOTENT per email: the (vault_slug, claimed_email) PK insert is the
//     instantiation log. A re-submit by the same email hits the unique
//     violation, re-runs the row upserts (heals a partially-failed first
//     claim), and reports "already_yours" — never duplicate watch rows.
//   - The claimant's PERSONAL vault link travels by EMAIL only (the welcome
//     send) — never echoed to the browser. The seeded page's URL is public
//     (it's in a tweet); echoing an email-vault token there would turn
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
  | { ok: false; error: "watch_cap" | "save_failed" | "unavailable" };

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

  // Watch-cap BEFORE instantiating (an over-cap address gets no new rows and
  // no log entry). Count failure → proceed; the cap is an abuse guard, not an
  // invariant (same posture as /api/start).
  const { count: existingCount, error: countError } = await admin
    .from("watchlists")
    .select("id", { count: "exact", head: true })
    .eq("email", email);
  if (!countError && exceedsWatchCap(existingCount ?? 0, vault.pockets.length)) {
    return { ok: false, error: "watch_cap" };
  }

  // The instantiation log: one row per (vault, claimer). 23505 = THIS email
  // already instantiated this vault (the composite PK makes that the only
  // possible conflict) — idempotent path, heal the rows below.
  const { error: claimError } = await admin
    .from("seeded_vault_claims")
    .insert({ vault_slug: vault.id, claimed_email: email });

  let status: "claimed" | "already_yours" = "claimed";
  if (claimError) {
    if (claimError.code !== "23505") return { ok: false, error: "unavailable" };
    status = "already_yours";
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
    // Total write failure. On a FRESH instantiation, release this email's log
    // row so the claimant can retry (leaving it would strand a logged-but-empty
    // gift). Other emails' instances are untouched.
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
