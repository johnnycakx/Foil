// Cards typeahead — proxies the Pokemon TCG SDK card search for the /start
// onboarding form (Task #20 / Session 38).
//
// Why a proxy: keeping the SDK call server-side means (a) the API base URL
// + headers are controlled, (b) we get Next's revalidate caching for free,
// (c) we can shape the response to exactly the {id, name, setName, ...}
// hits the form needs without leaking the SDK's full schema. Public route;
// rate-limit at the platform level (Fluid Compute) — no auth surface.
//
// Response shape: { hits: CardSearchHit[] } — same struct exported from
// lib/cards/sdk.ts so the client can import the type directly.

import { NextResponse } from "next/server";
import { searchCards, getCardMetadata, type CardSearchHit } from "@/lib/cards/sdk";
import { resolveAlias } from "@/lib/cards/search-aliases";
import { searchLocalCatalog, suggestNearMisses } from "@/lib/cards/local-search";
import { CARD_CATALOG } from "@/lib/cards/catalog";

// id → Foil slug for hit annotation (item 5: the pocket brain hydrates its
// live listing by slug). Built once per warm instance.
const SLUG_BY_ID = new Map(CARD_CATALOG.map((e) => [e.pokemonTcgId, e.slug]));

function withSlug(h: CardSearchHit): CardSearchHit {
  const slug = SLUG_BY_ID.get(h.id);
  return slug ? { ...h, slug } : h;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_QUERY_LENGTH = 64;
const RESULT_LIMIT = 8;
// Upstream is a SUPPLEMENT under a hard budget (P0-4: perceived latency
// <600ms; local answers are instant, upstream only adds not-yet-tracked
// printings). When it can't answer in time we ship without it.
const UPSTREAM_BUDGET_MS = 1_200;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q || q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ hits: [] });
  }

  // Community-nickname aliases FIRST (P0-1): "moonbreon" must resolve to the
  // exact printing the homepage teaches. Alias hits come from the baked
  // snapshot (baked-first metadata getter) — no upstream round-trip, so the
  // taught queries are also the fastest ones.
  const aliasIds = resolveAlias(q);
  if (aliasIds) {
    const metas = await Promise.all(aliasIds.map((id) => getCardMetadata({ id })));
    const hits: CardSearchHit[] = metas
      .filter((m) => m && m.name)
      .map((m) =>
        withSlug({
          id: m.id,
          name: m.name,
          setName: m.setName,
          setId: m.setId,
          number: m.number,
          image: m.image,
        }),
      );
    if (hits.length > 0) return NextResponse.json({ hits });
    // Fall through to the name search if metadata resolution failed — a
    // broken alias must degrade to normal search, never to a dead end.
  }

  // Local-first (P0-4): everything PICKABLE is in the baked catalog, so the
  // snapshot scan answers instantly — including every recent-set card the
  // daily bake adds. Upstream supplements with printings we don't track yet
  // (they render as "Not yet tracked" and feed the request loop).
  const local = searchLocalCatalog(q, RESULT_LIMIT);
  const upstream = await withTimeout(
    searchCards({ query: q, limit: RESULT_LIMIT }).catch(() => [] as CardSearchHit[]),
    UPSTREAM_BUDGET_MS,
    [] as CardSearchHit[],
  );
  const seen = new Set(local.map((h) => h.id));
  const hits = [...local, ...upstream.filter((h) => !seen.has(h.id))]
    .slice(0, RESULT_LIMIT)
    .map(withSlug);

  // Converting fail state (P0-4): a true miss ships near-miss corrections so
  // the UI can offer "did you mean" instead of a dead end.
  const suggestions = hits.length === 0 ? suggestNearMisses(q).map(withSlug) : [];
  return NextResponse.json({ hits, suggestions });
}
