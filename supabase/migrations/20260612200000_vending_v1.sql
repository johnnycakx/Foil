-- Vending web foundation, Phase V-1 (STRATEGY-VENDING-2026-06-12 §7).
--
-- Two NEW sibling tables. Deliberately NOT an alteration of `watchlists`:
-- the ADR-043 watchlist write path (createWatchlist -> upsertWatchlist) stays
-- byte-identical, and vending data stays structurally separate from the
-- deal-finder's tables (trust firewall, strategy §4 rule 2).
--
-- Both tables are service-role only (RLS on, no anon access), same posture as
-- watchlists: emails and lead details are never readable by other users.

-- ---------------------------------------------------------------------------
-- host_leads: /host venue-funnel submissions. Insert-only from the Server
-- Action; read by the founder (Supabase dashboard / future bot tool).
-- Token sets mirror lib/vending/validate.ts.
-- ---------------------------------------------------------------------------

create table if not exists host_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_name text not null,
  venue_type text not null check (venue_type in ('card_shop','barbershop','bowling_fec','mall','grocery','other')),
  city text not null,
  email text not null,
  phone text,
  foot_traffic text not null check (foot_traffic in ('under_50','50_200','200_500','over_500','unsure')),
  hours_of_access text,
  placement_outlet text check (placement_outlet in ('yes','no','unsure')),
  sells_cards text check (sells_cards in ('yes','no')),
  priority text check (priority in ('reliability','appearance','revenue','amenity')),
  notes text,
  created_at timestamptz not null default now()
);

-- Founder review scan ("newest leads first") + the per-email 24h rate-limit
-- count in the Server Action.
create index if not exists host_leads_created_idx on host_leads (created_at desc);
create index if not exists host_leads_email_created_idx on host_leads (email, created_at);

alter table host_leads enable row level security;

drop policy if exists host_leads_service_all on host_leads;
create policy host_leads_service_all
  on host_leads
  for all
  to service_role
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- machine_restock_alerts: location-anchored restock alerts (schema only in
-- V-1; the send path is V-2, gated on machine #1 existing).
--
-- A row means: "email X wants to hear when machine location Y restocks
-- product scope Z." Pre-placement rows carry location_key NULL = "the first
-- machine near me" (city free-text maps demand to geography). Email-anchored
-- like watchlists (ADR-020, no auth); `tier` is the ADR-059 entitlement seam,
-- everyone defaults to 'free'; `last_notified_at` mirrors the watchlists
-- cool-off column so the eventual V-2 send path reuses the proven shape.
-- ---------------------------------------------------------------------------

create table if not exists machine_restock_alerts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  location_key text,
  product_scope text not null default 'any',
  city text,
  tier text not null default 'free',
  created_at timestamptz not null default now(),
  last_notified_at timestamptz
);

-- One row per (email, location, scope). COALESCE because location_key is NULL
-- pre-placement and Postgres UNIQUE treats NULLs as distinct; the sentinel
-- keeps "first machine near me" idempotent per email.
create unique index if not exists machine_restock_alerts_unique_idx
  on machine_restock_alerts (email, coalesce(location_key, ''), product_scope);

-- The V-2 send-path scan shape: "everyone watching this location."
create index if not exists machine_restock_alerts_location_idx
  on machine_restock_alerts (location_key);

alter table machine_restock_alerts enable row level security;

drop policy if exists machine_restock_alerts_service_all on machine_restock_alerts;
create policy machine_restock_alerts_service_all
  on machine_restock_alerts
  for all
  to service_role
  using (true) with check (true);
