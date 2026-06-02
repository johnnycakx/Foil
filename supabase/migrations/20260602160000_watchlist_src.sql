-- F2: per-source attribution for watchlist email captures (ROADMAP B-pilot prep).
--
-- The affiliate-click side already attributes via the EPN `customid` (cp-<slug>
-- -s-<creator>). The EMAIL capture — which STRATEGY-AUDIENCE-MOAT calls Foil's
-- deepest moat — had no source tag, so creator-pilot signups were invisible.
-- This adds a nullable `src` column populated from the inbound `?src=` param.
--
-- Backward-compatible: nullable, no default, no backfill. Every existing row
-- and every existing write path (which omits `src`) keeps working unchanged.

alter table watchlists add column if not exists src text;
