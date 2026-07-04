-- Engagement-brief one-tap intent link (x-reply-desk §2a/§3c, ADR-107). The
-- cold-lane friction fix: replace the copy/paste "Post" flow with a prefilled
-- x.com/intent/post URL the bot's Post button opens in one tap (the human still
-- presses X's own Post — cold replies are human-send forever). The cron computes
-- the URL (reply-intent for a normal reply, quote-intent for a QT-with-receipts)
-- and stores it here; the bot surfaces it. Nullable + back-compat: legacy rows
-- have NULL and fall back to the deep link.

alter table engagement_brief_items
  add column if not exists intent_url text;
