// Local catalog search — the instant path (quality-bar-fixes P0-4).
//
// The audit clocked "umbreon vmax" at 4+ seconds of "Searching…" because
// every keystroke's answer waited on api.pokemontcg.io. But every card a
// user can actually PICK is in CARD_CATALOG with baked metadata — searching
// the snapshot is a sub-millisecond in-memory scan. The route now answers
// local-first and treats upstream as a time-boxed supplement (it only adds
// "Not yet tracked" rows, which feed the request-tracking loop).
//
// Also owns the near-miss suggester: when a query misses entirely, cheap
// token-level edit-distance-1 over the baked name vocabulary ("gyrados" →
// "gyarados") so the fail state can offer a correction instead of a dead end.

import { CARD_CATALOG } from "./catalog.ts";
import { getBakedCardMetadata, type CardSearchHit } from "./sdk.ts";

type IndexEntry = {
  id: string;
  nameLower: string;
  setNameLower: string;
  hit: CardSearchHit;
};

let INDEX: IndexEntry[] | null = null;

/** Build once per process from the baked snapshot; catalog-order stable. */
function index(): IndexEntry[] {
  if (INDEX) return INDEX;
  const out: IndexEntry[] = [];
  for (const entry of CARD_CATALOG) {
    const m = getBakedCardMetadata(entry.pokemonTcgId);
    if (!m || !m.name) continue;
    out.push({
      id: m.id,
      nameLower: m.name.toLowerCase(),
      setNameLower: (m.setName ?? "").toLowerCase(),
      hit: {
        id: m.id,
        name: m.name,
        setName: m.setName,
        setId: m.setId,
        number: m.number,
        image: m.image,
      },
    });
  }
  INDEX = out;
  return out;
}

/** For tests: drop the memo (the snapshot can change under a re-bake). */
export function resetLocalSearchIndex(): void {
  INDEX = null;
}

function normalize(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Instant search over the baked catalog. Word-prefix match on the card name,
 * with set-name tokens honored as extra filters ("charizard base" narrows to
 * Base-set Charizards). Newest sets first on ties — the audit's mandate is
 * that new cards are what people search for.
 */
export function searchLocalCatalog(rawQuery: string, limit = 8): CardSearchHit[] {
  const q = normalize(rawQuery);
  if (q.length < 2) return [];
  const tokens = q.split(" ").filter(Boolean);
  const scored: Array<{ score: number; e: IndexEntry }> = [];
  for (const e of index()) {
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      if (e.nameLower.startsWith(t)) score += 3;
      else if (e.nameLower.includes(` ${t}`)) score += 2;
      else if (e.nameLower.includes(t)) score += 1;
      else if (e.setNameLower.includes(t)) score += 1;
      else { ok = false; break; }
    }
    if (ok) scored.push({ score, e });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.e.hit);
}

/** Levenshtein distance capped at 2 (early-exit) — tiny inputs only. */
function dist2(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
      if (prev[j] < rowMin) rowMin = prev[j];
    }
    if (rowMin > 2) return 3;
  }
  return prev[b.length];
}

/**
 * Near-miss suggestions for a query that returned nothing: the closest card
 * names by per-token edit distance ("gyrados" → Gyarados cards). Returns []
 * when nothing is convincingly close (distance ≤2 on the longest token).
 */
export function suggestNearMisses(rawQuery: string, limit = 3): CardSearchHit[] {
  const q = normalize(rawQuery);
  const tokens = q.split(" ").filter((t) => t.length >= 4);
  if (tokens.length === 0) return [];
  const probe = tokens.sort((a, b) => b.length - a.length)[0];
  const seenNames = new Set<string>();
  const out: Array<{ d: number; e: IndexEntry }> = [];
  for (const e of index()) {
    for (const word of e.nameLower.split(/[^a-z0-9]+/)) {
      if (word.length < 4) continue;
      const d = dist2(probe, word);
      if (d > 0 && d <= 2 && !seenNames.has(e.nameLower)) {
        seenNames.add(e.nameLower);
        out.push({ d, e });
        break;
      }
    }
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, limit).map((s) => s.e.hit);
}
