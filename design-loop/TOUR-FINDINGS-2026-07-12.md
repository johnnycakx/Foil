# Preview Tour Findings — PR #1, 2026-07-12

**Source:** John's 4-min phone screen recording (iPhone, 390pt, preview URL `foil-git-start-binder-delight-foilapp.vercel.app`), reviewed frame-by-frame (48 frames @5s). No narration (mic was off — iOS default; long-press record → Microphone On next time).

## Verified end-to-end (PASS)

Home hero → "Start your vault" → /start (`?src=home-hero`) → pack opens → cards deal ("Fresh from the wrapper. Tap one to sleeve it.") → demo Articuno kept, target price $22 set via numeric keypad (right-aligned field) → 9 sleeves filled across ~2 min (suggestion rows used: Wailord/Skarmory/Ceruledge/Weezing/Mew ex/Mesprit/Latios, all "Also from «set» · Sleeve it", dismissible) → CTA counter live-updated 2→3→4→7→8→9 → empty-email submit correctly blocked → email entered → "Setting up…" → success: "FOIL IS WATCHING 9 CARDS FOR YOU / The binder is yours. Foil takes the watching."

Cycle-3 items confirmed on device: pack above the fold at 390 (A8) · hero-scale pack (A1) · one whisper ("tell Foil your grail") (A6) · no "EMPTY", no Pro wall — single quiet line "The rest of the binder opens with Pro" (A3) · time-honest heartbeat "Foil checks this page tomorrow" (beat 2) · "X of 9 sleeves filled" counter (A7).

## Findings

1. **[Major] Written tag truncates to "Foil suggests: un…" on every card in the 3-column grid.** The penciled price — the product's signature beat — is unreadable at the exact surface mobile users see most. User-set tags ("$22") fit; every suggested tag chops. Fix direction: in grid context drop the "Foil suggests:" prefix (the tag IS Foil's suggestion — "under $15" alone), or wrap to two lines, or fit-text. Small fix, big meaning.
2. **[Minor] Empty-email submit shows the browser-native "Fill out this field" bubble.** Off-voice. Replace with inline canon-voice validation ("Foil needs an address to write you."). Keep it honest, no toast.
3. **[Minor] Post-success page still leads with the full recruiting hero** ("Fill a page with what you're chasing.") above the success slab. Once the binder is claimed, the success state should lead; the old hero invites re-doing a finished thing.
4. **[Cleanup] Tour used John's real email (realjohncraig@icloud.com), not a QA alias** — a live 9-card watch now fires daily to his personal inbox. Either delete the row or adopt it as deliberate dogfooding; if kept, it is no longer test data (QA-PREVIEW-PROCESS rule: tour data must be identifiable).
5. **[Untested] The 10th-card / page-full server rejection was not exercised** (submit happened at exactly 9). Still needs one live check before we call the cap verified end-to-end on prod.

## Verdict (recommendation)

Hold the merge for **finding 1 only** — it's a contained copy/CSS fix on the branch, and mobile screenshots are exactly what will circulate when this page ships. Findings 2 and 3 can ride the cycle-3.5 search beat. Then merge.

---

# Round 2 — 2026-07-12, 6:40 narrated phone tour (GKMO5875.MP4)

**Source:** John's 6:40 iPhone screen recording **with narration** (mic on this time), preview URL `foil-git-start-binder-delight-foilapp.vercel.app`. Reviewed as 100 scene-aware frames (768px) + a full timestamped transcript (no Groq/Whisper API key in any env — transcribed locally with faster-whisper `small`; language-detect p=1.00). Timestamps below are video-relative. Tour shape: home audit (0:00–1:10) → /start flow #1 to a 4-card submit + success (1:10–3:40) → back, flow #2 filling all 9 sleeves (3:40–4:50) → sleeve search "Char" (5:02–5:20) → Pro line + /pro (5:58–6:40).

## Verified end-to-end (PASS)

Money path again passes on the real Vercel preview: home → Start your vault → /start → sleeve via tap + suggestion rows → target price via numeric keypad ("9" → "$9") → email → "Setting up…" → success slab "FOIL IS WATCHING 4 CARDS FOR YOU." Counter live-updates 1→9 across the second fill and the button label tracks it ("Foil watches N cards →"). **Sleeve search works** (the cycle-3.5 beat): "know the exact card? type it" → "What are you chasing?" → typing "Char" returns real results, tracked cards get "+ Track," untracked cards render greyed "Not yet tracked." /pro renders the locked offer ($6/mo, 30-day trial, "Free fills a binder page (9 cards)"). Demo Articuno "put it away" control present; "The rest of the binder opens with Pro" line present; heartbeat line present.

## Findings

