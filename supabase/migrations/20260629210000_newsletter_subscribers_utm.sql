-- Acquisition Phase 0 (ADR-084): UTM attribution on the owned newsletter list.
-- The per-surface `source` tag (deals_board, homepage_hero, …) records WHICH
-- capture surface converted; these add WHICH inbound channel drove the visit
-- (utm_source=reddit, utm_medium=community, utm_campaign=movers_board), captured
-- from the landing URL at signup. Source of truth stays Supabase
-- newsletter_subscribers (ADR-078); UTM augments `source`, never replaces it.
--
-- All nullable + soft-fail: a signup with no UTM params stores null, never an
-- error. Sanitized to [a-z0-9-] (≤64) at the persistence boundary before insert.
-- Same isolation as the table: service-role only, RLS on with no policies.

alter table newsletter_subscribers add column if not exists utm_source text;
alter table newsletter_subscribers add column if not exists utm_medium text;
alter table newsletter_subscribers add column if not exists utm_campaign text;

-- Channel readout ("which utm_source converted") — supports the founder-only
-- scripts/subscriber-sources.ts grouping over active subscribers.
create index if not exists newsletter_subscribers_utm_source_idx
  on newsletter_subscribers (utm_source)
  where unsubscribed_at is null;
