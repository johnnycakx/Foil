// PokeTrace variant derivation + catalog-card matching (ADR-042).
//
// PokeTrace identifies cards by UUID, and a single Foil catalog card (one
// Pokemon TCG SDK id, e.g. base1-4 Charizard) can correspond to SEVERAL
// PokeTrace UUIDs — one per print *edition/finish*. PokeTrace has NO
// edition field; editions are encoded as (a) distinct set slugs
// (`base-set` vs `base-set-shadowless`) and (b) the `variant` string
// (`Holofoil` / `Reverse_Holofoil` / `Unlimited_Holofoil` / `Normal`).
// So we DERIVE a canonical variantKey + edition booleans by parsing those
// two fields. Verified empirically against the live API in Session 49.
//
// These are pure functions (no network) so the bake script and the render
// path share one matcher, and it's unit-testable.

/** The minimal PokeTrace card shape the matcher needs. */
export type PtCardLite = {
  id: string;
  name: string;
  cardNumber: string; // e.g. "004/102"
  set: { slug: string; name: string };
  variant: string; // e.g. "Holofoil", "Unlimited_Holofoil", "Reverse_Holofoil"
  rarity?: string | null;
  /** PokeTrace prices block — used only to rank duplicate variant matches. */
  prices?: Record<string, Record<string, { saleCount?: number | null } | unknown>> | null;
};

/** One baked per-variant record (written to baked-metadata.json). */
export type PoketraceVariant = {
  /** Canonical key, e.g. "holofoil", "shadowless-holofoil", "1st-edition-holofoil", "reverse-holofoil", "non-holo". */
  variantKey: string;
  /** PokeTrace UUID for this specific variant. */
  poketraceId: string;
  /** Human label, e.g. "Shadowless Holofoil". */
  variantLabel: string;
  isHolo: boolean;
  isFirstEdition: boolean;
  isShadowless: boolean;
  isUnlimited: boolean;
};

/** First integer in a "NNN/MMM" (or bare) card number, normalized (no leading zeros). */
export function bareNumber(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d+)/);
  return m ? String(parseInt(m[1], 10)) : null;
}

/** Denominator of a "NNN/MMM" card number, normalized. Null when absent. */
export function denomNumber(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/\/\s*(\d+)/);
  return m ? String(parseInt(m[1], 10)) : null;
}

