-- PriceCharting product-ID cache. Once we resolve a PokeTrace card to a
-- PriceCharting product, we don't want to re-search PriceCharting on every
-- subsequent scan of the same card. This table is server-side cache only;
-- clients never read or write it (the service role bypasses RLS for writes).
CREATE TABLE IF NOT EXISTS public.pricecharting_id_map (
  poketrace_id TEXT PRIMARY KEY,
  pricecharting_id TEXT NOT NULL,
  pricecharting_name TEXT NOT NULL,
  console_name TEXT NOT NULL,
  last_synced TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS on, but no policies — only the service role (which bypasses RLS) is
-- allowed to read or write. Anon + authenticated clients are locked out.
ALTER TABLE public.pricecharting_id_map ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS pricecharting_id_map_last_synced_idx
  ON public.pricecharting_id_map (last_synced);
