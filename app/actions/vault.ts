"use server";

// Vault server actions (watchlist-web-app, ADR-093). Every action takes the
// signed vault token and re-verifies it server-side — the token IS the auth,
// and every DB write is scoped to BOTH the row id AND the token's email so a
// leaked row id from another vault can never be edited cross-account.
//
// Resume semantics (ADR-093, coherent with ADR-090/091):
//   - resume clears vault- and unsubscribe-sourced pauses; complaint-sourced
//     pauses are NOT clearable from here (spam complaint = strongest opt-out).
//   - alert_state is never touched by pause/resume/target edits — the alert
//     engine's armed/fired rules (ADR-091) govern firing; a resume or a new
//     target can't force a re-fire past the hysteresis.

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { verifyVaultToken } from "@/lib/vault-token";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCatalogEntry } from "@/lib/cards/catalog";
import { upsertWatchlist } from "@/lib/wishlist/upsert";
import { pauseWatchlistAlerts, resumeWatchlistAlerts } from "@/lib/wishlist/pause";
import { sendVaultLinkEmail } from "@/lib/wishlist/vault-email";
import { clientIpKey, createIpRateLimiter } from "@/lib/start/guards";

// Per-instance limiter for the recovery send (ADR-093 / security-review): the
// recovery form is a public email-send primitive, so it gets the same abuse
// posture as /api/start — a per-IP budget so it can't be scripted into an
// email-bomb. Warm-instance memory; a cold start resets it (acceptable pre-
// traffic, same as the /start limiter).
const recoveryLimiter = createIpRateLimiter({ maxRequests: 5, windowMs: 10 * 60 * 1000 });

export type VaultActionResult = { ok: boolean; error?: string };

function verifyOr(token: unknown): { email: string } | null {
  if (typeof token !== "string") return null;
  const v = verifyVaultToken(token);
  return v.ok ? { email: v.email } : null;
}

function refresh(token: string): void {
  revalidatePath(`/w/${encodeURIComponent(token)}`);
}

/** Change a watch's target. Blank → null (market-basis watch, ADR-091). */
export async function vaultUpdateTarget(formData: FormData): Promise<void> {
  const token = formData.get("token");
  const auth = verifyOr(token);
  if (!auth) return;
  const rowId = String(formData.get("row_id") ?? "");
  if (!rowId) return;

  const rawTarget = String(formData.get("target_usd") ?? "").trim();
  let targetCents: number | null = null;
  if (rawTarget !== "") {
    const n = Math.round(parseFloat(rawTarget) * 100);
    if (!Number.isInteger(n) || n < 1 || n > 10_000_000) {
      return;
    }
    targetCents = n;
  }

  try {
    const admin = supabaseAdmin();
    const { error } = await admin
      .from("watchlists")
      .update({ target_price_cents: targetCents })
      .eq("id", rowId)
      .eq("email", auth.email);
    if (error) return;
    refresh(token as string);
    return;
  } catch {
    return;
  }
}

/** Pause one card (vault-sourced — freely resumable). */
export async function vaultPauseCard(formData: FormData): Promise<void> {
  const token = formData.get("token");
  const auth = verifyOr(token);
  if (!auth) return;
  const rowId = String(formData.get("row_id") ?? "");
  if (!rowId) return;
  try {
    const admin = supabaseAdmin();
    const { error } = await admin
      .from("watchlists")
      .update({ alerts_paused_at: new Date().toISOString(), paused_source: "vault" })
      .eq("id", rowId)
      .eq("email", auth.email)
      .is("alerts_paused_at", null);
    if (error) return;
    refresh(token as string);
    return;
  } catch {
    return;
  }
}

/** Resume one card — complaint-sourced pauses are NOT clearable (ADR-093). */
export async function vaultResumeCard(formData: FormData): Promise<void> {
  const token = formData.get("token");
  const auth = verifyOr(token);
  if (!auth) return;
  const rowId = String(formData.get("row_id") ?? "");
  if (!rowId) return;
  try {
    const admin = supabaseAdmin();
    const { error } = await admin
      .from("watchlists")
      .update({ alerts_paused_at: null, paused_source: null })
      .eq("id", rowId)
      .eq("email", auth.email)
      .neq("paused_source", "complaint")
      .not("alerts_paused_at", "is", null);
    if (error) return;
    refresh(token as string);
    return;
  } catch {
    return;
  }
}

