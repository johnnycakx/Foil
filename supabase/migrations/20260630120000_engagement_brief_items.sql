-- Engagement-brief delivery queue + decision ledger (ADR-086 v2 — advisory mode
-- + Discord Skip/Post buttons). Standard Discord channel webhooks CANNOT carry
-- interactive components, and a button click only routes to the APPLICATION that
-- owns the message — so the foil-bot (an application), not the webhook, must post
-- the brief and own the buttons. The Vercel cron computes the brief and inserts
-- one row per drafted item HERE; the bot drains undelivered rows, posts each to
-- #content-engine with Skip/Post buttons, and records John's decision back here.
--
-- The Post button NEVER acts on X (the zero-X-write firewall is unchanged): it
-- surfaces the copy-ready reply + a deep link; John posts every reply by hand.
--
-- Isolated + service-role-only (RLS on, no policies) like engagement_briefed_posts
-- and the newsletter/x tables — both the cron's and the bot's service-role clients
-- read/write it; everyone else is denied.

create table if not exists engagement_brief_items (
  post_id text primary key,
  post_url text not null,
  post_text text not null,
  author_username text,
  -- 'data_cite' (reply cites the exact card's real figures) | 'advisory'
  -- (value-first, figure-free reply for a high-reach no-specific-card post).
  mode text not null default 'data_cite',
  matched_card text,
  reply text not null,
  data_cited text not null default '',
  score double precision not null default 0,
  created_at timestamptz not null default now(),
  -- null = not yet posted by the bot; set when the bot posts the card.
  posted_to_discord_at timestamptz,
  -- null | 'skipped' | 'posted_by_hand' — John's button decision (a learning signal).
  decision text,
  decided_at timestamptz
);

alter table engagement_brief_items enable row level security;
-- Intentionally NO policies: service-role bypasses RLS; everyone else is denied.

-- The bot's drain query is "undelivered, oldest first".
create index if not exists engagement_brief_items_undelivered_idx
  on engagement_brief_items (created_at)
  where posted_to_discord_at is null;