1. **[Blocker] The Pro upgrade path dies on a server error.** From /pro, clicking through (the trial CTA) renders the browser error page "This page couldn't load — A server error occurred. Reload to try again. ERROR 572704498" — reproduced twice with a reload between (6:15, 6:34). John on tape: "Oh, page couldn't load… so right now Pro doesn't even work" (6:30–6:38). May be preview-env config (missing Stripe keys on preview deployments) rather than branch code — but that must be *proven*, not assumed, before merge; if it's env-only, record why prod is unaffected.
2. **[Major — round-1 finding 1 NOT FIXED] Written-tag truncation persists.** All nine filled sleeves in flow #2 read "*Foil suggests: un…*" (4:31–4:50 frames); same on flow #1's grid. Narration: "you can't really see the exact suggestion unless you click on it" (2:13). This was the round-1 merge-blocker and it survived the round untouched. Related flicker: a sleeve first renders "any good price," then rewrites to the truncated suggestion when data loads (Shaymin, 4:31→4:32) — the pencil visibly changes its mind.
3. **[Major] "Start your vault" CTA gives zero press/loading feedback.** "No design engineering… no reaction at all, no indication that we're loading onto a new page, which is a massive issue" (0:59–1:10). Add pressed state + immediate navigation feedback.
4. **[Major] Sleeving on mobile loses your place.** Tapping "Sleeve it" on a suggestion row gives no confirmation and doesn't return the viewport to the binder — "super wonky… it doesn't pull back up on mobile when you add a card… keep everything up here in the top" (3:49–4:03).
5. **[Major] Post-submit success is a dead end.** "More word jargon… no visual storyboard or progression… just kind of a dead end with nowhere to go" (3:03–3:30). Supersedes round-1 finding 3 — the recruiting-hero-above-success complaint is now the smaller half; the ask is a designed next step (vault link is buried in copy, not a CTA).
6. **[Major — direction] The page isn't following the agreed reference direction (the baothiento.com/ADR-115 register).** Repeated on tape: "the UI is pretty boring and white… we still have the black background… doesn't really look like Bao's designs at all" (2:16–2:33, transcript renders it "bowels"); "we want this to feel like a binder… pull some type of emotion" (3:14–3:22); "tell the story through images, motion, graphics — not all language; we want to use video as well" (6:21–6:30). Also: "the pack doesn't look like a pack — blue and kind of boring" (1:17–1:26), which was cycle-3 A1's hero object. This is cycle-4 scope, not a patch.
7. **[Minor] The dealt fan clips the first card offscreen at 390pt.** "Articuno is kind of chopped off over here on mobile, we can only see a little part of it" (1:56–2:02; visible in the 2:28 and 3:46 frames).
8. **[Minor — round-1 finding 2 NOT FIXED] Empty-email submit still shows the native browser bubble.** "We got to fill out this field" (2:48). The canon-voice inline validation hasn't landed.
9. **[Minor] Suggestion-row loading desync.** The row's text swaps before its thumbnail: the "Pikachu — Also from 151" row briefly shows Skarmory's art (4:10→4:13), and the Weezing row first paints with an empty thumbnail box (3:52). Small, but it reads as the product being wrong about a card — the exact thing Foil can't afford.
10. **[Minor] Search entry + panel are too small and too low.** "There is still no search for the cards at the top" (2:03); "know the exact card? type it — oh, that's really small… the search is really small" (5:02–5:10). Works, but discoverability and hit-area are under-sized for the money feature of cycle 3.5.
11. **[Polish] Copy density + stray voice artifacts.** Home: "a lot of words, not a lot of explaining" (0:44); the 🌸 emoji in "Post your card 🌸" (0:52); the "Not sure where to start / Foil packed / today's most-chased" line "doesn't read like we want it to" (1:28–1:49); "Foil checks this page tomorrow… you can probably get rid of that" (4:59); success-slab wording called "word slop" (3:03). Home design graded "a solid seven out of ten" (0:21).
12. **[Cleanup] Real emails again — twice.** `john@salecore.com` was SUBMITTED (a live 4-card daily watch now exists against a real inbox), and `realjohncraig@icloud.com` was typed at the 9-card fill (submit not shown on camera). Round-1 finding 4 repeated; QA-PREVIEW-PROCESS requires identifiable `+alias` tour data. Both watch rows (plus round 1's 9-card watch) need a delete-or-adopt decision.

## Product decisions captured on tape (→ IDEAS / next brief)

- **Untracked cards should be addable, not dead ends** (5:19–5:59): let the user sleeve an untracked card, offer "request tracking," notify when the data lands — "they will not immediately leave… they will stay because of the promise." Today "Not yet tracked" rows are inert.
- **Duplicate-email behavior is an open UX question** John asked himself on camera (2:55) and the UI never answered — resubmitting an existing email shows the same generic success. Decide what an existing subscriber should see.
- **Video/motion-first storytelling** (6:21–6:30) — consistent with `design-loop/VIDEO-FIRST-DIRECTION.md`.

## Still untested after two rounds

- **The 10th-card server rejection** — both tours stopped at exactly 9; the page-full line has never been seen on a device.
- **The 9-card submit** — flow #2's submit never happened on camera (the tour pivoted to search, then Pro), so the full-page watch creation is unverified.
- **Duplicate-email resubmit** — asked, not answered (see above).

## Verdict (recommendation)

Hold the merge for **findings 1 and 2**: root-cause the /pro server error on the preview (prove it's env-only or fix it), and actually land the tag-truncation fix — it has now blocked two consecutive tours. Findings 3–5 and 7–10 are contained branch fixes that should ride along before a re-tour of just the failed items; 6 and the product decisions are the cycle-4 brief, not merge-gates. Before calling the cap verified, one deliberate 10th-card attempt on the preview.
