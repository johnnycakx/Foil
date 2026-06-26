# Next-Session Brief — prepared 2026-06-26 (Beehiiv foundation rebuild session)

> Read this first. Where things stand + the next plan. (Written by Cowork; commits run on John's machine — the sandbox can't commit cleanly.)

## The big correction this session: the newsletter "list" was a mirage

The Beehiiv account was a **repurposed "Rise & Close" SDR newsletter** — renamed to Foil, but everything underneath was still the old tech-sales product. Pulled the real numbers: the "18 subscribers" were **0 real Pokémon subscribers** — 13 legacy SDR humans (+ friends/family) and 5 of John's own test/bot accounts. The earlier plan ("send issue #1 first — the finish line") was built on a false premise: **there was no audience to send to, and sending to the SDR crowd would have risked spam complaints on a virgin sending reputation.**

**Corrected sequence (this overrides the old brief): clean the account → brand the emails → GROW the list → THEN issue #1.** Sending issue #1 to ~0 people was never the finish line; the finish line is the first cohort of real, engaged Pokémon subscribers from a repeatable channel.

## What shipped this session (Beehiiv, via the MCP API + Chrome)

- **Upgraded Beehiiv to Scale** (John's call; ~$43/mo annual). Unlocked MCP **write** access + automations + surveys + webhooks. Caveat learned: destructive ops (delete subscriber/post/custom-field) are NOT in the MCP toolset and the sandbox can't reach Beehiiv's REST API, so those were done by driving the dashboard over Chrome.
- **Subscriber list cleaned to 1:** deleted 17 (5 test/bots + 12 legacy SDR/family), **kept only `john.c.craig24@gmail.com`** as a seed. Verified via API + dashboard.
- **8 Rise & Close posts deleted** — `newsletter.foiltcg.com` no longer serves tech-sales content.
- **3 Pokémon onboarding custom fields created:** Collector type, Monthly budget, Collecting focus (kept First Name). The 4 old sales fields wouldn't delete (Beehiiv backend hold) — harmless clutter, left in place.
- **Onboarding survey BUILT + PUBLISHED (live):** "Tell us what you collect" — subscribe-slot, shows right after signup, 3 optional multiple-choice Qs feeding the 3 new fields. `newsletter.foiltcg.com/forms/1b5faea0-44c3-427e-be43-3a4a62ae0af1`.
- **Welcome automation BUILT + PUBLISHED (LIVE):** trigger = signup → immediate welcome email (founder voice, cheat-sheet CTA, reply prompt). `aut_ffd18eec-6e64-4af3-bf43-42f241f52207`. Fires on every new signup now.
- **Branding done:** publication logo + **email header logo** both swapped to FoilTCG (John, in the template Style editor); email outside-background set to gold (`#E6CA09`), button navy. Sending domain `mail.foiltcg.com` **verified/Live** (SPF/DKIM in place).

## Beehiiv foundation is COMPLETE. The job now is GROWTH.

Clean Foil-branded account, onboarding survey live, welcome email firing — and an audience of **one (John's seed)**. Nothing left to configure; do NOT keep polishing Beehiiv. The next session's work is filling the empty list:

1. **Stand up the publish→distribute loop.** John's **X founder voice** (the named biggest unfair advantage, currently idle) + the live SEO pillars/card pages + the `/free` cheat-sheet lead magnet, all funneling to `/newsletter`. Issue #1 = a *launch event* (published web post + X thread driving signups), not an email blast to a list of one.
2. **First concrete moves to choose from:** (a) activate John's X cadence now — post 2-3 real movers from `/deals` with a subscribe + cheat-sheet CTA; (b) regenerate the movers digest and publish issue #1 as a web post to anchor the launch; (c) a small Meta test to `/newsletter` once the organic loop is proven. Recommended order: a → b → c (organic + free first; pay only once it converts).
3. **Confirm `/newsletter` is conversion-ready** (live sample/value, clear ask) before driving traffic to it — every gram of signup friction is disproportionately costly (STRATEGY-AUDIENCE-MOAT funnel).

## Lower-priority / cosmetic leftovers
- Old `riseandclose.com` subscribe/signup form still exists and **pins 3 of the 4 sales custom fields** (API delete returned 400 "being used in a live form"; 1 field — "Which sales topics…" — was deleted via API). All invisible to subscribers. To clear: detach the 3 from that form (or delete the old form) in the dashboard, then delete. Cosmetic, ignore unless tidying.
- Old default thumbnail (B&W R&C) in General Info + R&C-era publication tags (News/Popular Culture) — swap when convenient.

## Standing infra / ops (unchanged)
- ⏰ **PokeTrace re-subscribe before ~July 15 — LOAD-BEARING.** The whole insight engine (movers, /deals, the digest) runs on it. Reminder July 13.
- Dead Supabase PAT (401) — regenerate at supabase.com/dashboard/account/tokens → `.env.local` + `gh secret set`.
- CDTFA seller's permit — paused; CA entity # B20260280279 in hand.
- `AUTO_PUBLISH_WEEKLY_POSTS` is intentionally ON — don't "fix" to false.

## Strategic note (for the upgrade decision record)
Beehiiv **Scale** is justified *because John committed to actively running the newsletter* (automations + survey + segmentation are the ongoing value). It was NOT worth it purely for the one-time cleanup. The fully-automated "send the newsletter via API" dream is **Enterprise-only** (Send API), so manual draft-in-UI → send stays the path for a long time. If recurring cost ever feels unjustified, Scale is downgradable.
