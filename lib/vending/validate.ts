// Pure validators for the two vending-surface forms (Phase V-1). Same pattern
// as lib/wishlist/validate.ts: kept out of the "use server" action files so
// they are unit-testable in isolation, and every security-relevant field is
// shape-checked before any DB write. Closed token sets are shared between the
// form markup, the validator, and the migration's CHECK constraints so the
// three can't drift.

export const VENUE_TYPES = [
  "card_shop",
  "barbershop",
  "bowling_fec",
  "mall",
  "grocery",
  "other",
] as const;
export type VenueType = (typeof VENUE_TYPES)[number];

export const FOOT_TRAFFIC_BUCKETS = [
  "under_50",
  "50_200",
  "200_500",
  "over_500",
  "unsure",
] as const;
export type FootTrafficBucket = (typeof FOOT_TRAFFIC_BUCKETS)[number];

export const OUTLET_ANSWERS = ["yes", "no", "unsure"] as const;
export type OutletAnswer = (typeof OUTLET_ANSWERS)[number];

export const SELLS_CARDS_ANSWERS = ["yes", "no"] as const;
export type SellsCardsAnswer = (typeof SELLS_CARDS_ANSWERS)[number];

export const HOST_PRIORITIES = ["reliability", "appearance", "revenue", "amenity"] as const;
export type HostPriority = (typeof HOST_PRIORITIES)[number];

// Same conservative shape the watchlist validator uses.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function cleanText(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function optionalText(v: unknown, max: number): string | null {
  const s = cleanText(v, max);
  return s.length > 0 ? s : null;
}

function optionalToken<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

// ---------------------------------------------------------------------------
// /machines restock-alert signup
// ---------------------------------------------------------------------------

export type ValidatedRestockSignup = {
  email: string;
  /** Free-text city so pre-placement demand maps to real geography. */
  city: string | null;
};

export type RestockSignupResult =
  | { ok: true; value: ValidatedRestockSignup }
  | { ok: false; error: string };

export function validateRestockSignup(raw: { email?: unknown; city?: unknown }): RestockSignupResult {
  const email = cleanText(raw.email, 254).toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "invalid_email" };
  }
  return { ok: true, value: { email, city: optionalText(raw.city, 120) } };
}

// ---------------------------------------------------------------------------
// /host lead capture
// ---------------------------------------------------------------------------

export type ValidatedHostLead = {
  name: string;
  business_name: string;
  venue_type: VenueType;
  city: string;
  email: string;
  phone: string | null;
  foot_traffic: FootTrafficBucket;
  hours_of_access: string | null;
  placement_outlet: OutletAnswer | null;
  sells_cards: SellsCardsAnswer | null;
  priority: HostPriority | null;
  notes: string | null;
};

export type HostLeadResult =
  | { ok: true; value: ValidatedHostLead }
  | { ok: false; error: string };

export function validateHostLead(raw: Record<string, unknown>): HostLeadResult {
  const name = cleanText(raw.name, 120);
  if (!name) return { ok: false, error: "missing_name" };

  const business_name = cleanText(raw.business_name, 160);
  if (!business_name) return { ok: false, error: "missing_business_name" };

  const venue_type = optionalToken(raw.venue_type, VENUE_TYPES);
  if (!venue_type) return { ok: false, error: "missing_venue_type" };

  const city = cleanText(raw.city, 120);
  if (!city) return { ok: false, error: "missing_city" };

  const email = cleanText(raw.email, 254).toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: "invalid_email" };

  const foot_traffic = optionalToken(raw.foot_traffic, FOOT_TRAFFIC_BUCKETS);
  if (!foot_traffic) return { ok: false, error: "missing_foot_traffic" };

  return {
    ok: true,
    value: {
      name,
      business_name,
      venue_type,
      city,
      email,
      phone: optionalText(raw.phone, 40),
      foot_traffic,
      hours_of_access: optionalText(raw.hours_of_access, 160),
      placement_outlet: optionalToken(raw.placement_outlet, OUTLET_ANSWERS),
      sells_cards: optionalToken(raw.sells_cards, SELLS_CARDS_ANSWERS),
      priority: optionalToken(raw.priority, HOST_PRIORITIES),
      notes: optionalText(raw.notes, 2000),
    },
  };
}
