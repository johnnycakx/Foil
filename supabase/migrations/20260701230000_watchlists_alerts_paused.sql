-- Alerts pause for one-click unsubscribe (start-funnel-integrity, ADR-090).
--
-- Before this column, /api/unsubscribe stopped only the NEWSLETTER — the
-- wishlist-alert cron kept emailing forever, and the unsubscribe page told
-- recipients to "email john…" to stop alerts (a CAN-SPAM hole on the funnel's
-- highest-volume email type). `alerts_paused_at` is the kill switch:
--   - /api/unsubscribe (GET + RFC 8058 one-click POST) sets it on EVERY row
--     of the verified email;
--   - the Resend webhook sets it on `email.complained` (spam complaint =
--     strongest opt-out signal);
--   - the wishlist-alert cron excludes paused rows from its scan.
-- NULL = alerts active (all existing rows keep alerting; no backfill needed).

alter table watchlists add column if not exists alerts_paused_at timestamptz;

-- The pause path updates by email ("all watches for this address"), and the
-- /api/start per-email watch cap counts by email — neither shape had an index.
create index if not exists watchlists_email_idx on watchlists (email);
