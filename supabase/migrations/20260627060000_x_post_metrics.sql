-- X post engagement metrics (ADR-071 follow-up, Part 2). One row per posted
-- draft, fetched ONCE ~48h after the post by the /api/cron/x-metrics cron. This
-- is the "capture from day one" dataset for the deferred self-learning loop
-- (docs/IDEAS.md) — capture only, no effect on generation.
--
-- Isolated + service-role only, like x_post_drafts (ADR-013 / ADR-071): RLS on,
-- no policies. FK to x_post_drafts; cascade so a deleted draft drops its metrics.

create table if not exists x_post_metrics (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references x_post_drafts (id) on delete cascade,
  tweet_id text not null,
  angle text,
  likes integer,
  reposts integer,
  replies integer,
  quotes integer,
  -- Nullable: impression_count is not always present on the public_metrics
  -- payload depending on auth context; we store what the API returns.
  impressions integer,
  -- True when the tweet was deleted before metrics could be captured.
  deleted boolean not null default false,
  fetched_at timestamptz not null default now()
);

-- One metrics row per draft (the cron skips drafts that already have one).
create unique index if not exists x_post_metrics_draft_uidx on x_post_metrics (draft_id);

alter table x_post_metrics enable row level security;
-- Intentionally NO policies: service-role bypasses RLS; everyone else denied.
