-- Alert-engine event model (alert-engine-rebuild, ADR-091).
--
-- The old trigger was `price <= target` with only last_notified_at — a
-- below-target card re-alerted ~daily forever, each email claiming it "just
-- dropped." The event model needs per-row state:
--   last_seen_price_cents    — written on EVERY evaluation (baseline freshness)
--   last_alerted_price_cents — the price that fired the last alert
--   alert_state              — 'armed' (may fire) | 'fired' (waits for the
--                              hysteresis re-arm cross)
--
-- Blank target is REDEFINED: no sentinel. NULL target_price_cents means
-- "alert me at >=15% under the 30-day sold average." The old sentinel
-- (10,000,000 cents = "$100000.00" in email copy) is backfilled to NULL and
-- must never exist again.

alter table watchlists add column if not exists last_seen_price_cents integer;
alter table watchlists add column if not exists last_alerted_price_cents integer;
alter table watchlists add column if not exists alert_state text not null default 'armed'
  check (alert_state in ('armed', 'fired'));

-- Blank target: NULL instead of the sentinel.
alter table watchlists alter column target_price_cents drop not null;
alter table watchlists drop constraint if exists watchlists_target_price_cents_check;
alter table watchlists add constraint watchlists_target_price_cents_check
  check (target_price_cents is null or target_price_cents > 0);

-- Purge the sentinel from existing rows ("any drop" watches created by
-- /api/start pre-ADR-091).
update watchlists set target_price_cents = null where target_price_cents = 10000000;
