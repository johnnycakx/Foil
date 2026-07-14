# Foil Design Direction: Analog Texture + Video-First Demos

**Status:** Proposal (2026-07-12). Extends DESIGN.md canon — does not supersede any ADR.
**Inspiration:** Bao To's design-engineer workflow (baothiento.com / DemoStudio / Scraps): warm paper surfaces, hand-made object metaphors, and every feature presented as a short motion demo instead of a static screenshot.

---

## 1. The thesis

Foil's canon already IS the warm analog direction — cream paper (#f8f5f0), navy ink, Fraunces serif, the hanko seal, and a growing family of physical-object components (binder desk, booster pack rip, written pencil tag, heartbeat line). What Bao's work adds is not a new aesthetic; it's two disciplines Foil hasn't formalized:

1. **Texture through objects, not overlays.** The analog feel should keep coming from things that behave like physical objects (a pack that tears, a tag written in pencil, a card that tilts), never from a literal grain/texture wallpaper. DESIGN.md already killed the seal-watermark wallpaper and bans tiled textures in the night register — this direction doubles down on that call rather than fighting it.

2. **Video-first presentation.** Every marketing surface leads with a short, silent, looping demo of the real product doing the real thing. Bao ships a demo video for every project; Foil's interactions (rip, write, tilt, heartbeat) are *made* for this — they are motion-native and currently invisible in static marketing.

## 2. What stays untouchable (canon guardrails)

These rules from DESIGN.md constrain everything below: cream/navy foundation with No-Pure-Black-Or-White; Scarce Gold (≤10%, wordmark-only on night); Coral-Hover-Only; sakura as THE functional accent; Flat-At-Rest with navy-tinted shadows; hero paints instantly (never reveals, never a blocking video); one signature effect per page; `prefers-reduced-motion` = fully static; and the four anti-references (no AI-SaaS template, no crypto-hype, no sterile enterprise, no coupon-bin).

## 3. Texture: the "handled object" layer

The move that transfers from Bao is that his surfaces feel *touched by a person* (sketch strokes, drawn frames, donut-hole whimsy) without ever reading as a texture pack. Foil's equivalent, ranked by fit:

**Tier 1 — already shipped, amplify these.** The pencil-written tag (`.tag-pencil`, write-on animation), the booster pack rip (drag-to-tear with real card data), the heartbeat line ("Foil checks this page tomorrow"), and holo-tilt. These four are the brand. Every new feature should ask: "what does this look like as a physical object on the desk?" before it gets a generic card layout.

**Tier 2 — cheap extensions, cream register only.**
- *Pencil underline* as the hand-made accent: a single slightly-irregular SVG stroke (one path, currentColor, ~200 bytes) under one key phrase per page. Replaces nothing; it's the analog cousin of the gold link-underline. Never more than one per view — same scarcity logic as gold.
- *Sleeve edges* on card thumbnails: the existing hairline border plus a 1px inner highlight reading as a penny-sleeve, instead of a plain rounded rect. Pure CSS, no assets.
- *Index-tab navigation* on binder-adjacent surfaces (/w vault, /start): section tabs shaped like binder dividers rather than generic pills. Only where the binder metaphor is already live.

**Tier 3 — declined.** Global paper-grain overlay (violates the no-tiled-texture guard, costs LCP on pages already fighting font-swap repaints), torn-paper section dividers (coupon-bin energy), and any hand-drawn illustration system requiring ongoing art production. If grain is ever revisited, it's a single `<feTurbulence>` SVG filter on ONE hero slab on cream register, behind an ADR.

## 4. Video-first demo system

### 4.1 Asset grammar

Every demo asset follows one grammar so the library stays coherent:

- **Length:** 6–15s, loops seamlessly. One interaction per clip — the rip, the tag write, the vault add. No montages.
- **Stage:** real product UI on its real register (night for the funnel, cream for /lines and pillars), captured at 2x, cropped tight to the object. No fake data — the demo card IS the labeled example (matches the `/start` demo-card rule already in tests).
- **Motion:** starts mid-rest, acts, returns to rest for the loop. Cursor visible on desktop clips (the hand is the point), invisible on mobile clips.
- **Silence:** no audio track at all (not muted — absent). Captions in cream/navy type if words are needed.
- **Ratios:** 4:3 master (Bao's choice — reads as "object on desk," not cinema), 1:1 and 9:16 exports for social. 390px-safe: verify legibility at mobile width, same bar as the current mobile verification beats.

### 4.2 Production pipeline (build on what exists)

`design-loop/` already has a Playwright screenshot rig (`shoot-*.mjs`) and a perf belt. Extend it, don't replace it:

1. **Capture:** Playwright `recordVideo` against localhost, driving the interaction via the same selectors the tests use (`.pack-card`, `.tag-pencil`, `.heartbeat-dot`). One `demo-*.mjs` script per asset so demos regenerate after any visual change — demos become a build artifact, not a one-off recording. This is the DemoStudio idea implemented as code.
2. **Post:** ffmpeg pass — trim to loop point, 2x→1x downscale (crisp), encode `av1/webm` + `h264/mp4` fallback, extract poster frame as AVIF. Target ≤1.5MB per clip.
3. **Host:** `public/demo/` short-term; a media subdomain (media.foiltcg.com, mirroring Bao's media.joinscraps.com) once there are >5 assets, so clips are CDN-cached and shareable raw.
4. **Embed component** (`components/demo-clip.tsx`): poster-first `<video>` with `preload="none"`, IntersectionObserver play/pause, `playsinline muted loop`, poster = LCP-safe AVIF. `prefers-reduced-motion` renders the poster only. Never above the fold on the hero (hero paints instantly — canon).

### 4.3 Where demos go (priority order)

1. **`/start` marketing sections** — the rip and the pencil tag, below the fold. This page's whole pitch is the interaction; show it before asking for the interaction.
2. **Social/Reddit** — clips are the honest-AEO unit: a 10s rip demo attached to a genuine answer in r/mtgfinance beats any copy. Postiz is already available for scheduling.
3. **Weekly market email** — poster frame linking to the live page (video in email is a deliverability trap; the plain-text founder voice stays).
4. **Product Hunt / launch surfaces** — the 4:3 masters slot directly into PH's gallery format (where DemoStudio earned its #7).
5. **README / docs** — the repo sells the product to collaborators too.

### 4.4 First three assets

1. `demo-pack-rip` — booster pack drag-to-tear on night register, desktop cursor. The signature.
2. `demo-tag-write` — pencil writes the suggested price on the tag, then the heartbeat line completes. The trust story ("Foil checks this page tomorrow") in 8 seconds.
3. `demo-vault-add` — /cards/[slug] → "Add to vault" → card lands in binder spread. The retention loop.

## 5. Sequencing

**Beat 1 (this cycle):** `demo-clip.tsx` + `demo-pack-rip.mjs` capture script; one clip live on /start below the fold; perf belt confirms zero LCP regression.
**Beat 2:** remaining two clips; social exports; first Reddit/X posts using them.
**Beat 3:** pencil-underline + sleeve-edge Tier-2 textures behind a small ADR; media subdomain if asset count warrants.
**Beat 4:** demo regeneration wired into the design-loop so clips re-render when components change.

## 6. Open questions for John

1. Media subdomain now or after 5+ assets?
2. Should the demo card in clips be a fixed "mascot" card (recognizable across all assets, à la Bao's consistent visual characters) or rotate with real deals?
3. Tier-2 pencil underline: worth an ADR this cycle, or park until the video beats land?
