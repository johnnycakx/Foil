// Pokemon TCG SDK client (pokemontcg.io v2).
//
// Wraps the public API at https://api.pokemontcg.io/v2/cards/{id} for card
// metadata — name, set, image, rarity, collector number. Used at render time
// by /cards/[slug] to populate the page header + the editorial copy below
// the fold.
//
// Compliance: this is Pokemon TCG catalog data, NOT eBay listing data — it
// can be cached freely. We use Next's `next: { revalidate: 86400 }` (24h
// TTL) because the underlying data rarely changes (release date, image,
// rarity all stable per card). EPN calls remain `cache: "no-store"` per
// ADR-021 / R-008; nothing about this file relaxes that constraint.
//
// Soft-fail: a 404 / 500 / network drop returns a `minimal` record built
// from the requested id alone. The page degrades gracefully — the title
// reads "<id> on eBay" rather than 500-ing.

const POKEMON_TCG_API_BASE = "https://api.pokemontcg.io/v2/cards";
const CACHE_TTL_SECONDS = 86_400; // 24h — metadata is stable, no need to refetch hot.

export type CardMetadata = {
  id: string;
  /** Display name, e.g. "Charizard". */
  name: string;
  /** Set display name, e.g. "Base". */
  setName: string;
  /** Set id, e.g. "base1". */
  setId: string;
  /** Collector number as printed, e.g. "4" or "199". */
  number: string;
  /** Card art URL (large preferred, small fallback). */
  image: string;
  /** Optional — null when the API doesn't expose it. */
  rarity: string | null;
  /** Optional — set release date as ISO-ish string, e.g. "1999/01/09". */
  releaseDate: string | null;
  /** True when the record was built from the soft-fail fallback path. */
  fallback?: true;
};

export type GetCardMetadataInput = {
  /** Pokemon TCG SDK id, e.g. "base1-4". */
  id: string;
  /** Test injection. */
  fetchImpl?: typeof fetch;
};

/**
 * Fetch metadata for a single card by SDK id. Returns a minimal fallback
 * record on any failure — never throws into the Server Component render.
 */
export async function getCardMetadata(input: GetCardMetadataInput): Promise<CardMetadata> {
  const { id } = input;
  if (!id) return minimalRecord("");

  const fetchFn = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchFn(`${POKEMON_TCG_API_BASE}/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      // Next.js: cache for 24h. Catalog metadata is not listing data — caching
      // it is fine and reduces API hits during SSG builds.
      next: { revalidate: CACHE_TTL_SECONDS },
    } as RequestInit);
  } catch {
    return minimalRecord(id);
  }

  if (!response.ok) {
    return minimalRecord(id);
  }

  let body: { data?: RawCard } | null;
  try {
    body = (await response.json()) as { data?: RawCard };
  } catch {
    return minimalRecord(id);
  }

  const raw = body?.data;
  if (!raw) return minimalRecord(id);
  return parseCard(raw, id);
}

type RawCard = {
  id?: string;
  name?: string;
  number?: string;
  rarity?: string | null;
  set?: {
    id?: string;
    name?: string;
    releaseDate?: string | null;
  };
  images?: {
    small?: string;
    large?: string;
  };
};

function parseCard(raw: RawCard, requestedId: string): CardMetadata {
  const id = (typeof raw.id === "string" && raw.id) || requestedId;
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : derivedNameFromId(id);
  const setName = typeof raw.set?.name === "string" ? raw.set.name : derivedSetIdFromId(id);
  const setId = typeof raw.set?.id === "string" ? raw.set.id : derivedSetIdFromId(id);
  const number = typeof raw.number === "string" ? raw.number : derivedNumberFromId(id);
  const image = (typeof raw.images?.large === "string" && raw.images.large)
    || (typeof raw.images?.small === "string" && raw.images.small)
    || "";
  return {
    id,
    name,
    setName,
    setId,
    number,
    image,
    rarity: typeof raw.rarity === "string" ? raw.rarity : null,
    releaseDate: typeof raw.set?.releaseDate === "string" ? raw.set.releaseDate : null,
  };
}

function minimalRecord(id: string): CardMetadata {
  return {
    id,
    name: derivedNameFromId(id),
    setName: derivedSetIdFromId(id),
    setId: derivedSetIdFromId(id),
    number: derivedNumberFromId(id),
    image: "",
    rarity: null,
    releaseDate: null,
    fallback: true,
  };
}

function derivedSetIdFromId(id: string): string {
  const idx = id.indexOf("-");
  return idx > 0 ? id.slice(0, idx) : id;
}

function derivedNumberFromId(id: string): string {
  const idx = id.indexOf("-");
  return idx > 0 ? id.slice(idx + 1) : "";
}

function derivedNameFromId(id: string): string {
  return id || "Pokemon card";
}
