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
import { upsertWatchlist } from "@/lib/wishlist/upsert";
import { validateWatchlistSubmission } from "@/lib/wishlist/validate";

// NOTE: a "use server" file may only export async functions — `type` exports
// are erased at compile so they're allowed, but a runtime `const` is not. The
// initial state lives in the client form (components/cards/watchlist-form.tsx).
export type WatchlistFormState = {
  status: "idle" | "success" | "error";
  /** Short tag for the error case — rendered as friendly copy client-side. */
  error?: string;
};

function dollarsToCents(raw: FormDataEntryValue | null): number {
  const n = typeof raw === "string" ? parseFloat(raw) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
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

  // Resolve the card's real baked variants so a watch can only target a
  // printing that exists. getCardMetadata is 24h-cached + soft-fails.
  const card = await getCardMetadata({ id: entry.pokemonTcgId });
  const availableVariantKeys = deriveAvailableVariants(card);

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

  const res = await upsertWatchlist(admin, parsed.value);
  if (!res.ok) {
    console.warn("[create-watchlist] upsert failed:", res.error);
    return { status: "error", error: "save_failed" };
  }

  // Newsletter opt-in — soft-fail. A Beehiiv outage can never block the watch.
  if (formData.get("opt_in_newsletter") != null) {
    try {
      const sub = await subscribeEmail({ email: parsed.value.email, source: "watchlist-form" });
      if (!sub.ok) console.warn("[create-watchlist] beehiiv subscribe returned ok:false");
    } catch (err) {
      console.warn("[create-watchlist] beehiiv subscribe threw:", (err as Error).message);
    }
  }

  return { status: "success" };
}
