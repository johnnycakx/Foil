-- Scheduled-cancel state (2026-07-12).
--
-- Stripe keeps a canceling subscription at status `trialing`/`active` until the
-- period actually ends, flagging it with `cancel_at_period_end` + `cancel_at`.
-- We stored neither, so /account told a user who had ALREADY canceled that they
-- had a "next charge" coming — a false claim about their money — and the DB
-- could not distinguish "trialing, will bill" from "trialing, will end" (this
-- is exactly what made the +smoke live trial's state unverifiable from our own
-- data on 2026-07-12).
alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancel_at timestamptz;
