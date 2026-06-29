# Runbook — acquisition UTM links + signups-by-source readout (ADR-084)

Phase 0 makes the acquisition push **measurable**: every link you paste in a community carries a UTM tag, the signup stores it on the owned `newsletter_subscribers` row, and one command reads "which channel converted." This runbook is the copy-paste link format + how to read the results. (It does not acquire anyone — that's Phase 1, founder-manual.)

## How attribution works
- **`source`** = the capture SURFACE the visitor subscribed from (`deals_board`, `homepage_hero`, `blog_inline`, `pillar_*`). Set in code by each `<EmailCapture source=…>`. Already worked pre-Phase-0.
- **`utm_source` / `utm_medium` / `utm_campaign`** = the inbound CHANNEL, read from the landing URL and mirrored into the signup. NEW in ADR-084. The shared `EmailCapture` reads them from `window.location` after hydration, so **every** capture surface is attributed, not just `/deals`.
- Both are stored per signup. UTM is **sticky first-touch**: a later re-subscribe with no UTM won't wipe the channel that first brought them.
- Untrusted URL input → sanitized to `[a-z0-9-]`, capped at 64 chars, before it's persisted.

## Canonical link format
Point every community link at a public, indexable surface (usually `/deals` — the board is the hook) with the three UTM params:

```
https://foiltcg.com/deals?utm_source=<channel>&utm_medium=<context>&utm_campaign=<what>
```

Short alias: `?src=<channel>` is accepted as a stand-in for `utm_source` (matches the watchlist convention) when you want a tidy link — e.g. `https://foiltcg.com/deals?src=reddit`.

### Per-channel cheat-sheet (copy-paste)

| Channel | Paste this link |
|---|---|
| Reddit (r/pkmntcgdeals, r/PokeInvesting) | `https://foiltcg.com/deals?utm_source=reddit&utm_medium=community&utm_campaign=movers_board` |
| Discord (TCG servers) | `https://foiltcg.com/deals?utm_source=discord&utm_medium=community&utm_campaign=movers_board` |
| X / Twitter (founder posts) | `https://foiltcg.com/deals?utm_source=x&utm_medium=social&utm_campaign=movers_board` |
| X bio / link-in-profile | `https://foiltcg.com/deals?utm_source=x&utm_medium=bio&utm_campaign=profile` |
| A specific blog/pillar drop | `https://foiltcg.com/deals?utm_source=<channel>&utm_medium=<context>&utm_campaign=<post_slug>` |

Conventions (keep them consistent so the readout groups cleanly):
- `utm_source` = the platform (`reddit`, `discord`, `x`, `newsletter`).
- `utm_medium` = the context (`community`, `social`, `bio`, `dm`).
- `utm_campaign` = what you're pushing (`movers_board`, a post slug, a one-off drop name).
- Lowercase, hyphens/underscores only (anything else is sanitized away anyway).

## Reading the results (founder-only)
```
npm run subscriber-sources                  # active subscribers, all-time
npm run subscriber-sources -- --days 14     # signups in the last 14 days
npm run subscriber-sources -- --all         # include unsubscribed too
```
Prints totals + counts by `source` (surface), `utm_source` (channel), and `utm_campaign`. Uses the service-role key from `.env.local`; no public surface, no third-party tracker. (Requires the `20260629210000_newsletter_subscribers_utm` migration applied — it tells you if the columns are missing.)

## What "is the funnel working?" looks like
A community link → a `/deals` visit → a subscribe → a `newsletter_subscribers` row with `utm_source=reddit`. Run `npm run subscriber-sources` and you can see, per channel, how many of the people you sent actually subscribed — the first real read on which acquisition channel converts.
