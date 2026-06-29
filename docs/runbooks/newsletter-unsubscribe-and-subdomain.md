# Runbook — newsletter unsubscribe sync + sending subdomain (ADR-082)

Two pre-volume hardening steps for the Resend-Broadcasts newsletter send (ADR-078). Both are **built + committed**; this runbook is the John-attended activation (the live HARD test gate). Nothing here auto-runs.

---

## Part A — Resend unsubscribe → Supabase + Beehiiv sync webhook

**What it closes.** A native one-click unsubscribe in a Resend broadcast (or a spam complaint) marks the contact unsubscribed in **Resend only**. Supabase `newsletter_subscribers` is our **source of truth**, and the broadcast/digest send excludes `unsubscribed_at IS NOT NULL` — so without this sync, the next send re-includes someone who opted out (a CAN-SPAM violation + a deliverability killer). The webhook propagates every opt-out to Supabase **and** Beehiiv so all three stores stay coherent. Resend is already coherent (the webhook fires *because* Resend updated the contact).

**The pieces (already shipped):**
- `app/api/webhooks/resend/route.ts` — verifies Resend's Svix signature, extracts opt-outs, syncs. Public via the `/api/webhooks` prefix (the signature IS the auth); pinned in `proxy.test.ts`.
- `lib/resend-webhook.ts` — Svix HMAC-SHA256 verification (`${svix-id}.${svix-timestamp}.${body}`, base64, 5-min replay window) + event → opt-out extraction. Handles `contact.updated`/`contact.created` (`unsubscribed: true`) and `email.complained` (`data.to`).
- `lib/newsletter/unsubscribe-sync.ts` — gated Supabase `UPDATE … WHERE email = $1 AND unsubscribed_at IS NULL` (idempotent: a replay flips 0 rows) + Beehiiv `unsubscribeEmail`. Soft-fail per leg; a genuine Supabase error returns 500 so Svix retries.

**Activation (John, one time):**
1. **Create the webhook in Resend** → Dashboard → Webhooks → Add Endpoint:
   - URL: `https://foiltcg.com/api/webhooks/resend`
   - Events: at minimum **`contact.updated`** and **`email.complained`** (optionally `contact.created`).
2. **Copy the signing secret** Resend shows (`whsec_…`) and set it on **Vercel production**:
   `vercel env add RESEND_WEBHOOK_SECRET production` (paste the `whsec_…` value).
3. **Redeploy** prod so the route picks up the secret (`git push` of this branch, or `vercel --prod`).
4. **Run the live HARD test gate** (the goal's closure block):
   - Subscribe a disposable address to the list, then click the **native one-click unsubscribe** in a real test broadcast.
   - Confirm `newsletter_subscribers.unsubscribed_at` is now set for that email (Supabase), the Resend contact shows `unsubscribed: true`, and the Beehiiv subscription is inactive — **all three coherent**.
   - Trigger a fresh broadcast and confirm that address is **excluded**.
   - Replay the same webhook delivery from the Resend dashboard → confirm it's a **no-op** (0 rows changed, still 200).
   - Record the results in `docs/SESSION-LOG.md`.

**Failure modes:** missing secret → route returns 503 (no-op, safe); bad signature → 401; non-opt-out event → 200 `skipped`; Supabase error → 500 (Svix retries with backoff; the sync is idempotent so the retry is safe).

---

## Part B — `news.foiltcg.com` sending subdomain

**Why.** Broadcasts currently send from `alerts@foiltcg.com` — shared with transactional (wishlist alerts). A dedicated marketing subdomain isolates the two reputations: a marketing deliverability dip can't drag down a wishlist-alert (a paid, time-sensitive transactional email), and warming a fresh subdomain from zero is cleanest **now**, before volume.

**Mechanism.** The broadcast send already reads `process.env.NEWSLETTER_FROM` (`lib/notifications/resend.ts`) and falls back to the verified `alerts@foiltcg.com`. So the switch is **env-only** once the subdomain verifies — no code change, and unsetting the env is an instant rollback. The default stays `alerts@` so a missing/unverified subdomain can never break a send.

**Activation (John, one DNS hand-off):**
1. **Provision the subdomain + print the exact records:**
   `npm run setup:news-subdomain -- --create`
   (Read-only without `--create`: it looks up an existing domain and reprints its records. Region defaults to `us-east-1`; pass `--region` / `--domain` to override. Tracking is disabled by design — fewer DNS records + no tracking pixel, which helps Primary placement.)
2. **Add every printed record** at the registrar hosting `foiltcg.com` DNS. The set Resend mints for a subdomain:
   - **SPF** — an `MX` on `send.news.foiltcg.com` → `feedback-smtp.us-east-1.amazonses.com` (priority 10) **and** a `TXT` on `send.news.foiltcg.com` → `"v=spf1 include:amazonses.com ~all"`.
   - **DKIM** — **3 `CNAME`s** (SES Easy DKIM), `<token>._domainkey.news.foiltcg.com` → `<token>.dkim.amazonses.com`. (The exact tokens are unique per domain — the script prints them.)
   - **DMARC** *(recommended; Resend does not mint it)* — a `TXT` on `_dmarc.news.foiltcg.com` → `"v=DMARC1; p=none; rua=mailto:dmarc@foiltcg.com"`. Mirrors the root's monitoring-mode policy (Task #18).
3. **Verify** the domain in Resend (dashboard, or `POST /domains/{id}/verify`). DNS can take up to ~30 min.
4. **Flip the sender** — set on **Vercel production**: `NEWSLETTER_FROM="Foil <news@foiltcg.com>"`.
5. **Live HARD test gate:** send a test broadcast from the new subdomain → confirm it lands in **Primary** (the ADR-079 non-negotiable; not Promotions/Spam), and in Gmail → **Show original** confirm **DKIM=pass, SPF=pass, DMARC=pass**. Record in SESSION-LOG.

**Rollback:** unset `NEWSLETTER_FROM` on Vercel prod → the next send reverts to the verified `alerts@foiltcg.com`. The subdomain can stay provisioned (it sends nothing until `NEWSLETTER_FROM` points at it).

---

**Kill-switch (both parts):** unset `RESEND_WEBHOOK_SECRET` (route no-ops at 503; opt-outs stop syncing — re-set to resume) / unset `NEWSLETTER_FROM` (sends revert to `alerts@`).
