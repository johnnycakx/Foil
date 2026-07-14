# QA & Ship Process: Preview-First (ADR-pending)

**Established 2026-07-12** after PR #1 (start-binder-delight). This replaces the "veto tour on localhost" as the default merge gate. Localhost tours remain fine for mid-cycle checks; **merging to main requires a toured Vercel preview.**

## The flow (every feature branch)

1. **Branch + beats.** Agent works on a feature branch, one commit per coherent beat. NO pushes mid-cycle unless John asks for offsite safety.
2. **Gates before push.** tsc clean · full suite 0 fail · build clean · design:lint 0 new · security review no High/Medium · Lighthouse mobile ≥ the standing bar (currently ≥85 local, ≥90 prod) · CLS 0 · 390×844 harness on any UI change.
3. **Push branch + open PR.** PR body must include: what shipped (per beat), the verification record (test counts, Lighthouse, security), the driven-wire evidence if any, and **John's tour checklist** — the specific things only a human can judge, written for a non-engineer.
4. **Vercel preview auto-builds.** vercel[bot] comments the Preview link on the PR (and emails John). Production is untouched.
5. **John tours the preview** — phone first, then desktop. Using the checklist in the PR plus the standing checklist below. Findings get recorded, not fixed live.
6. **Findings triage.** John hands findings to the agent as a verdict (severity-tagged). Blockers/Majors → fix on the same branch → preview rebuilds → re-tour the failed items only. Minors/Polish → agent files them (IDEAS or next-cycle brief) and says so in the PR.
7. **Merge on John's word only.** "Merge it" comes from John, after the tour, never before. Merge → prod deploy → agent verifies prod (Lighthouse ≥90, content markers, smoke path) and reports.

## John's standing tour checklist (phone first)

**Step zero — recording setup (learned the hard way, round 1 was silent):**
- Screen-record the tour WITH narration: Control Center → **long-press** the record button → **Microphone On** (iOS remembers the setting, but verify every time — a silent tour loses its most valuable channel).
- Talk continuously: what you're about to do, what you expected, what actually happened, how it *felt*. Timestamps in speech ("okay 2 minutes in, the rip stuttered") make findings traceable.
- When done, drop the file in `design-loop/tour-videos/` (gitignored — recordings NEVER go into git; a 6-minute 60fps recording is ~700MB). Do not route recordings through Discord: free cap is tiny, Nitro caps at 500MB, and Discord isn't the pipeline — the repo folder is.
- If a tour runs long, consider a separate Voice Memos audio track — same value, ~3% of the size.

**Setup (30 seconds):** notes app open as backup · screenshot anything that feels off · do NOT switch to fixing — a tour that stops to fix loses fresh eyes. You are hunting for what breaks, not admiring what works.

**1. The money path (5 min).** Walk the primary user journey end to end as a stranger would — currently: /start → rip the pack → tap a dealt card → it seats → tag writes → heartbeat line → search/fill remaining sleeves → email submit → confirmation → the alert lands where it should. Any hesitation you feel, a stranger feels double.

**2. Feel pass (3 min) — the part no test can do.** Gestures have weight? (the rip should resist, then give) · tap targets hit on the first try with a thumb · scroll is smooth, nothing janks · keyboard: input focus doesn't zoom the page, doesn't bury the field, submit reachable with keyboard open.

**3. Look pass (3 min).** What's above the fold — does the screen promise the right thing? · light and shadow: one lamp, one signature effect, nothing glowing that shouldn't · text: no orphan whispers, no truncation, prices aligned · dark register on OLED: true matte, no gray wash · rotate the phone once (nothing needs to be perfect in landscape, nothing should explode either).

**4. Break pass (3 min).** Double-tap every submit button · refresh mid-flow · phone back button mid-flow · airplane-mode toggle mid-search (graceful failure, honest message?) · the current limit boundary (today: 9 sleeves accepted, 10th rejected with the page-full line, server-side) · garbage input in every field.

**5. Regression glance (2 min).** Tap through 3 other pages (/deals, a /cards/[slug], the vault) — not a tour, just "did we break the neighborhood."

**Video review (after the tour):** the agent runs `/watch design-loop/tour-videos/<file>` (claude-video skill: ffmpeg frames + Whisper transcript + timestamps; Groq/OpenAI key in `~/.config/watch/.env` for caption fallback, or local faster-whisper). The agent produces the severity-tagged findings list from transcript + frames, cross-referenced against prior rounds in the tour-findings doc, and commits the findings doc only. Known limit: frame sampling cannot judge motion quality (gesture feel, jank, 60fps smoothness) — that channel is John's narration and thumbs, which is why the mic matters.

**Recording findings — severity ladder:**
- **Blocker:** money path broken, data loss, wrong number shown to a user. No merge.
- **Major:** feature works but a stranger would stumble or distrust. No merge without a call.
- **Minor:** works, looks off, fix soon. Merge OK, must be filed.
- **Polish:** taste-level. Merge OK, goes in the next brief.

One line each: `[severity] where — what happened — what you expected`. Hand the list to the agent verbatim; the agent turns it into the next beats.

## Rules for the agent

- Never merge, never push to main, never promote to prod on your own initiative. John's word, after a preview tour, every time.
- Every PR body includes a tour checklist written for the specific change — what needs human eyes and thumbs, in plain words, phone-first.
- Prod verification after merge is your job (Lighthouse, markers, smoke); report unprompted.
- Preview URLs talk to REAL services (Supabase, Resend, Stripe test/live per env). Tour data uses John's `+alias` emails and is flagged deletable. Never seed tour data you can't identify later.

## Vercel notes

- vercel[bot]'s PR comment + email with the Preview link is the expected notification path (first appeared PR #1; it comments on every PR).
- Deployment Protection controls whether preview URLs require a Vercel login. Trade-off: ON = previews private, John logs in once per device; OFF = anyone with the URL can view a preview (URLs are unguessable but shareable). Setting lives in the Vercel dashboard under the project's Settings → Deployment Protection (verify path in the dashboard — do not trust this doc over the live UI, per AGENTS.md external-platform rule).
