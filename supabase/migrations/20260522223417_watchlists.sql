-- Watchlist email captures for the V1 deal-finder (ADR-020 + ADR-021).
--
-- A row represents: "email X wants to be alerted when card_slug Y drops to
-- target_price_cents Z or below." V1 is email-anchored (no auth) per ADR-020;
-- the wishlist alert cron (ROADMAP NEXT #9) walks these rows hourly, queries
-- the current best listing via EPN, and emits a Resend email when the
-- threshold is met. `last_notified_at` powers the 24-hr per-row cool-off.

create table if not exists watchlists (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  card_slug text not null,
  target_price_cents integer not null check (target_price_cents > 0),
  created_at timestamptz not null default now(),
  last_notified_at timestamptz
);

-- The cron's primary scan shape: "all rows for this card under this price,
-- sorted by oldest cool-off first." Composite index keeps that lookup cheap
-- as the table grows.
create index if not exists watchlists_card_target_idx
  on watchlists (card_slug, target_price_cents);

-- RLS: service-role only. The /api/watchlist endpoint and the alert cron both
-- use the service-role client (lib/supabase/admin.ts). No anon access — we
-- never expose a watcher's email to other users.
alter table watchlists enable row level security;

drop policy if exists watchlists_service_all on watchlists;
create policy watchlists_service_all
  on watchlists
  for all
  to service_role
  using (true) with check (true);
