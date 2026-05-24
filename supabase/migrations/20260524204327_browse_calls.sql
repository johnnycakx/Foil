-- Browse API call telemetry. See ADR-025.
--
-- Stores OPERATIONAL metadata only — called_at, surface, success, latency_ms.
-- Per R-008 (eBay 2025 License Agreement), we never persist listing payload:
-- no titles, no prices, no item URLs, no card-identifying fields.
--
-- The data backs two purposes:
--   1. The capHit:true trigger in ADR-024 (Wishlist alert cron) — once the
--      hourly cron starts shedding work because of the 200-call cap, the
--      telemetry tells us when we crossed it and how often.
--   2. Evidence for the eBay Application Growth Check when we apply to lift
--      the daily Browse quota above the 5,000-call default.

create table if not exists browse_calls (
  id bigserial primary key,
  called_at timestamptz not null default now(),
  surface text not null check (surface in ('page_render', 'wishlist_cron', 'manual')),
  success boolean not null,
  latency_ms integer not null
);

-- Aggregate queries (last24h, last7days) all scan called_at DESC. The
-- partial workload is read-heavy at the cron boundary and write-heavy
-- everywhere else.
create index if not exists browse_calls_called_at_idx
  on browse_calls (called_at desc);

-- RLS: service-role only. logBrowseCall + aggregate* both run via the
-- lib/supabase/admin.ts client. No anon access — telemetry never surfaces
-- through the public API.
alter table browse_calls enable row level security;

drop policy if exists browse_calls_service_all on browse_calls;
create policy browse_calls_service_all
  on browse_calls
  for all
  to service_role
  using (true) with check (true);
