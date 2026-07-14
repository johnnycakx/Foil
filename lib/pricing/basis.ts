// Price PROVENANCE — the typed keystone of the brand promise (pricing-bridge,
// ADR-118).
//
// "Foil doesn't guess prices. It reads real sales."
//
// That promise was, until now, enforced only by hand-written prose in one
// component (ADR-110's "TCGplayer listed prices … can lag recent eBay" copy).
// Nothing in the type system stopped a LISTED number from being rendered under
// a SOLD label — and when the sold spine goes dark (a lapsed PokeTrace key,
// R-070), the pressure to backfill the hero with "some price" is exactly when
// that would happen silently.
//
// So basis is now a TYPE, not a caption. Every price that reaches a surface
// carries where it came from and what it actually measures:
//
//   sold   — a real completed sale (eBay sold comps). The ONLY basis that may
//            render as a headline sold figure.
//   listed — an asking/market index (TCGplayer). Renders ONLY under an explicit
//            "listed (may lag)" label, never as a sold figure.
//   guide  — a third-party derived guide value (PriceCharting). Internal QA
//            only — its ToS bars user-facing display (R-072).
//
// The invariant is enforced twice: at compile time (a sold surface's props are
// typed `SoldBasisPrice`, so a listed price is a type error) and at runtime
// (`assertSoldBasis`, pinned by test). Belt and braces, because the failure
// mode here is a silent lie, not a crash.

export type PriceBasis = "sold" | "listed" | "guide";

export type PriceSourceId = "ebay" | "tcgplayer" | "cardmarket" | "pricecharting";

/** What each source's numbers actually measure. The map is the doctrine. */
export const SOURCE_BASIS: Record<PriceSourceId, PriceBasis> = {
  ebay: "sold",
  tcgplayer: "listed",
  cardmarket: "sold",
  pricecharting: "guide",
};

export type SourcedPrice = {
  source: PriceSourceId;
  basis: PriceBasis;
  /** USD dollars. */
  amount: number;
  /** When the upstream last refreshed this figure. null = unknown (treat as stale). */
  lastUpdated: string | null;
};

/** A price that is provably a real completed sale. The only thing a sold-labeled
 *  surface may accept — the literal `basis: "sold"` makes a listed price a
 *  COMPILE error at that boundary, not a runtime surprise. */
export type SoldBasisPrice = SourcedPrice & { basis: "sold" };

/** A price that is an asking/market index. Renders only under LISTED_LABEL. */
export type ListedBasisPrice = SourcedPrice & { basis: "listed" };

/** The one canonical listed-basis label (ADR-110's register, now a primitive
 *  instead of prose duplicated per component). */
export const LISTED_LABEL = "TCGplayer listed (may lag)";

export function isSoldBasis(price: SourcedPrice): price is SoldBasisPrice {
  return price.basis === "sold";
}

export function isListedBasis(price: SourcedPrice): price is ListedBasisPrice {
  return price.basis === "listed";
}

/**
 * The HARD gate. Throws if a non-sold-basis price ever reaches a sold-labeled
 * surface. This is a programming error, not a data condition — a missing price
 * is `null` (honest), but a LISTED price wearing a SOLD label is a lie we
 * authored, and it must fail loudly rather than render.
 */
export function assertSoldBasis(price: SourcedPrice, surface: string): asserts price is SoldBasisPrice {
  if (price.basis !== "sold") {
    throw new Error(
      `[pricing] BASIS VIOLATION: ${surface} is a sold-labeled surface but received a "${price.basis}"-basis price ` +
        `from ${price.source}. A non-sold figure may never render as a sold number (ADR-118).`,
    );
  }
}

/** Does the source's declared basis match the basis on the quote? Guards against
 *  a hand-constructed quote mislabeling itself (e.g. tcgplayer tagged "sold"). */
export function basisMatchesSource(price: SourcedPrice): boolean {
  return SOURCE_BASIS[price.source] === price.basis;
}