/** Remove a card from the vault. */
export async function vaultRemoveCard(formData: FormData): Promise<void> {
  const token = formData.get("token");
  const auth = verifyOr(token);
  if (!auth) return;
  const rowId = String(formData.get("row_id") ?? "");
  if (!rowId) return;
  try {
    const admin = supabaseAdmin();
    const { error } = await admin
      .from("watchlists")
      .delete()
      .eq("id", rowId)
      .eq("email", auth.email);
    if (error) return;
    refresh(token as string);
    return;
  } catch {
    return;
  }
}

/** Pause every card (vault-sourced). */
export async function vaultPauseAll(formData: FormData): Promise<void> {
  const token = formData.get("token");
  const auth = verifyOr(token);
  if (!auth) return;
  await pauseWatchlistAlerts(auth.email, { source: "vault" });
  refresh(token as string);
}

/** Resume every card except complaint-suppressed rows (ADR-093). */
export async function vaultResumeAll(formData: FormData): Promise<void> {
  const token = formData.get("token");
  const auth = verifyOr(token);
  if (!auth) return;
  await resumeWatchlistAlerts(auth.email);
  refresh(token as string);
}

/**
 * Lost-link recovery (/w). ALWAYS reports success — the response must never
 * disclose whether an email has a vault (account-enumeration posture). The
 * link only sends when watch rows actually exist for the address.
 */
export async function vaultRecoverLink(formData: FormData): Promise<{ ok: true }> {
  // Honeypot (same pattern as /api/start): a filled hidden field is a bot →
  // uniform success, no work.
  if (String(formData.get("website") ?? "").trim() !== "") return { ok: true };

  // Per-IP budget so this public send primitive can't be scripted into an
  // email-bomb against third parties. Over budget → uniform success, no send
  // (indistinguishable from "no vault for that email").
  let ipKey = "unknown";
  try {
    ipKey = clientIpKey(await headers());
  } catch {
    /* headers unavailable → shared bucket */
  }
  const withinBudget = recoveryLimiter.check(ipKey);

  const raw = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!raw || raw.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) {
    return { ok: true }; // uniform response, even for garbage
  }
  if (!withinBudget) return { ok: true };

  // Do the DB check + send OFF the response path (after()) so response
  // latency can't distinguish "has a vault" (send round-trip) from "doesn't"
  // — the timing-oracle enumeration the uniform body alone didn't close.
  // after() is Vercel-safe (unlike a bare dropped promise).
  after(async () => {
    try {
      const admin = supabaseAdmin();
      const { count } = await admin
        .from("watchlists")
        .select("id", { count: "exact", head: true })
        .eq("email", raw);
      if ((count ?? 0) > 0) {
        await sendVaultLinkEmail(raw, "recovery");
      }
    } catch {
      /* soft-fail; the response was already uniform */
    }
  });
  return { ok: true };
}

/** Add a card in place (the shared type-ahead's pick). Server re-validates
 *  against the catalog; the shared upsert brings suppression-inherit +
 *  demand-driven hydration (ADR-092) along for free. */
export async function vaultAddCard(formData: FormData): Promise<VaultActionResult> {
  const token = formData.get("token");
  const auth = verifyOr(token);
  if (!auth) return { ok: false, error: "invalid_token" };

  const pokemonTcgId = String(formData.get("pokemon_tcg_id") ?? "");
  const entry = pokemonTcgId
    ? // The type-ahead sends the SDK id; resolve the authoritative slug from
      // the catalog (the client is untrusted — same posture as /api/start).
      (await import("@/lib/cards/catalog")).CARD_CATALOG.find((e) => e.pokemonTcgId === pokemonTcgId)
    : getCatalogEntry(String(formData.get("card_slug") ?? ""));
  if (!entry) return { ok: false, error: "not_in_catalog" };

  const rawTarget = String(formData.get("target_usd") ?? "").trim();
  let targetCents: number | null = null;
  if (rawTarget !== "") {
    const n = Math.round(parseFloat(rawTarget) * 100);
    if (!Number.isInteger(n) || n < 1 || n > 10_000_000) return { ok: false, error: "invalid_target" };
    targetCents = n;
  }

  try {
    const admin = supabaseAdmin();
    const { ok } = await upsertWatchlist(admin, {
      email: auth.email,
      card_slug: entry.slug,
      variant: "default",
      condition: "any-raw",
      target_price_cents: targetCents,
      src: "vault",
    });
    if (!ok) return { ok: false, error: "save_failed" };
    refresh(token as string);
    return { ok: true };
  } catch {
    return { ok: false, error: "save_failed" };
  }
}
