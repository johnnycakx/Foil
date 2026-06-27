-- X content-bot APPROVAL-mode pending drafts (ADR-071, extends ADR-058).
-- Isolated from the main app schema — like bot_messages (ADR-013), this table
-- joins no user / scans / waitlist data. The only access is the service-role
-- key (the cron persists; the /api/x/approve route reads + claims). RLS is
-- enabled with NO policies so anon/authenticated are denied; service-role
-- bypasses RLS, so it remains the sole accessor.
--
-- The row IS the thing that gets posted: the cron persists the exact text + the
-- rendered portrait (base64) it showed the owner in Discord, so "approved" and
-- "posted" are guaranteed identical even if the underlying deals data shifts
-- between draft and approval.

create table if not exists x_post_drafts (
  id uuid primary key default gen_random_uuid(),
  angle text not null,
  text text not null,
  link text not null,
  -- The rendered 1080x1350 portrait, base64-encoded. Null when no image was
  -- rendered (text-only post). One small image per day; TOAST handles it.
  image_base64 text,
  -- Lifecycle: pending -> posting (atomic claim) -> posted | (release back to
  -- pending on post failure). pending -> skipped (owner /skip). pending ->
  -- expired (timeout sweep; NEVER auto-posts).
  status text not null default 'pending'
    check (status in ('pending', 'posting', 'posted', 'skipped', 'expired')),
  created_at timestamptz not null default now(),
  -- Hard timeout: a pending draft past this is never postable (auto-skip).
  expires_at timestamptz not null,
  approved_by text,
  posted_at timestamptz,
  post_id text,
  error text
);

-- "find the latest pending / sweep the stale ones" access pattern.
create index if not exists x_post_drafts_status_created_idx
  on x_post_drafts (status, created_at desc);

alter table x_post_drafts enable row level security;
-- Intentionally NO policies: service-role bypasses RLS; everyone else is denied.
