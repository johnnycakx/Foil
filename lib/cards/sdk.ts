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

// Repo-committed snapshot of upstream catalog metadata. Falls back to this
// when api.pokemontcg.io fails after all retries — eliminates SSG build
// flake from upstream outages (Session 40 amendment). Refresh via
// `npm run bake:cards` when upstream is healthy.
//
// Loaded via readFileSync + JSON.parse rather than ESM JSON-import so the
// loader path works under `node --experimental-strip-types` (which the
// test runner uses) without needing import attributes. The JSON's shape
// is pinned by `scripts/bake-card-metadata.ts::BakedSnapshot`.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PoketraceVariant } from "../poketrace/variant.ts";

type BakedSnapshot = {
  bakedAt: string;
  cards: Record<string, CardMetadata>;
  sets: Record<string, SetMetadata>;
};

function loadBakedSnapshot(): BakedSnapshot {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const path = join(here, "baked-metadata.json");
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<BakedSnapshot> & {
      cards?: Record<string, Partial<CardMetadata>>;
    };
    const normalizedCards: Record<string, CardMetadata> = {};
    for (const [id, c] of Object.entries(parsed.cards ?? {})) {
      // Normalize older snapshot entries (pre-Session-41) that lack the
      // reference-data fields. New fields default to empty so component
      // null-checks treat them as "no data" rather than crashing.
      normalizedCards[id] = {
        id: typeof c.id === "string" ? c.id : id,
        name: typeof c.name === "string" ? c.name : id,
        setName: typeof c.setName === "string" ? c.setName : "",
        setId: typeof c.setId === "string" ? c.setId : "",
        series: typeof c.series === "string" ? c.series : "",
        number: typeof c.number === "string" ? c.number : "",
        image: typeof c.image === "string" ? c.image : "",
        rarity: c.rarity ?? null,
        releaseDate: c.releaseDate ?? null,
        types: Array.isArray(c.types) ? c.types : [],
        subtypes: Array.isArray(c.subtypes) ? c.subtypes : [],
        hp: c.hp ?? null,
        artist: c.artist ?? null,
        attacks: Array.isArray(c.attacks) ? c.attacks : [],
        weaknesses: Array.isArray(c.weaknesses) ? c.weaknesses : [],
        tcgplayerPrices: c.tcgplayerPrices && typeof c.tcgplayerPrices === "object" ? c.tcgplayerPrices : {},
        tcgplayerUpdatedAt: typeof c.tcgplayerUpdatedAt === "string" ? c.tcgplayerUpdatedAt : "",
        // Session 49 / ADR-042: baked PokeTrace per-variant UUIDs. Default
        // [] for pre-Session-49 snapshot entries so component null-checks
        // treat them as "no sold-history data".
        variants: Array.isArray(c.variants) ? (c.variants as PoketraceVariant[]) : [],
      };
    }
    return {
      bakedAt: parsed.bakedAt ?? "",
      cards: normalizedCards,
      sets: parsed.sets ?? {},
    };
  } catch {
    // Missing or unparseable snapshot is non-fatal — SDK degrades to its
    // pre-bake behavior (soft-fail to minimal record on upstream failure).
    return { bakedAt: "", cards: {}, sets: {} };
  }
}

const BAKED: BakedSnapshot = loadBakedSnapshot();

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

/** Per-variant TCGplayer price snapshot. Keys are upstream variant slugs
 *  ("normal", "holofoil", "reverseHolofoil", "1stEditionHolofoil", etc.). */
export type TcgPlayerVariantPrice = {
  low: number | null;
  mid: number | null;
  high: number | null;
  market: number | null;
  directLow: number | null;
};

export type CardAttack = {
  name: string;
  /** Free-form printed damage (often a number string, sometimes "20+", "×", etc.). */
  damage: string | null;
  /** Energy-cost icons (e.g. ["Fire","Fire","Colorless"]). */
  cost: string[];
  text: string | null;
};

export type CardWeakness = {
  /** Type name (e.g. "Water"). */
  type: string;
  /** Multiplier as printed (e.g. "×2"). */
  value: string;
};

