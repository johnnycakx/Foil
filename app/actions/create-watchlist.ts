"use server";

// Watchlist create/update Server Action (Session 49b / ADR-043).
//
// Primary write path for the per-card page "Email me when it drops" form. Per
// the project's coding conventions ("Server Actions for mutations, not
// client-side fetch") this replaces the inline fetch('/api/watchlist') the
// form used through Session 48. The legacy route still exists for backward
// compatibility and shares the same validator + upsert helper.
//
// Flow: parse FormData → resolve the card (catalog + baked variants) → validate
// every field (email / slug / variant-exists-on-card / condition token / price)
// → UPSERT on (email, card_slug, variant, condition) → soft-fail newsletter
// opt-in. Returns a serializable state for useActionState; never throws.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { subscribeEmail } from "@/lib/beehiiv";
import { getCatalogEntry } from "@/lib/cards/catalog";
import { getCardMetadata } from "@/lib/cards/sdk";
import { deriveAvailableVariants } from "@/lib/poketrace/variant";
import { getHydratedVariants } from "@/lib/poketrace/hydration";
import { buildVaultUrl } from "@/lib/vault-token";
import { sendVaultLinkEmail } from "@/lib/wishlist/vault-email";
import { upsertWatchlist } from "@/lib/wishlist/upsert";
import { validateWatchlistSubmission } from "@/lib/wishlist/validate";

// NOTE: a "use server" file may only export async functions — `type` exports
// are erased at compile so they're allowed, but a runtime `const` is not. The
// initial state lives in the client form (components/cards/watchlist-form.tsx).
export type WatchlistFormState = {
  status: "idle" | "success" | "error";
  /** Short tag for the error case — rendered as friendly copy client-side. */
  error?: string;
  /** Private vault link (ADR-093) — inline ONLY for a first-watch (brand-new)
   *  vault; null for an existing vault (delivered by email instead). */
  vaultUrl?: string | null;
  /** True when the vault link was emailed (first watch) — drives the
   *  "check your inbox" success copy when no inline link is returned. */
  vaultLinkEmailed?: boolean;
};

function dollarsToCents(raw: FormDataEntryValue | null): number | null {
  // Blank = a valid market-basis watch (ADR-091): validate.ts maps null
  // through; the visible form still marks the field required (its UX asks
  // for a target), so null only arises on deliberate blank submissions.
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** Sanitize the inbound `?src=` creator/campaign tag (F2). Untrusted URL input:
 *  reduce to the safe `[a-z0-9-]` charset, cap length, null when empty. */
function sanitizeSrc(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  return clean || null;
}

export async function createWatchlist(
  _prev: WatchlistFormState,
  formData: FormData,
): Promise<WatchlistFormState> {
  const card_slug = String(formData.get("card_slug") ?? "");
  const entry = getCatalogEntry(card_slug);
  if (!entry) {
    return { status: "error", error: "invalid_card_slug" };
  }

  // Resolve the card's real variants so a watch can only target a printing
  // that exists. Baked snapshot first; for runtime-HYDRATED cards (ADR-092)
  // the baked list is empty, so mirror the card page's merge — otherwise the
  // form legitimately offers a hydrated variant the validator then rejects.
  const card = await getCardMetadata({ id: entry.pokemonTcgId });
  let variantsForCard = card.variants ?? [];
  if (variantsForCard.length === 0) {
    variantsForCard = (await getHydratedVariants(card_slug)).variants;
  }
  const availableVariantKeys = deriveAvailableVariants({ variants: variantsForCard });

  const parsed = validateWatchlistSubmission(
    {
      email: formData.get("email"),
      card_slug,
      variant: formData.get("variant"),
      condition: formData.get("condition"),
      target_price_cents: dollarsToCents(formData.get("target_price")),
    },
    availableVariantKeys,
  );
  if (!parsed.ok) {
    return { status: "error", error: parsed.error };
  }

  let admin: ReturnType<typeof supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch {
    console.warn("[create-watchlist] supabaseAdmin() unavailable");
    return { status: "error", error: "unavailable" };
  }

  // First watch for this address? (checked BEFORE the upsert so the welcome
  // email fires exactly once — ADR-093.) Soft-fail: a count error just skips
  // the welcome; the vault link still lands via the success state + alerts.
  let isFirstWatch = false;
  try {
    const { count, error: countError } = await admin
      .from("watchlists")
      .select("id", { count: "exact", head: true })
      .eq("email", parsed.value.email);
    isFirstWatch = !countError && (count ?? 0) === 0;
  } catch {
    /* skip the welcome */
  }

  const res = await upsertWatchlist(admin, { ...parsed.value, src: sanitizeSrc(formData.get("src")) });
  if (!res.ok) {
    console.warn("[create-watchlist] upsert failed:", res.error);
    return { status: "error", error: "save_failed" };
  }
  if (isFirstWatch) {
    await sendVaultLinkEmail(parsed.value.email, "welcome");
  }
  // The vault link is a bearer credential (ADR-093 / security-review HIGH):
  // return it inline ONLY for a brand-new vault — there's nothing
  // pre-existing to leak, and the submitter just created it. An address that
  // already had a vault gets the link by email only (the inbox is the proof
  // of control the token assumes); its watch was still saved.

  // Newsletter opt-in — soft-fail. A Beehiiv outage can never block the watch.
  if (formData.get("opt_in_newsletter") != null) {
    try {
      const sub = await subscribeEmail({ email: parsed.value.email, source: "watchlist-form" });
      if (!sub.ok) console.warn("[create-watchlist] beehiiv subscribe returned ok:false");
    } catch (err) {
      console.warn("[create-watchlist] beehiiv subscribe threw:", (err as Error).message);
    }
  }

  return {
    status: "success",
    vaultUrl: isFirstWatch ? buildVaultUrl(parsed.value.email) : null,
    vaultLinkEmailed: isFirstWatch,
  };
}
