-- Owned newsletter subscriber list (ADR-078) — the source of truth for the
-- marketing list now that the SEND runs on Resend Broadcasts (not a rented
-- Beehiiv list). Signups dual-write here AND to the Resend audience (AND keep
-- Beehiiv in parallel for the hosted signup form + archive).
--
-- Isolated, service-role-only (like the other newsletter/bot tables): RLS on,
-- no policies. The "use server" subscribe action writes via the service role.

create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  -- The capture-surface tag (homepage_hero, blog_inline, pillar_*, etc.).
  source text not null default 'unknown',
  -- The Resend audience contact id, when the dual-write to Resend succeeded.
  resend_contact_id text,
  created_at timestamptz not null default now(),
  -- Set when the subscriber unsubscribes (mirrored from Resend's native
  -- unsubscribe for broadcasts, or the transactional unsubscribe path).
  unsubscribed_at timestamptz
);

create index if not exists newsletter_subscribers_active_idx
  on newsletter_subscribers (created_at desc)
  where unsubscribed_at is null;

alter table newsletter_subscribers enable row level security;
-- Intentionally NO policies: service-role bypasses RLS; everyone else is denied.
