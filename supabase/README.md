# Foil — Supabase migrations

These SQL files create the tables Foil's runtime depends on. They are
hand-authored (we don't run `supabase db push` against your project yet) —
apply them manually until we wire up the Supabase CLI.

## How to apply

1. Open the **SQL Editor** in your Supabase dashboard
   (https://supabase.com/dashboard/project/_/sql).
2. Paste the contents of each `.sql` file in this directory in chronological order
   (filename prefix is the timestamp).
3. Run it.

The migrations are idempotent (`create table if not exists`, `drop policy if exists` +
`create policy`, etc.) so re-running is safe.

## Tables

- **`scans`** — one row per identified-and-priced scan. Used to enforce the free
  tier's daily limit (1 scan/day). RLS: users can SELECT/INSERT their own rows;
  the webhook handler bypasses RLS via the service role key.
- **`subscriptions`** — mirror of each user's Stripe subscription state. RLS:
  users can SELECT their own row; only the service role can write (via the
  `/api/webhooks/stripe` handler).
