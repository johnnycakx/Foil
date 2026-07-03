-- eve-vault-template-claims (ADR-100 amendment): a seeded vault is a TEMPLATE,
-- not a single-claim object. The link goes in a PUBLIC reply — anyone clicking
-- it must get the same experience, so claiming = instantiating the template for
-- that email, unlimited. The table becomes an instantiation LOG (one row per
-- vault + claimer) instead of a one-winner lock: the composite PK keeps the
-- per-email idempotency (same email re-claiming hits the unique violation and
-- heals its rows) while removing the cross-email race entirely.
alter table public.seeded_vault_claims
  drop constraint seeded_vault_claims_pkey;
alter table public.seeded_vault_claims
  add constraint seeded_vault_claims_pkey primary key (vault_slug, claimed_email);

comment on table public.seeded_vault_claims is
  'Instantiation log for seeded gift vaults (template model, ADR-100 amended): one row per (vault, claimer email). Definitions live in lib/vault-seeds.ts; service-role access only.';
