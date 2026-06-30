-- Engagement-brief idempotency (ADR-086). One row per X post that has been put
-- in a brief, so the same target never resurfaces day to day. Isolated +
-- service-role-only (RLS on, no policies) like the newsletter/x tables — only
-- the cron's service-role client reads/writes it; everyone else is denied.

create table if not exists engagement_briefed_posts (
  post_id text primary key,
  briefed_at timestamptz not null default now()
);

alter table engagement_briefed_posts enable row level security;
-- Intentionally NO policies: service-role bypasses RLS; everyone else is denied.
