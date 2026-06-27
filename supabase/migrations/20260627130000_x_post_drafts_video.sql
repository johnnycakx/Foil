-- Card-hero v2 motion (ADR-074 Phase 1): persist the MP4 clip alongside the
-- still on an approval-mode draft, so the approve path posts the EXACT reviewed
-- clip and can fall back to the still on an upload reject. Additive + nullable —
-- a still-only draft leaves video_base64 NULL, so existing rows and the
-- still-only path are unaffected.
--
-- Same isolation as the table itself (ADR-071): service-role only, RLS on with
-- no policies. The clip is ~1-3MB base64; TOAST handles it like image_base64.

alter table x_post_drafts
  add column if not exists video_base64 text;
