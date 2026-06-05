-- Buy-signal leaderboard cache (ROADMAP B.4 / ADR-054).
--
-- Cron-precomputed DERIVED metadata that powers the public /deals leaderboard
-- ("Today's best deals"). A row says: "as of computed_at, the best live eBay
-- ask for card_slug was classified <signal> versus the same-condition 30-day
-- PokeTrace sold average, a delta of delta_pct%."
--
-- R-008 COMPLIANCE (the load-bearing constraint — see docs/EBAY-COMPLIANCE.md
-- row #13 + ADR-054). This table stores ONLY:
--   1. Foil-DERIVED analytics — `signal`, `delta_pct`. These are Foil's
--      computed classification, not eBay content.
--   2. PokeTrace (NON-eBay) sold data — `sold_reference`, `sold_sample_size`,
--      `matched_tier`.
--   3. Pokemon TCG SDK catalog fields — `card_name`, `set_name`, `image_url`.
--      (Same catalog data we already cache as card images in Storage.)
-- The live eBay ASK used to compute delta_pct is fetched render-time by the
-- refresh cron and DISCARDED. NO eBay listing field is ever persisted here:
-- no item id, no listing title, no seller, no listing image, no listing URL,
-- and no raw ask-price column. The board links out to a LIVE eBay search on
-- click (affiliate-tracked), so nothing in this table is an eBay listing
-- payload or a re-distribution vector. Refreshed daily (computed_at), never a
-- durable listing store.

create table if not exists buy_signals (
  card_slug         text primary key,
  -- Pokemon TCG SDK catalog display fields (non-eBay).
  card_name         text not null default '',
  set_name          text not null default '',
  image_url         text not null default '',
  -- Foil-derived classification.
  signal            text not null check (signal in ('BELOW','AT','ABOVE','UNKNOWN')),
  delta_pct         numeric,
  -- PokeTrace (non-eBay) sold reference the ask was compared against.
  sold_reference    numeric,
  sold_sample_size  integer not null default 0,
  matched_tier      text,
  computed_at       timestamptz not null default now()
);

-- The board's read shape: "the BELOW rows, most-below first."
create index if not exists buy_signals_signal_delta_idx
  on buy_signals (signal, delta_pct);

-- RLS: service-role only. The refresh cron writes via the service-role client
-- (lib/supabase/admin.ts); the /deals page reads via the same server-side
-- client. No anon access — consistent with watchlists + browse_calls.
alter table buy_signals enable row level security;

drop policy if exists buy_signals_service_all on buy_signals;
create policy buy_signals_service_all
  on buy_signals
  for all
  to service_role
  using (true) with check (true);