export type CardMetadata = {
  id: string;
  /** Display name, e.g. "Charizard". */
  name: string;
  /** Set display name, e.g. "Base". */
  setName: string;
  /** Set id, e.g. "base1". */
  setId: string;
  /** Set series / era, e.g. "Base", "Scarlet & Violet". Empty when missing. */
  series: string;
  /** Collector number as printed, e.g. "4" or "199". */
  number: string;
  /** Card art URL (large preferred, small fallback). */
  image: string;
  /** Optional — null when the API doesn't expose it. */
  rarity: string | null;
  /** Optional — set release date as ISO-ish string, e.g. "1999/01/09". */
  releaseDate: string | null;
  /** Energy types, e.g. ["Fire"]. Empty array when missing. */
  types: string[];
  /** Subtypes, e.g. ["Stage 2"], ["VMAX"], ["EX"]. Empty array when missing. */
  subtypes: string[];
  /** HP as printed, e.g. "120". Null for Trainer / Energy cards. */
  hp: string | null;
  /** Card art credit, e.g. "Mitsuhiro Arita". Null when missing. */
  artist: string | null;
  /** Attacks (Session 41 / ADR-030 — reference-data layer). */
  attacks: CardAttack[];
  /** Weaknesses (Session 41 / ADR-030). */
  weaknesses: CardWeakness[];
  /** TCGplayer price snapshot per variant, keyed by variant slug
   *  ("normal"/"holofoil"/"reverseHolofoil"/etc). Empty record when
   *  upstream doesn't expose tcgplayer.prices for this card. */
  tcgplayerPrices: Record<string, TcgPlayerVariantPrice>;
  /** ISO date when tcgplayerPrices was last refreshed upstream (e.g.
   *  "2026/05/26"). Empty when missing. */
  tcgplayerUpdatedAt: string;
  /** Baked PokeTrace per-variant UUIDs (Session 49 / ADR-042). One entry per
   *  print edition/finish PokeTrace knows about (Holofoil, Shadowless, etc.).
   *  Optional on the type so older CardMetadata literals (tests) stay valid;
   *  the baked-snapshot normalizer / live-attach path always populate it, and
   *  consumers should treat `undefined` as `[]`. */
  variants?: PoketraceVariant[];
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

  // Production callers (no custom fetchImpl) get the baked-snapshot
  // fallback layer; test callers (with stubbed fetchImpl) get the original
  // soft-fail-to-minimal-record path so their assertions about failure
  // modes still hold. See `lib/cards/baked-metadata.json`.
  const usingDefaultFetch = !input.fetchImpl;
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
    if (usingDefaultFetch && BAKED.cards[id]) return BAKED.cards[id];
    return minimalRecord(id);
  }

  let body: { data?: RawCard } | null;
  try {
    body = (await response.json()) as { data?: RawCard };
  } catch {
    if (usingDefaultFetch && BAKED.cards[id]) return BAKED.cards[id];
    return minimalRecord(id);
  }

  const raw = body?.data;
  if (!raw) {
    if (usingDefaultFetch && BAKED.cards[id]) return BAKED.cards[id];
    return minimalRecord(id);
  }
  const parsed = parseCard(raw, id);
  // PokeTrace variants are a baked-only field (live pokemontcg.io doesn't
  // carry them), so attach from the baked snapshot on the default path.
  if (usingDefaultFetch) parsed.variants = BAKED.cards[id]?.variants ?? [];
  return parsed;
}

type RawCard = {
  id?: string;
  name?: string;
  number?: string;
  rarity?: string | null;
  hp?: string | null;
  types?: string[];
  subtypes?: string[];
  artist?: string | null;
  set?: {
    id?: string;
    name?: string;
    series?: string;
    releaseDate?: string | null;
  };
  images?: {
    small?: string;
    large?: string;
  };
  attacks?: Array<{
    name?: string;
    damage?: string | null;
    cost?: string[];
    text?: string | null;
  }>;
  weaknesses?: Array<{
    type?: string;
    value?: string;
  }>;
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<
      string,
      {
        low?: number | null;
        mid?: number | null;
        high?: number | null;
        market?: number | null;
        directLow?: number | null;
      }
    >;
  };
};

