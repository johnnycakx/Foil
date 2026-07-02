-- Demand-driven PokeTrace hydration (demand-driven-data, ADR-092).
--
-- Foil can't afford deep sold data on every card — but a watch SERVICE needs
-- depth on the cards people actually track, not breadth. A new watch on a
-- card with no baked PokeTrace variants enqueues it here; the hourly worker
-- (/api/cron/hydrate-cards) resolves variants via the ONE shared resolution
-- path (lib/poketrace/hydrate-core.ts) and stores them on the row. The card
-- page + the movers cron merge these DB-hydrated variants under the baked
-- snapshot (baked wins; a later bake run folds hydrated cards in for good).
--
-- One table = queue AND store: the PK makes enqueue idempotent, `status`
-- drives the worker, `variants` is the payload. Statuses:
--   pending  — enqueued, not yet resolved (worker picks these up)
--   hydrated — variants resolved + stored
--   no_match — PokeTrace genuinely lacks the card (terminal; never retried)
--   failed   — transient error; retried until attempts hits the worker cap

create table if not exists card_hydration (
  card_slug    text primary key,
  status       text not null default 'pending'
    check (status in ('pending', 'hydrated', 'no_match', 'failed')),
  variants     jsonb,
  attempts     integer not null default 0,
  note         text,
  requested_at timestamptz not null default now(),
  hydrated_at  timestamptz
);

-- The worker's drain shape: oldest pending/failed first.
create index if not exists card_hydration_status_idx
  on card_hydration (status, requested_at);

-- Service-role only (same posture as watchlists — no anon access).
alter table card_hydration enable row level security;

drop policy if exists card_hydration_service_all on card_hydration;
create policy card_hydration_service_all
  on card_hydration
  for all
  to service_role
  using (true) with check (true);
