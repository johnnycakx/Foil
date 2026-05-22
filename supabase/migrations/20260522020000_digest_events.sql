-- Daily-digest queue (ADR-018). Events that the rest of the stack would
-- normally fire as instant Discord pings can instead be queued here for a
-- daily batch when DIGEST_MODE=daily. The flush job (scripts/flush-digest.ts,
-- triggered by .github/workflows/daily-digest.yml) collapses N undigested
-- rows into one summary embed per channel target.
--
-- Schema is intentionally small. event_type + payload (jsonb) lets us
-- reshape downstream without a migration. channel_target ("subscribers",
-- "content-engine", "errors") is denormalized so flushes scope cleanly.
-- digested_at is the "already-flushed" marker — once set, rows stay for
-- auditing but won't be re-flushed.

create table if not exists digest_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  payload jsonb not null,
  channel_target text not null check (channel_target in ('subscribers', 'content-engine', 'errors', 'deploys')),
  created_at timestamptz not null default now(),
  digested_at timestamptz
);

-- Flush queries scan undigested rows per channel_target — the primary index
-- shape. Partial index keeps the working set small (digested rows fall out).
create index if not exists digest_events_undigested_idx
  on digest_events (channel_target, created_at)
  where digested_at is null;

alter table digest_events enable row level security;

drop policy if exists digest_events_service_all on digest_events;
create policy digest_events_service_all
  on digest_events
  for all
  to service_role
  using (true) with check (true);
