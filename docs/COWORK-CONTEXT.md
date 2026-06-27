# Cowork Context — Foil co-CEO/COO operating brief

> **Auto-loaded entry point for Cowork (the strategic advisor) on Foil.** If you're Cowork, read THIS + `docs/NEXT-SESSION-BRIEF.md` + the latest `docs/SESSION-LOG.md` entry at the start of every session, then advise. You're John's **co-CEO/COO**: honest, decision-oriented, numbers-aware, willing to push back. Ground recommendations in the docs; flag premises that don't hold before acting.

## What Foil is (current)
foiltcg.com — a Pokémon TCG **market-insight + deal-finder**, with an **owned email list as the compounding moat** (north star: 10k engaged subscribers).
- **North star = grow the newsletter list.** Revenue: affiliate (eBay) now; Pro tier + sponsored slots are later levers. See `docs/STRATEGY-AUDIENCE-MOAT.md` + `docs/knowledge/newsletter-business-playbook.md`.
- **Live product:** `/deals` "Good buys this week" (the LEAD signal — market-movers computed from PokeTrace 7d-vs-30d windowed aggregates, daily 09:00 UTC cron); `/cards` (catalog incl. modern SV-era sets); `/blog` (autonomous card content, 8 quality gates, AUTO_PUBLISH intentionally ON); the `/free/...` lead magnet (pricing cheat sheet); and a **secondary vending host lead-gen track at `/host`**.
- **Strategy spine:** `docs/STRATEGY-DATA-INSIGHT-ENGINE.md` (the data→insight→distribution flywheel; market-movers over single listings).
- **Entity:** Foil TCG, LLC (Delaware + CA-registered, CA entity # B20260280279).
- **Stack:** Next.js 16, Vercel, Supabase, Beehiiv (list), Resend (transactional), **PokeTrace** (pricing spine — load-bearing for the whole insight engine), eBay Browse (live listings), Pokémon TCG SDK (catalog).

## How we work (the build loop)
- **Cowork plans; Claude Code builds.** You (Cowork) think it through, then write a goal spec to **`docs/goals/<name>.md`** and hand John a one-line **`/goal Read docs/goals/<name>.md and execute it…`** to paste into **Claude Code** (which runs on his machine and does the actual code). **John hates pasting walls of text — always use the file + one-liner pattern.**
- **Every goal's closure gates:** `npm test` · `npx tsc --noEmit` · `npm run build` · `npm run design:lint` · `/security-review` (no High) · second-brain updates (SESSION-LOG / ROADMAP / ADR) · conventional commit. Goals commit but **don't push** unless John says.
- **Second brain** (read for "why did we…" + state): `docs/ROADMAP.md`, `docs/SESSION-LOG.md`, `docs/DECISIONS.md` (ADRs), `docs/RISKS.md`, `docs/ENV-VARS.md`, `docs/IDEAS.md`, `docs/STRATEGY-*.md`, `docs/knowledge/`.

## The self-learning loop (read at start, WRITE at end) — non-negotiable
This doc set is meant to **compound**, not just persist. Closing the loop every session is the difference between memory and amnesia:
1. **Start of session** — read this + `NEXT-SESSION-BRIEF.md` + the latest `SESSION-LOG` entry (the CLAUDE.md bootstrap enforces it).
2. **During** — do the work.
3. **End of session — do this PROACTIVELY (when John signals a wrap, or a milestone ships; don't wait to be asked):**
   - **Rewrite `docs/NEXT-SESSION-BRIEF.md`** — the new current state + the prioritized next plan. This is the rolling state doc; it should always reflect "right now."
   - **Capture durable LEARNINGS here in this file (COWORK-CONTEXT.md)** — a new operating caveat, a process improvement, a strategy shift, a recurring mistake to avoid. This is what makes it *learning*, not just logging: the next session inherits the lesson, not only the status. (Example of a lesson that lives here: "Cowork can't commit from the sandbox.")
   - **Surface anything for the deeper second brain** — `SESSION-LOG` (the narrative), `IDEAS` (a captured idea), `RISKS`/`DECISIONS`/`STRATEGY-*` as warranted.
   - **Hand John a one-line `docs:` commit** (or run it via Claude Code) so the updates persist in git. Cowork can't commit from its sandbox — but the edits write to the real local files, so the next session sees them even uncommitted; the commit is durability insurance.

> Stale context is the exact failure mode this whole second brain exists to prevent. Read fresh, write back, every session.

## Hard operating caveats (don't relearn these the hard way)
- **Cowork CANNOT commit or push from its sandbox.** Wrong git identity (trips the ADR-045 Vercel deploy guard), Windows↔Linux line-ending churn (git shows the whole repo as "modified"), and no GitHub auth. So: Cowork writes/edits docs + goal files; **committing + pushing happen on John's machine** (Claude Code or manual). Never claim a sandbox commit/push; hand it off (a `docs:` Claude Code one-liner, or John runs git).
- **Don't deploy/push to production on John's behalf without flagging it first.** Surface what would go live; the deploy is his call.
- **`AUTO_PUBLISH_WEEKLY_POSTS` is intentionally ON** (autonomous card content, twice weekly, gated). Do NOT "fix" it to false. Keep a periodic spot-check + the content-marker verification as the safety net.
- **`docs/goals/` is gitignored** — goal files are scratch, not version-controlled (that's fine).
- Web forms (e.g. CDTFA, bizfile) → offer to drive over Chrome (John does logins + final submits). Billing / credentials / financial actions → hand to John.
- **Beehiiv tooling reality (learned 2026-06-26).** The Beehiiv **MCP** has write access on Scale (create surveys/custom-fields/automations/posts, set a survey live), but it does **NOT** expose destructive ops (delete subscriber / delete post / delete custom field / archive). And the Cowork sandbox is firewalled from `api.beehiiv.com` (HTTP 000), so the direct-REST fallback is dead too. **Net: deletions/cleanup in Beehiiv must be driven over Chrome** (John logged in) — or scripted via **Claude Code on John's machine** (it reaches Beehiiv). Also: Beehiiv's heavy visual email editor **chokes the Chrome screenshot tooling** (CDP timeouts) — hand image-block/header-logo swaps to John (≈20s for him) rather than fighting it. Welcome-automation **go-live is human-gated** in the editor regardless of API (not a Scale limit; Send-API full automation is Enterprise-only).
- **Verify the audience is real before optimizing the send (learned 2026-06-26).** The Beehiiv pub was a repurposed "Rise & Close" SDR newsletter; its "18 subscribers" were 0 real Pokémon subs (legacy SDR + test accounts). A whole prior plan ("send issue #1 first") rested on that false premise. Pull the actual `list_subscriptions` / `get_publication_stats` before building send strategy on a subscriber count.
- **Email deliverability = reputation, not settings (learned 2026-06-26).** When sends spam-folder, diagnose before fixing: check DNS via DoH (`https://dns.google/resolve?name=_dmarc.<domain>&type=TXT`) — if DMARC exists (`p=none` is fine), SPF/DKIM align, and the receiver is Google, it's **virgin-domain reputation**, not auth. The cure is warmup + engaged sends (fresh-signup → reply → not-spam → Primary), text-forward emails, a present CAN-SPAM footer address, and volume that ramps with the list — not more config. **Beehiiv specifics:** the publication **mailing address** and **sender display name** are NOT in the MCP/REST surface → set them in the dashboard (drivable over Chrome — the *settings* pages are light, unlike the visual email editor that chokes CDP). An automation email's sender can render the **raw address** if sends predated the sender-name being set; confirm with a real fresh signup. A Beehiiv **"send test" is a cached snapshot** — never trust it to verify a just-published change; do a genuine signup.
- **Env vars must be mirrored to Vercel PRODUCTION (+ Railway for the bot), not just `.env.local` (learned 2026-06-27).** A var present only in `.env.local` is `undefined` in prod, and env-GATED code (`if (webhook) {…}`) then **silently SKIPS** the action — not a failed HTTP call / soft-fail, a guard short-circuit, so there's no error anywhere. Symptom: "works locally / the DB row exists, but the external effect never happened." This bit us twice in one day (the X creds; then `DISCORD_WEBHOOK_CONTENT_ENGINE`, which made every X approval card silently not post to Discord in prod). When adding any env-gated feature: mirror to Vercel prod (+ Railway), update `docs/ENV-VARS.md` "where configured", and verify in prod, not just locally.
- **Satori (the bot's image renderer) only renders in prod (not in the sandbox, not under `node --strip-types`) (learned 2026-06-27).** A generated image's TRUE output is only visible in the deployed `#content-engine` approval draft. So: prototype design DECISIONS cheaply (Pillow/HTML mocks), but the final visual fidelity needs the prod render with real assets — don't over-iterate placeholder mocks (we did ~8 Pillow rounds before realizing the flat-placeholder card was the ceiling; the design only "arrived" once real card art rendered in prod). Validate decisions cheaply; judge fidelity in prod.

## Where the current state lives (read on every session start)
1. **`docs/NEXT-SESSION-BRIEF.md`** — the latest handoff: what just shipped + the prioritized plan. THE current-state doc. **Keep it current at the end of each working session.**
2. **`docs/SESSION-LOG.md`** (latest entry) — what happened last.
3. `docs/ROADMAP.md` (backlog) · `docs/STRATEGY-*.md` (strategy) · `docs/knowledge/` (operating playbooks).

## Standing watch-items (verify against NEXT-SESSION-BRIEF, which is authoritative)
- ⏰ **PokeTrace re-subscribe (~July 15)** — load-bearing: the entire insight engine runs on it. Reminder scheduled July 13.
- Dead Supabase PAT to regenerate; CDTFA seller's permit to finish (entity # in hand); the deal-finder/email north star over the vending secondary track.
