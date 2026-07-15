// Server-side data for the /start desk (start-binder-delight, 2026-07-12).
//
// TRUTH DENSITY is the rule: every card the binder offers is a REAL card, and
// every figure it shows is a REAL recent sold average with its sale count. No
// new pricing basis — this reads `market_movers`, the same daily-refreshed
// table /deals and the alert engine already trust (ADR-069).
//
// The booster pack deals "the most traded cards on record" — ranked by actual
// sale count, which is an honest popularity read, not a fabricated "hot" flag.
// Soft-fails to the committed sold snapshot so a DB outage degrades to fewer
// cards, never to a broken page or an invented number.

import { CARD_CATALOG } from "../cards/catalog.ts";
import { getBakedCardMetadata } from "../cards/sdk.ts";
import { getSnapshotSold } from "../vault-seeds.ts";
import type { BinderCard } from "./binder.ts";

/** How many cards the desk holds in reach (the pack hand + the fan pool). */
const DECK_SIZE = 24;

function slugToId(): Map<string, string> {
  return new Map(CARD_CATALOG.map((e) => [e.slug, e.pokemonTcgId]));
}

// The binder renders card art through the Next image optimizer (a pocket is
// ~104px on a phone; the raw pokemontcg.io PNG is ~800KB — cycle 2's Lighthouse
// run measured that one lazy demo image starving the LCP paragraph on a
// throttled mobile line). The optimizer hard-errors on hosts outside
// next.config.ts remotePatterns, so a card whose art lives anywhere else is
// not offerable — dropped here, server-side, per the soft-fail doctrine
// (fewer cards, never a broken page).
const OPTIMIZABLE_IMAGE_HOSTS = new Set([
  "images.pokemontcg.io",
  "images.poketrace.com",
  "cdn.poketrace.com",
  "images.scrydex.com",
]);

export function imageOptimizable(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (OPTIMIZABLE_IMAGE_HOSTS.has(u.hostname)) return true;
    const supa = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supa) return false;
    return (
      u.hostname === new URL(supa).hostname &&
      u.pathname.startsWith("/storage/v1/object/public/card-images/")
    );
  } catch {
    return false;
  }
}

/** The committed-snapshot deck. Always available (no network, no DB). */
function snapshotDeck(): BinderCard[] {
  const out: BinderCard[] = [];
  for (const entry of CARD_CATALOG) {
    const sold = getSnapshotSold(entry.slug);
    if (!sold) continue;
    const meta = getBakedCardMetadata(entry.pokemonTcgId);
    if (!meta?.image || !meta.name) continue;
    if (!imageOptimizable(meta.image)) continue;
    out.push({
      id: entry.pokemonTcgId,
      slug: entry.slug,
      name: meta.name,
      setName: meta.setName,
      setId: meta.setId,
      number: meta.number,
      image: meta.image,
      soldCents: sold.soldCents,
      saleCount: sold.saleCount,
      soldAsOf: sold.soldAsOf,
    });
  }
  return out.sort((a, b) => b.saleCount - a.saleCount);
}

/** The live deck: real cards actually trading, with their real sold reads. */
async function moversDeck(): Promise<BinderCard[]> {
  try {
    const { supabaseAdmin } = await import("../supabase/admin.ts");
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("market_movers")
      .select("card_slug, card_name, set_name, image_url, avg30d, sale_count, sold_as_of")
      .order("sale_count", { ascending: false })
      .limit(80);
    if (error || !data) return [];
    const ids = slugToId();
    const out: BinderCard[] = [];
    for (const row of data as Array<{
      card_slug: string;
      card_name: string | null;
      set_name: string | null;
      image_url: string | null;
      avg30d: number | null;
      sale_count: number | null;
      sold_as_of: string | null;
    }>) {
      const id = ids.get(row.card_slug);
      if (!id || !row.card_name || !row.image_url) continue;
      if (!imageOptimizable(row.image_url)) continue;
      // set_id + number are NOT in market_movers — take the card's identity
      // from the baked catalog metadata, which is the authority anyway. A card
      // without it cannot be posted to /api/start, so it must not be offered.
      const meta = getBakedCardMetadata(id);
      if (!meta?.setId || !meta.number) continue;
      const avg = typeof row.avg30d === "number" && row.avg30d > 0 ? row.avg30d : null;
      out.push({
        id,
        slug: row.card_slug,
        name: row.card_name,
        setName: row.set_name ?? meta.setName,
        setId: meta.setId,
        number: meta.number,
        image: row.image_url,
        soldCents: avg == null ? null : Math.round(avg * 100),
        saleCount: row.sale_count ?? 0,
        soldAsOf: row.sold_as_of ?? null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * The desk's deck. Live movers first (fresh + broad), topped up from the
 * committed snapshot so the binder always has real cards to offer.
 */
export async function getBinderDeck(): Promise<BinderCard[]> {
  const live = await moversDeck();
  const deck = [...live];
  const seen = new Set(deck.map((c) => c.id));
  for (const card of snapshotDeck()) {
    if (deck.length >= DECK_SIZE) break;
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    deck.push(card);
  }
  return deck.slice(0, DECK_SIZE);
}
