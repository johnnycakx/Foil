// Pure watchlist-submission validator (Session 49b / ADR-043).
//
// Kept in its own module (not the "use server" action file, whose exports must
// all be async server actions) so it's unit-testable in isolation and shared
// by both write paths. Validates the four security-relevant fields before any
// DB write: email shape, slug shape, variant-exists-on-card, condition token,
// and the price range. The caller supplies the card's available variant keys
// (deriveAvailableVariants) so a row can only ever target a printing that
// actually exists.

import { isValidConditionToken, DEFAULT_CONDITION, type ConditionToken } from "../cards/conditions.ts";
import { DEFAULT_VARIANT_KEY } from "../poketrace/variant.ts";

export type RawWatchlistSubmission = {
  email?: unknown;
  card_slug?: unknown;
  variant?: unknown;
  condition?: unknown;
  target_price_cents?: unknown;
};

export type ValidatedWatchlist = {
  email: string;
  card_slug: string;
  variant: string;
  condition: ConditionToken;
  /** null = blank target ("alert at ≥15% under the 30-day sold avg", ADR-091). */
  target_price_cents: number | null;
};

export type ValidationResult =
  | { ok: true; value: ValidatedWatchlist }
  | { ok: false; error: string };

// Conservative email shape — the DB column + Resend reject anything past this.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * Validate a raw watchlist submission. `availableVariantKeys` must include the
 * "default" sentinel (deriveAvailableVariants always prepends it). Returns the
 * normalized value (lowercased email, defaulted variant/condition) or a short
 * error tag suitable for returning to the client without leaking internals.
 */
export function validateWatchlistSubmission(
  raw: RawWatchlistSubmission,
  availableVariantKeys: readonly string[],
): ValidationResult {
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: "invalid_email" };
  }

  const card_slug = typeof raw.card_slug === "string" ? raw.card_slug.trim() : "";
  if (!card_slug || card_slug.length > 120 || !SLUG_RE.test(card_slug)) {
    return { ok: false, error: "invalid_card_slug" };
  }

  const variant =
    typeof raw.variant === "string" && raw.variant.length > 0 ? raw.variant : DEFAULT_VARIANT_KEY;
  if (!availableVariantKeys.includes(variant)) {
    return { ok: false, error: "invalid_variant" };
  }

  const condition =
    typeof raw.condition === "string" && raw.condition.length > 0 ? raw.condition : DEFAULT_CONDITION;
  if (!isValidConditionToken(condition)) {
    return { ok: false, error: "invalid_condition" };
  }

  // Blank target is a VALID watch (ADR-091): "alert me at ≥15% under the
  // 30-day sold average." Absent/empty → null; anything supplied must be a
  // sane integer cent amount. No sentinel value exists.
  const rawTarget = raw.target_price_cents;
  let cents: number | null;
  if (rawTarget == null || rawTarget === "") {
    cents = null;
  } else {
    const n = typeof rawTarget === "number" ? rawTarget : Number(rawTarget);
    if (!Number.isInteger(n) || n < 1 || n > 10_000_000) {
      return { ok: false, error: "invalid_target_price" };
    }
    cents = n;
  }

  return { ok: true, value: { email, card_slug, variant, condition, target_price_cents: cents } };
}
