-- Foil — match_confirmations
-- Records user feedback on scan results (positive or negative). Used as
-- labeled training data alongside the existing `corrections` table.

create extension if not exists "pgcrypto";

create table if not exists public.match_confirmations (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  scan_id              uuid references public.scans(id) on delete set null,
  card_id              text,
  matched_image_url    text,
  card_name            text,
  card_set             text,
  card_number          text,
  user_confirmed       boolean not null,
  created_at           timestamptz not null default now()
);

create index if not exists match_confirmations_user_idx
  on public.match_confirmations (user_id, created_at desc);

create index if not exists match_confirmations_card_idx
  on public.match_confirmations (card_id);

alter table public.match_confirmations enable row level security;

drop policy if exists "match_confirmations_insert_own" on public.match_confirmations;
create policy "match_confirmations_insert_own" on public.match_confirmations
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "match_confirmations_select_own" on public.match_confirmations;
create policy "match_confirmations_select_own" on public.match_confirmations
  for select to authenticated
  using (auth.uid() = user_id);
