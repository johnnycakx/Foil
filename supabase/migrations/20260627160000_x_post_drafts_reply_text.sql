-- Card-hero v2.2 (ADR-074 amendment): persist the threaded-reply text on an
-- approval-mode draft, so /approve posts the EXACT reviewed reply (the value-
-- framed link line, or the newsletter CTA on a rotation day). Additive +
-- nullable — legacy rows leave reply_text NULL and the approve path falls back
-- to the bare `link`, so existing rows and the still-only path are unaffected.
--
-- Same isolation as the table itself (ADR-071): service-role only, RLS on with
-- no policies.

alter table x_post_drafts
  add column if not exists reply_text text;
