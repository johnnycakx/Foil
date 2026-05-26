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

// Session 40 / Task #23: pokemontcg.io issues both transient 504s AND
// transient 404s under load (verified by repeated probes — a card that
// exists may 404 for one request and 200 for the next, with no pattern).
// Retry on 5xx + network errors always; retry on 4xx only when the caller
// is doing an ID-based lookup against an ID we control (catalog entries
// are known-valid, so a 4xx response means upstream is flaky, not that
// the card is missing).
//
// Tries: 200ms, 600ms, 1800ms — 1 initial + 3 retries = 4 attempts,
// ~2.6s total budget. Well under the per-page SSG timeout (300s) and
// imperceptible at /api/cards/search runtime cost.
const RETRY_DELAYS_MS = [200, 600, 1800];

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

type FetchRetryOptions = {
  /** Treat 4xx as a transient failure and retry. Default false. Opt in
   *  for ID-based lookups against catalog-controlled IDs (a 4xx means
   *  upstream is flaky, not that the resource is missing). */
  retryOn4xx?: boolean;
};

/**
 * Wrapper around fetch that retries on 5xx + network errors (always)
 * and 4xx (when `retryOn4xx` is set) with a backoff schedule. Caller-
 * supplied `fetchImpl` lets tests inject stubs. Returns the final
 * Response or null if every attempt threw.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch = fetch,
  options: FetchRetryOptions = {},
): Promise<Response | null> {
  const { retryOn4xx = false } = options;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await fetchImpl(url, init);
      const isTransient =
        response.status >= 500 || (retryOn4xx && response.status >= 400 && response.status < 500);
      if (isTransient && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      return response;
    } catch (err) {
      // Network error / timeout. Retry if we have budget left.
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      void err;
      return null;
    }
  }
  return null;
}

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
  const response = await fetchWithRetry(
    `${POKEMON_TCG_API_BASE}/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      // Next.js: cache for 24h. Catalog metadata is not listing data — caching
      // it is fine and reduces API hits during SSG builds.
      next: { revalidate: CACHE_TTL_SECONDS },
    } as RequestInit,
    fetchFn,
    // Our card IDs come from CARD_CATALOG (server-controlled); a 4xx
    // from pokemontcg.io means upstream is flaky, not that the card
    // is missing. Retry on 4xx in addition to 5xx.
    { retryOn4xx: true },
  );

  if (!response || !response.ok) {
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

// --- Set-level metadata --------------------------------------------------

export type SetMetadata = {
  /** Pokemon TCG SDK set id, e.g. "base1". */
  id: string;
  /** Display name — e.g. "Base", "Crown Zenith". */
  name: string;
  /** Series / era — e.g. "Base", "Sword & Shield", "Scarlet & Violet". */
  series: string;
  /** Set release date as ISO-ish "YYYY/MM/DD", or null if absent. */
  releaseDate: string | null;
  /** Card count printed in the set. */
  total: number;
  /** Set-logo URL (preferred), or symbol URL as fallback. Empty when absent. */
  logoUrl: string;
};

export type GetSetMetadataInput = {
  id: string;
  fetchImpl?: typeof fetch;
};

const POKEMON_TCG_SETS_BASE = "https://api.pokemontcg.io/v2/sets";

/**
 * Fetch a single set's metadata. Soft-fails to a minimal record on any
 * failure, matching the card-level `getCardMetadata` shape.
 */
