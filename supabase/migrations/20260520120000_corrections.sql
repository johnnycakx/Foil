-- Foil — user-submitted corrections for misidentified cards
-- One row per "Was this wrong?" submission on the upload results page.
-- Used as labeled training data for future prompt + model tuning.

create extension if not exists "pgcrypto";

create table if not exists public.corrections (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  submitted_at          timestamptz not null default now(),
  original_name         text,
  original_set          text,
  original_card_number  text,
  corrected_name        text,
  corrected_set         text,
  corrected_card_number text,
  notes                 text
);

create index if not exists corrections_submitted_at_idx
  on public.corrections (submitted_at desc);

create index if not exists corrections_user_id_idx
  on public.corrections (user_id);

alter table public.corrections enable row level security;

-- Users can insert their own corrections; reads are admin-only (no policy for select).
drop policy if exists "corrections_insert_own" on public.corrections;
create policy "corrections_insert_own" on public.corrections
  for insert to authenticated
  with check (auth.uid() = user_id);
