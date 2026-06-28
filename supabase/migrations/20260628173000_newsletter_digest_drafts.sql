-- Newsletter "good buys this week" digest APPROVAL-mode drafts (ADR-077).
-- The no-spend /approve rail: a weekly cron generates the movers digest, the
-- owner approves it in Discord, and ON APPROVE the paste-ready HTML is emailed
-- to the founder for the manual Beehiiv paste+send (Beehiiv RSS-to-Send is a
-- Max/Enterprise feature, not on our Scale plan — ADR-077).
--
-- Isolated from the main app schema (like x_post_drafts / bot_messages): joins
-- no user / scans / waitlist data. Service-role is the sole accessor; RLS is
-- enabled with NO policies so anon/authenticated are denied.
--
-- The row IS the thing that gets delivered: the cron persists the exact subject,
-- preview, and HTML body it summarized to the owner in Discord, so "approved"
-- and "delivered" are byte-identical even if market_movers shifts in between.
--
-- Idempotency: issue_week is UNIQUE, so re-running the weekly cron (or a double
-- Vercel-cron fire) can create at most one draft per ISO week.

create table if not exists newsletter_digest_drafts (
  id uuid primary key default gen_random_uuid(),
  -- ISO week tag, e.g. "2026-W26". UNIQUE = one digest per week (idempotency).
  issue_week text not null unique,
  subject text not null,
  preview_text text not null,
  -- The paste-ready email/Beehiiv HTML body (affiliate links already wrapped).
  html_body text not null,
  -- The markdown source the HTML was rendered from (canonical record / debug).
  markdown_body text not null,
  down_count integer not null default 0,
  up_count integer not null default 0,
  -- Lifecycle: pending -> delivering (atomic claim) -> delivered | (release back
  -- to pending on email failure). pending -> skipped (owner /skip). pending ->
  -- expired (timeout sweep; NEVER auto-delivers).
  status text not null default 'pending'
    check (status in ('pending', 'delivering', 'delivered', 'skipped', 'expired')),
  created_at timestamptz not null default now(),
  -- Hard timeout: a pending draft past this is never deliverable (auto-skip).
  expires_at timestamptz not null,
  approved_by text,
  delivered_at timestamptz,
  -- Resend message id of the paste-ready delivery email.
  delivery_id text,
  error text
);

-- "find the latest pending / sweep the stale ones" access pattern.
create index if not exists newsletter_digest_drafts_status_created_idx
  on newsletter_digest_drafts (status, created_at desc);

alter table newsletter_digest_drafts enable row level security;
-- Intentionally NO policies: service-role bypasses RLS; everyone else is denied.