export async function getSetMetadata(input: GetSetMetadataInput): Promise<SetMetadata> {
  const { id } = input;
  if (!id) return minimalSetRecord("");

  const fetchFn = input.fetchImpl ?? fetch;
  const response = await fetchWithRetry(
    `${POKEMON_TCG_SETS_BASE}/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: CACHE_TTL_SECONDS },
    } as RequestInit,
    fetchFn,
    // Same reasoning as getCardMetadata — set IDs come from the
    // catalog, so a 4xx is upstream flake.
    { retryOn4xx: true },
  );
  if (!response || !response.ok) return minimalSetRecord(id);
  let body: { data?: RawSet } | null;
  try {
    body = (await response.json()) as { data?: RawSet };
  } catch {
    return minimalSetRecord(id);
  }
  const raw = body?.data;
  if (!raw) return minimalSetRecord(id);
  return parseSet(raw, id);
}

/**
 * Fetch every set the Pokemon TCG SDK knows about (~150 entries). Caller
 * typically filters to the subset of ids present in the catalog. 24h cache,
 * soft-fail to empty list on error.
 *
 * The SDK paginates at `pageSize=250`; one request covers the whole
 * universe today and well into the future (Pokémon prints ~6 sets per
 * year).
 */
export async function getAllSets(opts: { fetchImpl?: typeof fetch } = {}): Promise<SetMetadata[]> {
  const fetchFn = opts.fetchImpl ?? fetch;
  const response = await fetchWithRetry(
    `${POKEMON_TCG_SETS_BASE}?pageSize=250`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: CACHE_TTL_SECONDS },
    } as RequestInit,
    fetchFn,
  );
  if (!response || !response.ok) return [];

  let body: { data?: RawSet[] } | null;
  try {
    body = (await response.json()) as { data?: RawSet[] };
  } catch {
    return [];
  }
  if (!Array.isArray(body?.data)) return [];
  const out: SetMetadata[] = [];
  for (const raw of body.data) {
    if (!raw || typeof raw !== "object") continue;
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id) continue;
    out.push(parseSet(raw, id));
  }
  return out;
}

type RawSet = {
  id?: string;
  name?: string;
  series?: string;
  printedTotal?: number;
  total?: number;
  releaseDate?: string | null;
  images?: { symbol?: string; logo?: string };
};

function parseSet(raw: RawSet, requestedId: string): SetMetadata {
  const id = (typeof raw.id === "string" && raw.id) || requestedId;
  return {
    id,
    name: typeof raw.name === "string" ? raw.name : id,
    series: typeof raw.series === "string" ? raw.series : "",
    releaseDate: typeof raw.releaseDate === "string" ? raw.releaseDate : null,
    total: typeof raw.total === "number"
      ? raw.total
      : typeof raw.printedTotal === "number"
        ? raw.printedTotal
        : 0,
    logoUrl: (typeof raw.images?.logo === "string" && raw.images.logo)
      || (typeof raw.images?.symbol === "string" && raw.images.symbol)
      || "",
  };
}

function minimalSetRecord(id: string): SetMetadata {
  return {
    id,
    name: id || "Set",
    series: "",
    releaseDate: null,
    total: 0,
    logoUrl: id ? `https://images.pokemontcg.io/${id}/logo.png` : "",
  };
}

// ---------------------------------------------------------------------------
// Card-name search — for the /start onboarding page (Task #20 / Session 38).
// ---------------------------------------------------------------------------

export type CardSearchHit = {
  id: string;
  name: string;
  setName: string;
  setId: string;
  number: string;
  /** Small thumbnail URL — the search surface uses thumbnails, not hi-res. */
  image: string;
};

export type SearchCardsInput = {
  /** Partial / full card name. Empty → []. */
  query: string;
  /** Max results. Default 8. Hard ceiling 25 to keep the response light. */
  limit?: number;
  fetchImpl?: typeof fetch;
};

/**
 * Search the Pokemon TCG catalog by card name. Returns lightweight hits
 * (thumbnail-sized image, set context) for the /start multi-select form.
 *
 * Soft-fail: returns `[]` on any error path. The caller renders "no results"
 * uniformly regardless of network / API state.
 */
export async function searchCards(input: SearchCardsInput): Promise<CardSearchHit[]> {
  const q = input.query?.trim();
  if (!q) return [];
  const limit = Math.max(1, Math.min(input.limit ?? 8, 25));
  const fetchFn = input.fetchImpl ?? fetch;

  // The pokemontcg.io v2 query language: `name:value*` is a prefix match.
  // We escape the user input minimally — drop any character outside
  // [a-zA-Z0-9 -'.] which covers Pokémon names but neutralizes Lucene
  // operators (`:`, `(`, `)`, `"`, AND/OR, etc.) that would otherwise let
  // a malicious query short-circuit the name filter.
  const cleaned = q.replace(/[^a-zA-Z0-9 \-'.]/g, "").trim();
  if (!cleaned) return [];
  const queryStr = `name:${cleaned}*`;

  const url = `${POKEMON_TCG_API_BASE}?q=${encodeURIComponent(queryStr)}&pageSize=${limit}&orderBy=-set.releaseDate`;
  const response = await fetchWithRetry(
    url,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    } as RequestInit,
    fetchFn,
  );
  if (!response || !response.ok) return [];

  let body: { data?: RawCard[] } | null;
  try {
    body = (await response.json()) as { data?: RawCard[] };
  } catch {
    return [];
  }

  const raws = Array.isArray(body?.data) ? body.data : [];
  const hits: CardSearchHit[] = [];
  for (const raw of raws) {
    if (typeof raw.id !== "string" || !raw.id) continue;
    const setId = derivedSetIdFromId(raw.id);
    const num = typeof raw.number === "string" ? raw.number : derivedNumberFromId(raw.id);
    const image =
      (typeof raw.images?.small === "string" && raw.images.small) ||
      (typeof raw.images?.large === "string" && raw.images.large) ||
      `https://images.pokemontcg.io/${setId}/${num}.png`;
    hits.push({
      id: raw.id,
      name: typeof raw.name === "string" ? raw.name : derivedNameFromId(raw.id),
      setName: typeof raw.set?.name === "string" ? raw.set.name : setId,
      setId,
      number: num,
      image,
    });
  }
  return hits;
}
