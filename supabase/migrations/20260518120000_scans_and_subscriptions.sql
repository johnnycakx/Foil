-- Foil — scan rate limiting + Pro subscription tracking
-- 1) scans: one row per identified-and-priced scan (used to enforce the free tier daily limit).
-- 2) subscriptions: mirror of Stripe subscription state per Supabase user.

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- scans
-- ----------------------------------------------------------------------------
create table if not exists public.scans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  scanned_at      timestamptz not null default now(),
  image_metadata  jsonb not null default '{}'::jsonb
);

create index if not exists scans_user_scanned_at_idx
  on public.scans (user_id, scanned_at desc);

alter table public.scans enable row level security;

-- Users see and insert only their own scans. Webhooks/admin operate via service role (bypasses RLS).
drop policy if exists "scans_select_own" on public.scans;
create policy "scans_select_own" on public.scans
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "scans_insert_own" on public.scans;
create policy "scans_insert_own" on public.scans
  for insert to authenticated
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- subscriptions
-- ----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  tier                    text not null default 'free' check (tier in ('free', 'pro')),
  status                  text,                    -- Stripe status: active | trialing | past_due | canceled | incomplete | ...
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists subscriptions_stripe_customer_idx
  on public.subscriptions (stripe_customer_id);

create index if not exists subscriptions_stripe_subscription_idx
  on public.subscriptions (stripe_subscription_id);

create or replace function public.touch_updated_at() returns trigger
  language plpgsql as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$;

drop trigger if exists subscriptions_touch_updated_at on public.subscriptions;
create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

alter table public.subscriptions enable row level security;

-- Users can read their own subscription row but never write. Service role handles upserts from the Stripe webhook.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated
  using (auth.uid() = user_id);
