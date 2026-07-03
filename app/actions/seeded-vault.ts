"use server";

// Seeded-vault claim action (eve-vault, ADR-100). The thin request-shaped
// wrapper around lib/wishlist/seeded-claim.ts: verifies the SEEDED token
// (context-separated from email-vault tokens — lib/vault-token.ts), applies
// the /start funnel's abuse posture (honeypot → fake success; per-IP budget),
// then runs the claim core with the real funnel deps (tri-store opt-in with
// the vault's UTM attribution, welcome email with the claimant's personal
// vault link — inbox-only, never echoed to the browser).
//
// Results travel as a ?c= flag on the redirect back to the seeded page (the
// page is force-dynamic; the claim row drives the post-claim render):
//   ok      claimed (or idempotent re-claim by the same email)
//   taken   someone else claimed it first
//   invalid email didn't parse
//   err     transient save failure — try again

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifySeededVaultToken } from "@/lib/vault-token";
import { getSeededVault, type SeededVault } from "@/lib/vault-seeds";
import { claimSeededVaultCore } from "@/lib/wishlist/seeded-claim";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { subscribeEmail } from "@/lib/beehiiv";
import { recordSubscriber } from "@/lib/newsletter/subscribers";
import { sendVaultLinkEmail } from "@/lib/wishlist/vault-email";
import { postError } from "@/lib/notifications/discord";
import { clientIpKey, createIpRateLimiter, isHoneypotTripped } from "@/lib/start/guards";

// Same budget as the vault recovery form (ADR-093): the claim is a public
// email-adjacent primitive; humans submit once or twice.
const claimLimiter = createIpRateLimiter({ maxRequests: 5, windowMs: 10 * 60 * 1000 });

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function notifyErrors(errorType: string, message: string, context: Record<string, string>): void {
  const webhook = process.env.DISCORD_WEBHOOK_ERRORS;
  if (!webhook) return;
  void postError(webhook, { source: "seeded-vault-claim", errorType, message, context }).catch(() => {});
}

function maskInline(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/** Tri-store newsletter opt-in — mirrors /api/start's block (every leg
 *  soft-fails; failures ping #errors, never the claimant). */
async function subscribeClaimant(email: string, vault: SeededVault): Promise<void> {
  try {
    const subResult = await subscribeEmail({ email, source: vault.subscriberSource });
    if (!subResult.ok) {
      notifyErrors("BeehiivSubscribeFailed", "subscribeEmail returned ok:false", {
        source: vault.subscriberSource,
        email_masked: maskInline(email),
      });
    }
  } catch (subErr) {
    notifyErrors("BeehiivSubscribeThrew", (subErr as Error).message, {
      source: vault.subscriberSource,
      email_masked: maskInline(email),
    });
  }
  const recorded = await recordSubscriber({
    email,
    source: vault.subscriberSource,
    utm: vault.utm,
  });
  if (!recorded.supabase) {
    notifyErrors("OwnedListWriteFailed", "recordSubscriber supabase leg failed", {
      source: vault.subscriberSource,
      email_masked: maskInline(email),
    });
  }
}

export async function claimSeededVault(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const verified = verifySeededVaultToken(token);
  if (!verified.ok) return; // bad token: no work, no signal
  const vault = getSeededVault(verified.vaultId);
  if (!vault) return;

  const back = (flag: string): never => {
    revalidatePath(`/w/${encodeURIComponent(token)}`);
    redirect(`/w/${encodeURIComponent(token)}?c=${flag}`);
  };

  // Honeypot → FAKE success (don't teach the bot which field tripped it).
  if (isHoneypotTripped(formData.get("website"))) back("ok");

  // Per-IP budget. Over → uniform transient-error flag (retryable by a human).
  let ipKey = "unknown";
  try {
    ipKey = clientIpKey(await headers());
  } catch {
    /* headers unavailable → shared bucket */
  }
  if (!claimLimiter.check(ipKey)) back("err");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) back("invalid");

  let admin: SupabaseClient;
  try {
    admin = supabaseAdmin() as unknown as SupabaseClient;
  } catch {
    back("err");
    return; // unreachable (redirect throws) — satisfies control-flow analysis
  }

  const result = await claimSeededVaultCore(vault, email, {
    admin,
    subscribe: subscribeClaimant,
    sendWelcome: (e) => sendVaultLinkEmail(e, "welcome").then(() => undefined),
  });

  if (result.ok) back("ok");
  if (!result.ok && result.error === "already_claimed") back("taken");
  if (!result.ok && result.error === "watch_cap") back("err");
  back("err");
}
