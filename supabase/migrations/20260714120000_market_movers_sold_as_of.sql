-- market_movers.sold_as_of — WHEN the cached sold averages are actually true of.
--
-- Audit 2026-07-14 (comp-age honesty). The alert email's evidence line reads
-- "Usually sells for $92.00 (Near Mint, last 30 days)" — an explicit temporal
-- claim — and the only date this table carried was `computed_at`: the moment WE
-- refreshed the cache row, not the moment the market last traded the card.
-- Those two numbers diverge badly: a nightly cron makes `computed_at` always
-- look ~1 day old even when the underlying PokeTrace tier's most recent sale is
-- five weeks stale. Rendering `computed_at` as the comp's date would have moved
-- the lie rather than fixed it.
--
-- `sold_as_of` is the NEAR_MINT tier's `lastUpdated` (its most recent recorded
-- sale), carried verbatim from PokeTrace through classifyMomentum. It is the
-- date the alert may cite. Nullable because rows written before this migration
-- have no such date — and a NULL age means the evidence line must DISCLOSE the
-- absence, never silently imply freshness (null-over-guess, on the time axis).
--
-- Backfill is deliberately NOT attempted: we cannot reconstruct a past sale date
-- we never stored, and inventing one is precisely the failure this closes. The
-- market-movers cron (09:00 UTC daily) repopulates every row within 24h.

alter table market_movers
  add column if not exists sold_as_of timestamptz;

comment on column market_movers.sold_as_of is
  'Most recent recorded NM sale behind avg7d/avg30d (PokeTrace lastUpdated). NOT computed_at, which is our cache time. NULL = unknown age; surfaces must disclose, not imply freshness.';
