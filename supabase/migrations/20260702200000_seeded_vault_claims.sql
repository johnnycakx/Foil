-- Seeded gift vaults (eve-vault, ADR-100): claim state for pre-made vaults.
-- The vault DEFINITION lives in code (lib/vault-seeds.ts, reviewed curation);
-- this table records only WHO claimed it. One row per vault slug — the PK is
-- what makes double-claim impossible (a concurrent second claim hits the
-- unique violation and loses atomically).
create table if not exists public.seeded_vault_claims (
  vault_slug text primary key,
  claimed_email text not null,
  claimed_at timestamptz not null default now()
);

comment on table public.seeded_vault_claims is
  'Claim state for seeded gift vaults (eve-vault). Definitions live in lib/vault-seeds.ts; service-role access only.';

-- Service-role only: RLS on with no policies — anon/authenticated see nothing;
-- the app reads/writes exclusively via supabaseAdmin (same posture as the
-- other funnel tables).
alter table public.seeded_vault_claims enable row level security;
