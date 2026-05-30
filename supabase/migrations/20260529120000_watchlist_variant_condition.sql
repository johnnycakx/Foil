-- Per-variant + per-condition watchlists (Session 49b / ADR-043).
--
-- Session 49 shipped the per-variant sold-history READ side (one PokeTrace
-- UUID per print edition/finish). This migration completes the WRITE side: a
-- watchlist row can now target a specific printing (variant) and grade/raw
-- condition, so the alert cron queries eBay for that exact thing and the alert
-- email says what's being tracked.
--
-- Schema-shape note (ADR-043): the goal spec assumed a `user_id`-keyed table
-- and a UNIQUE (user_id, card_slug) to drop. The live watchlists table is
-- EMAIL-anchored — there is no `user_id` and no auth in V1 (ADR-020), and the
-- only pre-existing index is watchlists_card_target_idx. So the new uniqueness
-- key is (email, card_slug, variant, condition); that is the natural primary
-- identity of a watch in an auth-free product.

alter table watchlists add column if not exists variant text not null default 'default';
alter table watchlists add column if not exists condition text not null default 'any-raw';

-- The old schema allowed duplicate (email, card_slug) rows (no unique). Before
-- adding the new unique key, collapse any rows that would now collide on
-- (email, card_slug, variant, condition) — keep the most generous alert (the
-- lowest target_price_cents), then the most recent as a tiebreaker.
delete from watchlists w
using (
  select id,
    row_number() over (
      partition by email, card_slug, variant, condition
      order by target_price_cents asc, created_at desc
    ) as rn
  from watchlists
) dups
where w.id = dups.id and dups.rn > 1;

-- Email-anchored identity of a watch: one row per (email, card, variant,
-- condition). A repeat submit UPSERTs the target_price_cents (see
-- app/actions/create-watchlist.ts + lib/wishlist/upsert.ts).
alter table watchlists drop constraint if exists watchlists_email_card_variant_condition_key;
alter table watchlists
  add constraint watchlists_email_card_variant_condition_key
  unique (email, card_slug, variant, condition);
