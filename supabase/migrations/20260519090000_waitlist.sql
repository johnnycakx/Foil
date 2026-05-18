-- Foil — pre-launch waitlist
-- All writes go through the Server Action using the service role; no
-- public/anon RLS policies. Reads happen only via the dashboard or
-- service-role queries when we're ready to send the launch email.

create extension if not exists "pgcrypto";

create table if not exists public.waitlist (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  signed_up_at  timestamptz not null default now(),
  source        text
);

-- Case-insensitive uniqueness so users can't double-sign up by changing case.
create unique index if not exists waitlist_email_lower_unique
  on public.waitlist (lower(email));

create index if not exists waitlist_signed_up_at_idx
  on public.waitlist (signed_up_at desc);

alter table public.waitlist enable row level security;
-- (No policies — service role bypasses RLS.)
