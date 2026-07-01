-- Backfill: lowercase every watchlists email (start-funnel-integrity, ADR-090
-- hardening #2). The pause/suppression queries (lib/wishlist/pause.ts) match
-- case-sensitively on a lowercased input, so a row stored mixed-case (the
-- legacy /api/watchlist endpoint wrote the email verbatim) could never be
-- paused by the one-click unsubscribe — the victim had no self-serve stop.
-- upsertWatchlist now lowercases at the choke point; this brings the existing
-- rows in line.
--
-- Duplicate-safe: if lowering an email would collide with an existing row on
-- UNIQUE(email, card_slug, variant, condition), keep the older row and drop
-- the newer duplicate first.

delete from watchlists w
using watchlists k
where lower(w.email) = lower(k.email)
  and w.card_slug = k.card_slug
  and w.variant = k.variant
  and w.condition = k.condition
  and w.id <> k.id
  and w.email <> lower(w.email)          -- only drop rows that would need rewriting
  and (k.created_at < w.created_at or (k.created_at = w.created_at and k.id < w.id));

update watchlists set email = lower(email) where email <> lower(email);
