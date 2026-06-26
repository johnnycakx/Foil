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
- **Welcome automation BUILT (draft):** trigger = signup → immediate welcome email (founder voice, cheat-sheet CTA, reply prompt). `aut_ffd18eec-6e64-4af3-bf43-42f241f52207`.
- **Publication logo swapped to FoilTCG** (John did it). Sending domain `mail.foiltcg.com` is **verified/Live** (SPF/DKIM already done); branded-link subdomain still auto-verifying (cosmetic).

## TOP open items for next session (in order)

1. **Publish the welcome automation** — one click in the editor: `app.beehiiv.com/automations/ffd18eec-6e64-4af3-bf43-42f241f52207/workflow` → Publish. (Built and drafted; Beehiiv gates go-live to a human click.)
2. **Fix the email HEADER logo — still Rise & Close.** The publication logo is Foil now, but the *email* header is a separate image baked into the email **template** (and snapshotted into the welcome email). Fix in two places: (a) the welcome email — editor → click the R&C header image → replace with the FoilTCG logo from Media → Save; (b) Posts → Template library → default template → same swap, so the weekly newsletter isn't R&C. **Alternative: a Claude Code goal to script the template header swap via the Beehiiv API** (it reaches Beehiiv where the Cowork sandbox can't). This is the last visible R&C residue.
3. **Then GROW (the actual unlock):** stand up the publish→distribute loop. John's X founder voice (the named biggest unfair advantage, currently idle) + the live SEO pillars/card pages + the `/free` cheat-sheet lead magnet, all pointing at `/newsletter`. Issue #1 becomes a *launch event* (published web post + X thread), not an email blast to nobody.

## Lower-priority / cosmetic leftovers
- Unused `riseandclose.com` signup flow (non-default, new subs never hit it) — harmless, ignore.
- 4 old sales custom fields (Beehiiv won't delete them) — invisible clutter.
- Old default thumbnail (B&W R&C) in General Info + R&C-era publication tags (News/Popular Culture) — swap when convenient.

## Standing infra / ops (unchanged)
- ⏰ **PokeTrace re-subscribe before ~July 15 — LOAD-BEARING.** The whole insight engine (movers, /deals, the digest) runs on it. Reminder July 13.
- Dead Supabase PAT (401) — regenerate at supabase.com/dashboard/account/tokens → `.env.local` + `gh secret set`.
- CDTFA seller's permit — paused; CA entity # B20260280279 in hand.
- `AUTO_PUBLISH_WEEKLY_POSTS` is intentionally ON — don't "fix" to false.

## Strategic note (for the upgrade decision record)
Beehiiv **Scale** is justified *because John committed to actively running the newsletter* (automations + survey + segmentation are the ongoing value). It was NOT worth it purely for the one-time cleanup. The fully-automated "send the newsletter via API" dream is **Enterprise-only** (Send API), so manual draft-in-UI → send stays the path for a long time. If recurring cost ever feels unjustified, Scale is downgradable.
