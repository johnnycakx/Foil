-- Market-movers / "good buys" signal (ADR-069). The insight-led core that
-- replaces fragile single-listing deals as the LEAD signal across the
-- newsletter, the /deals board, and (later) X.
--
-- Two tables, two jobs:
--
--   1. market_movers — CURRENT-STATE cache (UPSERT per card_slug, like
--      buy_signals). A row says: "as of computed_at, NEAR_MINT <card_slug> is
--      trading <direction> its 30-day average by momentum_pct% (avg7d vs avg30d
--      over sale_count sales)." The /deals board + newsletter read this.
--
--   2. market_snapshots — APPEND-ONLY daily time-series seed (one row per card
--      per day). Near-zero extra cost today; it's what makes week-over-week
--      "cards on the move" computable later without re-querying PokeTrace history.
--
-- DATA PROVENANCE (the honesty constraint): every numeric field here is a real
-- PokeTrace sold AGGREGATE (avg7d / avg30d / saleCount) for the NEAR_MINT raw
-- tier. NOTHING here is eBay listing data — momentum is computed entirely from
-- PokeTrace's windowed averages, never from a live listing (so R-008 simply does
-- not apply: there is no eBay payload to re-distribute). The eBay-derived
-- single-listing board stays in buy_signals, demoted to a secondary surface.

create table if not exists market_movers (
  card_slug       text primary key,
  -- Pokemon TCG SDK catalog display fields (non-eBay).
  card_name       text not null default '',
  set_name        text not null default '',
  image_url       text not null default '',
  -- Foil-derived classification over PokeTrace aggregates.
  direction       text not null check (direction in ('down','up','flat')),
  momentum_pct    numeric not null,
  -- The PokeTrace (non-eBay) NEAR_MINT windowed averages the momentum is from.
  avg7d           numeric,
  avg30d          numeric,
  sale_count      integer not null default 0,
  matched_tier    text not null default 'NEAR_MINT',
  computed_at     timestamptz not null default now()
);

-- The board's read shape: "the down movers, most-below first" (and up movers).
create index if not exists market_movers_dir_momentum_idx
  on market_movers (direction, momentum_pct);

create table if not exists market_snapshots (
  id            bigint generated always as identity primary key,
  card_slug     text not null,
  snapshot_date date not null,
  avg7d         numeric,
  avg30d        numeric,
  sale_count    integer not null default 0,
  matched_tier  text not null default 'NEAR_MINT',
  source        text not null default 'poketrace',
  created_at    timestamptz not null default now(),
  -- One row per card per day; a same-day re-run updates, never duplicates.
  unique (card_slug, snapshot_date)
);

create index if not exists market_snapshots_card_date_idx
  on market_snapshots (card_slug, snapshot_date);

-- RLS: service-role only — the refresh cron writes via the service-role client
-- (lib/supabase/admin.ts); the /deals page reads via the same server-side
-- client. No anon access — consistent with buy_signals + watchlists.
alter table market_movers enable row level security;
alter table market_snapshots enable row level security;

drop policy if exists market_movers_service_all on market_movers;
create policy market_movers_service_all
  on market_movers
  for all
  to service_role
  using (true) with check (true);

drop policy if exists market_snapshots_service_all on market_snapshots;
create policy market_snapshots_service_all
  on market_snapshots
  for all
  to service_role
  using (true) with check (true);
