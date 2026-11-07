-- Funnel events — the visitor→trial conversion trail (audit 2026-07-14).
--
-- The north star is the first paying $6/mo Pro subscriber, and the money path
-- is proven working — the bottleneck is distribution. But there is NO
-- server-side funnel instrumentation: @vercel/analytics gives page views, and
-- funnel-report.ts can count trials, but nothing measures visitor → card_view →
-- watch_set → pro_view → checkout_start → trial_start. So a ~$300 ad test would
-- return only the sale-or-no-sale bit, not WHERE the funnel broke.
--
-- This table is the owned-data trail that closes that gap. It joins against
-- newsletter_subscribers / subscriptions in funnel-report.ts for a real
-- visitor→trial diagnosis, with no third-party analytics SaaS.
--
-- PII posture: NO raw email, NO raw IP. `visitor_id` is a SALTED SHA-256 of the
-- client IP: PSEUDONYMOUS, not anonymous. IPv4 is a small keyspace, so it is
-- reversible by anyone holding BOTH this table AND the salt. The salt is a
-- required SECRET (FUNNEL_VISITOR_SALT); without it lib/telemetry/funnel-events.ts
-- writes visitor_id = NULL rather than a trivially-reversible id (fail-closed,
-- per lib/vault-token.ts). Treat visitor_id as PII-adjacent for retention.
-- Attribution is the ad-network utm_* the /pro CTA already threads. Service-role
-- only: RLS enabled with NO policies (same posture as browse_calls /
-- card_requests); the app writes through supabaseAdmin, nothing client reads it.

create table if not exists funnel_events (
  id bigint generated always as identity primary key,
  -- The funnel stage. Constrained so a typo can't create a phantom stage that
  -- silently never aggregates.
  stage text not null check (stage in (
    'card_view', 'watch_set', 'pro_view', 'checkout_start', 'trial_start'
  )),
  -- One-way hash of the client IP (+ salt). Stable per visitor within the salt
  -- epoch, non-reversible. Null when the IP was unavailable (still counts as an
  -- event, just not attributable to a visitor).
  visitor_id text,
  -- Ad attribution, mirrored from the utm_* the /pro CTA carries. Null on
  -- organic / internal traffic.
  utm_source text,
  utm_campaign text,
  -- Free-form small context (e.g. the card slug for a card_view, the hook
  -- variant for a pro_view). NOT PII — enforced by the write API's shape.
  meta jsonb,
  occurred_at timestamptz not null default now()
);

alter table funnel_events enable row level security;

-- Rollup scans are "stage counts over a time window" and "funnel for a visitor".
create index if not exists funnel_events_stage_time_idx on funnel_events (stage, occurred_at);
create index if not exists funnel_events_visitor_idx on funnel_events (visitor_id, occurred_at);