export function slugifyName(s: string | null | undefined): string {
  if (typeof s !== "string") return "";
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Derive the canonical variant record from a PokeTrace card. */
export function deriveVariant(card: PtCardLite): PoketraceVariant {
  const slug = slugifyName(card.set?.slug ?? "");
  const slugName = slugifyName(card.set?.name ?? "");
  const v = (card.variant ?? "").toLowerCase();
  const rar = (card.rarity ?? "").toLowerCase();

  // Edition: slug is the authoritative signal (PokeTrace's shadowless set
  // even labels its variant "Unlimited_Holofoil", so slug must win).
  const isShadowless = /shadowless/.test(slug) || /shadowless/.test(slugName);
  const isFirstEdition =
    /1st-edition|first-edition/.test(slug) ||
    /1st-edition|first-edition/.test(slugName) ||
    /\b1st_edition\b|\bfirst_edition\b/.test(v);
  const isReverse = v.includes("reverse");
  const isHolo = v.includes("holofoil") || rar.includes("holo");
  // "Unlimited" only when PokeTrace says so explicitly (and it's not the
  // shadowless/1st-edition printing, which slug already claimed).
  const isUnlimited = !isShadowless && !isFirstEdition && v.includes("unlimited");

  const finish = isReverse ? "reverse-holofoil" : isHolo ? "holofoil" : "non-holo";
  const editionTok = isShadowless
    ? "shadowless"
    : isFirstEdition
      ? "1st-edition"
      : isUnlimited
        ? "unlimited"
        : "";
  const variantKey = editionTok ? `${editionTok}-${finish}` : finish;

  return {
    variantKey,
    poketraceId: card.id,
    variantLabel: labelForVariantKey(variantKey),
    isHolo,
    isFirstEdition,
    isShadowless,
    isUnlimited,
  };
}

/** The watchlist sentinel meaning "any printing of this card". Stored in the
 *  `variant` column for rows that didn't pin a specific variant. */
export const DEFAULT_VARIANT_KEY = "default";

/**
 * Valid watchlist variant tokens for a card: the sentinel "default" plus every
 * baked PokeTrace variantKey the card actually has. The write path validates a
 * submitted variant against this list so a row can only target a printing that
 * exists (Session 49b / ADR-043). Takes the structural `{ variants }` shape
 * (not the full CardMetadata) to avoid a lib/cards ↔ lib/poketrace import cycle.
 */
export function deriveAvailableVariants(card: { variants?: PoketraceVariant[] } | null | undefined): string[] {
  const keys = (card?.variants ?? []).map((v) => v.variantKey);
  return [DEFAULT_VARIANT_KEY, ...new Set(keys)];
}

export type KeywordSet = { include: string[]; exclude: string[] };

/**
 * eBay include/exclude keyword set derived from a variantKey, for biasing the
 * Browse search + gating listing titles (Session 49b / ADR-043). The key
 * encodes edition + finish (e.g. "1st-edition-holofoil"), so we parse it
 * directly rather than needing the full PoketraceVariant (the cron only has the
 * stored token). Matching is case-insensitive substring on the listing title.
 *
 * Examples:
 *   "1st-edition-holofoil" → include ["1st Edition","Holo"]
 *   "shadowless-holofoil"  → include ["Shadowless","Holo"], exclude ["1st Edition", …]
 *   "unlimited-holofoil"   → include ["Holo"], exclude ["1st Edition","Shadowless", …]
 *   "default"              → no keywords (matches any printing)
 */
export function variantEbayKeywords(variantKey: string | null | undefined): KeywordSet {
  const include: string[] = [];
  const exclude: string[] = [];
  if (!variantKey || variantKey === DEFAULT_VARIANT_KEY) return { include, exclude };

  const k = variantKey.toLowerCase();
  const isReverse = k.includes("reverse");
  const isNonHolo = k.includes("non-holo");
  const isHolo = !isReverse && k.includes("holofoil");
  const isShadowless = k.includes("shadowless");
  const isFirstEdition = k.includes("1st-edition") || k.includes("first-edition");
  const isUnlimited = k.includes("unlimited");

  // Edition first.
  if (isShadowless) {
    include.push("Shadowless");
    exclude.push("1st Edition");
  } else if (isFirstEdition) {
    include.push("1st Edition");
  } else if (isUnlimited) {
    exclude.push("1st Edition", "Shadowless");
  }

  // Finish.
  if (isReverse) {
    include.push("Reverse Holo");
  } else if (isHolo) {
    include.push("Holo");
    exclude.push("Reverse");
  } else if (isNonHolo) {
    exclude.push("Holo");
  }

  return {
    include: [...new Set(include)],
    exclude: [...new Set(exclude)],
  };
}

/** Human-readable label from a variantKey ("1st-edition-holofoil" → "1st Edition Holofoil"). */
export function labelForVariantKey(key: string): string {
  return key
    .split("-")
    .map((tok) => {
      if (tok === "1st") return "1st";
      if (tok === "non") return "Non";
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    })
    .join(" ")
    .replace("Non Holo", "Non-Holo");
}

function totalSaleCount(card: PtCardLite): number {
  let n = 0;
  const prices = card.prices;
  if (!prices) return 0;
  for (const tiers of Object.values(prices)) {
    if (!tiers || typeof tiers !== "object") continue;
    for (const snap of Object.values(tiers)) {
      const sc = (snap as { saleCount?: number | null })?.saleCount;
      if (typeof sc === "number" && Number.isFinite(sc)) n += sc;
    }
  }
  return n;
}

export type CatalogTarget = {
  name: string;
  /** Pokemon TCG SDK set display name, e.g. "Base", "Evolving Skies". */
  setName: string;
  /** Printed set total from the SDK set metadata (may diverge from PokeTrace
   *  for modern sets with secret rares — used as one of two accept signals). */
  setTotal: number;
  /** Collector number numerator as printed, e.g. "4" or "215". */
  number: string;
};

export type MatchResult = {
  status: "matched" | "miss" | "ambiguous";
  variants: PoketraceVariant[];
  /** Diagnostic note for the misses log (always set for miss/ambiguous). */
  note: string;
};

/**
 * Match a catalog card against PokeTrace search candidates and return the
 * derived per-variant array.
 *
 * Accept gate (per candidate): the numerator matches AND
 *   (the denominator equals our SDK set total  OR  the set name matches exactly).
 * The denominator gate disambiguates vintage reprints (Base Set 102 vs Base
 * Set 2 130) and groups editions (Shadowless Base Set is also 004/102); the
 * exact-set-name gate rescues modern alt-arts whose printed denominator
 * diverges from the SDK total (215/203 vs SDK 237).
 */
export function matchCatalogCard(target: CatalogTarget, candidates: PtCardLite[]): MatchResult {
  const tNum = bareNumber(target.number);
  if (!tNum) return { status: "miss", variants: [], note: "catalog card has no parseable number" };
  const tSet = slugifyName(target.setName);
  const tTotal = target.setTotal > 0 ? String(target.setTotal) : null;

  const accepted = candidates.filter((c) => {
    if (bareNumber(c.cardNumber) !== tNum) return false;
    const denomMatch = tTotal !== null && denomNumber(c.cardNumber) === tTotal;
    const nameExact = tSet.length > 0 && slugifyName(c.set?.name ?? "") === tSet;
    // Modern PokeTrace set slugs are prefixed (swsh07-evolving-skies); accept
    // when the set slug equals or ends with our full slugified set name. The
    // full-token suffix keeps it specific — "base" won't match "base-set-2".
    const cSlug = slugifyName(c.set?.slug ?? "");
    const slugSuffix = tSet.length > 3 && (cSlug === tSet || cSlug.endsWith(`-${tSet}`));
    return denomMatch || nameExact || slugSuffix;
  });

  if (accepted.length === 0) {
    const seen = candidates
      .slice(0, 6)
      .map((c) => `${c.set?.slug}#${c.cardNumber}(${c.variant})`)
      .join(", ");
    return { status: "miss", variants: [], note: `no candidate matched; saw: ${seen || "(none)"}` };
  }

  // Derive + dedupe by variantKey (keep the most-traded duplicate).
  const byKey = new Map<string, { variant: PoketraceVariant; sales: number }>();
  let collisions = 0;
  for (const c of accepted) {
    const variant = deriveVariant(c);
    const sales = totalSaleCount(c);
    const existing = byKey.get(variant.variantKey);
    if (!existing) {
      byKey.set(variant.variantKey, { variant, sales });
    } else {
      collisions++;
      if (sales > existing.sales) byKey.set(variant.variantKey, { variant, sales });
    }
  }

  const variants = [...byKey.values()].map((e) => e.variant);
  const note = collisions > 0 ? `${collisions} duplicate variantKey(s) collapsed by saleCount` : "";
  return { status: collisions > 0 ? "ambiguous" : "matched", variants, note };
}
