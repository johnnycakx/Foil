-- Foil — waitlist attribution columns
-- Adds UTM, landing page, and referrer capture so SEO-page signups are
-- attributable. The pre-existing `source` column stays as the high-level
-- bucket ("homepage", "japanese_guide", etc.); UTM fields carry the raw
-- campaign parameters.

alter table public.waitlist
  add column if not exists utm_source    text,
  add column if not exists utm_medium    text,
  add column if not exists utm_campaign  text,
  add column if not exists landing_page  text,
  add column if not exists referrer      text;

create index if not exists waitlist_source_idx
  on public.waitlist (source);