function parseCard(raw: RawCard, requestedId: string): CardMetadata {
  const id = (typeof raw.id === "string" && raw.id) || requestedId;
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : derivedNameFromId(id);
  const setName = typeof raw.set?.name === "string" ? raw.set.name : derivedSetIdFromId(id);
  const setId = typeof raw.set?.id === "string" ? raw.set.id : derivedSetIdFromId(id);
  const series = typeof raw.set?.series === "string" ? raw.set.series : "";
  const number = typeof raw.number === "string" ? raw.number : derivedNumberFromId(id);
  const image = (typeof raw.images?.large === "string" && raw.images.large)
    || (typeof raw.images?.small === "string" && raw.images.small)
    || "";
  const attacks: CardAttack[] = [];
  if (Array.isArray(raw.attacks)) {
    for (const a of raw.attacks) {
      if (!a || typeof a.name !== "string") continue;
      const cost = Array.isArray(a.cost)
        ? a.cost.filter((cv): cv is string => typeof cv === "string")
        : [];
      attacks.push({
        name: a.name,
        damage: typeof a.damage === "string" && a.damage.length ? a.damage : null,
        cost,
        text: typeof a.text === "string" && a.text.length ? a.text : null,
      });
    }
  }
  const weaknesses: CardWeakness[] = [];
  if (Array.isArray(raw.weaknesses)) {
    for (const w of raw.weaknesses) {
      if (!w || typeof w.type !== "string" || typeof w.value !== "string") continue;
      weaknesses.push({ type: w.type, value: w.value });
    }
  }
  const tcgplayerPrices: Record<string, TcgPlayerVariantPrice> = {};
  const rawPrices = raw.tcgplayer?.prices;
  if (rawPrices && typeof rawPrices === "object") {
    for (const [variant, p] of Object.entries(rawPrices)) {
      if (!p || typeof p !== "object") continue;
      tcgplayerPrices[variant] = {
        low: typeof p.low === "number" ? p.low : null,
        mid: typeof p.mid === "number" ? p.mid : null,
        high: typeof p.high === "number" ? p.high : null,
        market: typeof p.market === "number" ? p.market : null,
        directLow: typeof p.directLow === "number" ? p.directLow : null,
      };
    }
  }
  return {
    id,
    name,
    setName,
    setId,
    series,
    number,
    image,
    rarity: typeof raw.rarity === "string" ? raw.rarity : null,
    releaseDate: typeof raw.set?.releaseDate === "string" ? raw.set.releaseDate : null,
    types: Array.isArray(raw.types) ? raw.types.filter((t): t is string => typeof t === "string") : [],
    subtypes: Array.isArray(raw.subtypes) ? raw.subtypes.filter((s): s is string => typeof s === "string") : [],
    hp: typeof raw.hp === "string" && raw.hp.length ? raw.hp : null,
    artist: typeof raw.artist === "string" && raw.artist.length ? raw.artist : null,
    attacks,
    weaknesses,
    tcgplayerPrices,
    tcgplayerUpdatedAt: typeof raw.tcgplayer?.updatedAt === "string" ? raw.tcgplayer.updatedAt : "",
    // Live pokemontcg.io has no PokeTrace data; getCardMetadata attaches the
    // baked variants from BAKED on the default-fetch path.
    variants: [],
  };
}

function minimalRecord(id: string): CardMetadata {
  return {
    id,
    name: derivedNameFromId(id),
    setName: derivedSetIdFromId(id),
    setId: derivedSetIdFromId(id),
    series: "",
    number: derivedNumberFromId(id),
    image: "",
    rarity: null,
    releaseDate: null,
    types: [],
    subtypes: [],
    hp: null,
    artist: null,
    attacks: [],
    weaknesses: [],
    tcgplayerPrices: {},
    tcgplayerUpdatedAt: "",
    variants: [],
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

  const usingDefaultFetch = !input.fetchImpl;
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
  if (!response || !response.ok) {
    if (usingDefaultFetch && BAKED.sets[id]) return BAKED.sets[id];
    return minimalSetRecord(id);
  }
  let body: { data?: RawSet } | null;
  try {
    body = (await response.json()) as { data?: RawSet };
  } catch {
    if (usingDefaultFetch && BAKED.sets[id]) return BAKED.sets[id];
    return minimalSetRecord(id);
  }
  const raw = body?.data;
  if (!raw) {
    if (usingDefaultFetch && BAKED.sets[id]) return BAKED.sets[id];
    return minimalSetRecord(id);
  }
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
  const usingDefaultFetch = !opts.fetchImpl;
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
  if (!response || !response.ok) {
    if (usingDefaultFetch) return Object.values(BAKED.sets);
    return [];
  }

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
