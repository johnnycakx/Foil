-- Reply-desk queue + decision ledger (x-reply-desk, ADR-107 — the eve-detector).
-- The USER-INITIATED-CONTACT lane: mentions of @FoilTCG + replies in our own
-- threads. X's automation rules PERMIT API responses to people who contacted
-- us, so the desk's "Reply" button API-POSTS the drafted reply in-thread (this
-- is the one sanctioned reply-desk X write — cold replies stay intent-link /
-- human-send forever, a separate lane; see ADR-107's two-lane rule).
--
-- A Vercel cron (3x/day) polls X, dedupes against this table (post_id PK),
-- drafts a reply reusing the receipts engine's guardrails, and inserts one row
-- per inbound. The foil-bot drains undelivered rows, posts each to the
-- engagement channel with Reply / Edit / Skip buttons, and records the outcome
-- here (including the posted reply's id + permalink on Approve).
--
-- Isolated + service-role-only (RLS on, no policies) like engagement_brief_items
-- and the newsletter/x tables — the cron's + the bot's + the approve endpoint's
-- service-role clients read/write it; everyone else is denied.

create table if not exists reply_desk_items (
  post_id text primary key,                 -- the inbound tweet id (dedupe key)
  post_url text not null,                    -- permalink to the inbound tweet
  post_text text not null,                   -- the inbound text
  author_username text,
  author_followers integer,
  -- 'mention' | 'reply' (best-effort; both are user-initiated contact).
  inbound_kind text not null default 'mention',
  -- our post they replied to, when readily known (best-effort; may be null).
  our_context text,
  -- the inbound carries an image/video (the 3e human-look path).
  has_media boolean not null default false,
  -- draft classification:
  --   'data_cite'  — resolved card + real figures → receipts reply + card link
  --   'intake'     — resolved card, no data → "tracking it" + hydration enqueued
  --   'advisory'   — unresolvable card → asks for set/number (no figures)
  --   'human_look' — media + unresolved text → NO auto-draft; John identifies
  mode text not null default 'advisory',
  matched_card text,
  matched_slug text,
  reply text not null default '',            -- the drafted reply (empty for human_look)
  card_page_url text,
  data_cited text not null default '',
  score double precision not null default 0,
  created_at timestamptz not null default now(),
  -- null = not yet posted by the bot; set when the bot posts the card.
  posted_to_discord_at timestamptz,
  -- 'pending' | 'posted' (API-replied) | 'skipped' — the decision + outcome.
  status text not null default 'pending',
  -- the X reply id + permalink after an Approve (the confirmation ping).
  posted_reply_id text,
  decided_at timestamptz
);

alter table reply_desk_items enable row level security;
-- Intentionally NO policies: service-role bypasses RLS; everyone else is denied.

-- The bot's drain query is "undelivered, oldest first".
create index if not exists reply_desk_items_undelivered_idx
  on reply_desk_items (created_at)
  where posted_to_discord_at is null;
