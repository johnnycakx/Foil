-- Pause provenance for the vault (watchlist-web-app, ADR-093).
--
-- alerts_paused_at previously had ONE writer class (unsubscribe/complaint —
-- both "stop everything" suppression, ADR-090). The vault adds a second:
-- user-initiated pause/resume from the watchlist page. The two must not
-- blur, because their resume rules differ:
--   vault       — the user's own toggle; freely resumable from the vault.
--   unsubscribe — one-click opt-out; resumable from the vault (the token
--                 proves email control — the holder RECEIVED it by email,
--                 which is stronger re-consent than knowing an address).
--   complaint   — a spam complaint; NOT resumable from the vault (the
--                 strongest opt-out; only a future verified re-opt-in flow
--                 may clear it).
-- Per-email suppression (the ADR-090 sticky rule that new watches inherit)
-- now counts ONLY unsubscribe/complaint rows — a vault pause is a per-card
-- preference, not address-level suppression.

alter table watchlists add column if not exists paused_source text
  check (paused_source is null or paused_source in ('vault', 'unsubscribe', 'complaint'));

-- Backfill: every pre-existing pause came from the unsubscribe/complaint
-- machinery (the vault didn't exist). 'unsubscribe' is the conservative
-- default — resumable from the vault, still suppression for new watches.
update watchlists set paused_source = 'unsubscribe'
  where alerts_paused_at is not null and paused_source is null;
