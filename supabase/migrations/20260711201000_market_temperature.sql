-- offer-implementation item 6 (2026-07-11): the market-temperature stat.
--
-- One number per day: how many of the cards Foil tracks are selling below
-- their own 30-day average this week (avg7d < avg30d), out of how many the
-- daily movers sweep could price. Rendered in card-shop words ("X of the N
-- cards Foil tracks are going for less than usual this week"). Market-level
-- claims in copy are banned until this exists (2026-07-11 scope-honesty rule).
create table if not exists public.market_temperature (
  snapshot_date date primary key,
  below_count integer not null check (below_count >= 0),
  total_count integer not null check (total_count >= 0),
  computed_at timestamptz not null default now()
);

alter table public.market_temperature enable row level security;

-- Service-role writes (cron); public read is fine — it renders on /deals.
create policy market_temperature_read
  on public.market_temperature
  for select
  to anon, authenticated
  using (true);
