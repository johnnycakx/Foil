// Real card-art fetch for the X images (ADR-072 follow-up — the card-hero).
//
// The card-hero + the board thumbnails use the card's hi-res art, which the
// market_movers / buy_signals rows already carry as `image_url` (a cached
// PokeTrace/SDK image). This is a thin, SOFT-FAILING fetch: a missing or broken
// art URL returns null so the caller drops the card-hero to the board/
// educational fallback rather than shipping an artless hero. R-008-safe (the
// art is catalog metadata, not eBay listing data).

/** Fetch the card art as a Buffer. Null on a missing/non-http/failed/empty URL. */
export async function fetchCardArtBuffer(
  url: string | null | undefined,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<Buffer | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const fetchFn = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchFn(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  }
}
