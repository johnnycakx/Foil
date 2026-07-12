-- offer-implementation (2026-07-11): the email→tier bridge.
--
-- Watches (`watchlists`) are email-anchored; `subscriptions` is user_id-keyed.
-- The locked offer needs tier answers for an EMAIL (free 3-watch cap, the
-- free-daily / pro-hourly alert cadence split, the pro-only daily drop send),
-- so subscriptions carries a lowercased email column written by the Stripe
-- webhook and backfilled here from auth.users.
alter table public.subscriptions
  add column if not exists email text;

update public.subscriptions s
set email = lower(u.email)
from auth.users u
where u.id = s.user_id
  and s.email is null;

create index if not exists subscriptions_email_idx
  on public.subscriptions (email);

-- Guest payment-first checkout (offer-implementation 1d): the webhook must
-- link a Stripe-created customer to an existing Supabase account by email,
-- lookup-FIRST so it never duplicates. PostgREST cannot query auth.users, so
-- expose one narrow SECURITY DEFINER lookup. Service-role only.
create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select id from auth.users
  where lower(email) = lower(p_email)
  order by created_at asc
  limit 1;
$$;

revoke all on function public.get_user_id_by_email(text) from public;
revoke all on function public.get_user_id_by_email(text) from anon;
revoke all on function public.get_user_id_by_email(text) from authenticated;
grant execute on function public.get_user_id_by_email(text) to service_role;
