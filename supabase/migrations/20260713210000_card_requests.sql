-- Request-tracking V1 (quality-bar-fixes P0-4, 2026-07-13; the IDEAS.md
-- "untracked-cards-are-invitations" loop, proven by the audit walk).
--
-- When search fails, the fail state captures the query + an email instead of
-- stranding the buyer. The daily catalog bake then matches pending requests
-- against the (newly expanded) catalog and emails "Foil now tracks it"
-- (scripts/notify-card-requests.ts), flipping status to 'notified'.
--
-- Service-role only: RLS enabled with NO policies (same posture as the bot
-- tables) — the public API route writes through supabaseAdmin after
-- validation; nothing client-side touches this table.

create table if not exists card_requests (
  id uuid primary key default gen_random_uuid(),
  query text not null check (char_length(query) between 2 and 64),
  email text not null check (char_length(email) <= 320),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'notified')),
  notified_at timestamptz,
  -- The card the notifier matched (catalog slug) — evidence for the email.
  matched_slug text
);

alter table card_requests enable row level security;

create index if not exists card_requests_status_idx on card_requests (status, created_at);

-- One PENDING row per (email, query): resubmits are idempotent, not spam.
create unique index if not exists card_requests_pending_uniq
  on card_requests (lower(email), lower(query))
  where status = 'pending';
