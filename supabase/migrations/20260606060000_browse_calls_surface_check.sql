-- Widen the browse_calls.surface CHECK to include the deals surfaces.
--
-- ROOT CAUSE of the "deals_cron telemetry = 0" gap: the original browse_calls
-- CHECK constraint only allowed ('page_render','wishlist_cron','manual'). The
-- BrowseSurface union later gained 'deals_cron' (ADR-054) and 'deals_redirect'
-- (ADR-056), but the DB constraint was never updated — so every deals_cron /
-- deals_redirect insert violated the check and logBrowseCall (fire-and-forget,
-- soft-fail) silently dropped it. (Allowed surfaces logged fine all along:
-- page_render + wishlist_cron + manual rows are present.) Widen the set so the
-- deals cron + click-redirect Browse calls are recorded for R-012 quota
-- monitoring. Non-destructive: only relaxes the constraint.

alter table browse_calls drop constraint if exists browse_calls_surface_check;
alter table browse_calls add constraint browse_calls_surface_check
  check (surface = any (array['page_render', 'wishlist_cron', 'deals_cron', 'deals_redirect', 'manual']));
