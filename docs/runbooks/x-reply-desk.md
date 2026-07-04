# X reply desk + in-flow receipts — operating runbook

The one-click X workflow (x-reply-desk, [ADR-107](../DECISIONS.md#adr-107)). Two lanes,
one firewall:

- **User-initiated contact** (mentions of @FoilTCG, replies in our own threads) →
  the **reply desk** posts your Approve'd reply via the X API (one click). X's
  automation rules permit API responses to people who contacted us.
- **Cold replies** (you replying on a stranger's post, quote-tweets, the
  engagement brief) → a prefilled **`x.com/intent/post`** composer opens; **you
  press X's own Post button.** API-posting cold replies is a platform-manipulation
  ban risk and stays human-send FOREVER.

Never unify the lanes. The split is enforced in code (the `lib/engagement/` +
`lib/reply-desk/` firewall tests) and recorded in ADR-107.

---

## 1. In-flow receipts tool (3d) — post directly from X with receipts

Turn any tweet into a prefilled reply carrying Foil's sold-data receipts + the
card-page link, in **≤2 clicks (desktop) / ≤3 taps (mobile)**. The draft NEVER
auto-posts — you press X's Post button.

### One-time setup

1. **Set the endpoint secret.** Generate a random 32+ byte token and set it on
   Vercel production as `X_RECEIPTS_SECRET` (see [ENV-VARS](../ENV-VARS.md)).
   This is the private key the bookmarklet + Shortcut carry. Rotate it any time
   to revoke access (nothing else depends on it).

   ```sh
   # generate one:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   # then: Vercel → foil → Settings → Environment Variables → add X_RECEIPTS_SECRET (Production)
   ```

2. **Install the desktop bookmarklet.** Create a new bookmark in your bookmarks
   bar, name it `Foil receipts`, and paste the code below as the URL — first
   replacing `__PASTE_YOUR_X_RECEIPTS_SECRET__` with the secret from step 1.

   ```js
   javascript:(async()=>{const S='__PASTE_YOUR_X_RECEIPTS_SECRET__';const A='https://foiltcg.com/api/receipts';const u=location.href;if(!/\/status\/\d+/.test(u)){alert('Open a tweet (a /status/ page) first.');return;}let t='';try{t=(document.querySelector('article [data-testid=\"tweetText\"]')?.innerText||'').trim();}catch(e){}const b=document.createElement('div');b.style.cssText='position:fixed;top:16px;right:16px;z-index:999999;max-width:360px;background:#12141c;color:#f3efe6;font:14px/1.5 system-ui,sans-serif;border:1px solid #2a2f3c;border-radius:14px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.5)';b.textContent='Foil receipts…';document.body.appendChild(b);try{const r=await fetch(A,{method:'POST',headers:{'Authorization':'Bearer '+S,'Content-Type':'application/json'},body:JSON.stringify({tweetUrl:u,text:t})});const j=await r.json();if(!j.ok){b.innerHTML='<b>Foil</b><div style=\"margin-top:8px;color:#ff8a7a\"></div>';b.lastChild.lastChild.textContent=j.error||'error';return;}const card=j.resolved?j.resolved.displayName:'No card resolved (asking for set/number)';const h=document.createElement('div');h.style.cssText='font-weight:600;margin-bottom:6px';h.textContent=card;const pre=document.createElement('div');pre.style.cssText='white-space:pre-wrap;background:#0d0f16;border:1px solid #2a2f3c;border-radius:10px;padding:10px;margin-bottom:10px';pre.textContent=j.reply;const go=document.createElement('button');go.textContent='Reply on X';go.style.cssText='background:#c9a24b;color:#12141c;border:0;border-radius:999px;padding:8px 16px;font-weight:700;cursor:pointer';go.onclick=()=>window.open(j.intentUrl,'_blank','noopener');const x=document.createElement('button');x.textContent='Close';x.style.cssText='margin-left:8px;background:transparent;color:#f3efe6;border:1px solid #2a2f3c;border-radius:999px;padding:8px 12px;cursor:pointer';x.onclick=()=>b.remove();b.textContent='';b.append(h,pre,go,x);}catch(e){b.textContent='Foil error: '+e.message;}})();
   ```

   **Use it:** on any x.com tweet, click `Foil receipts`. A small panel appears
   top-right with the resolved card + the drafted reply. Click **Reply on X** →
   X's composer opens prefilled + threaded to that tweet. Press X's Post. Two
   clicks total.

3. **Install the iOS Shortcut** (share sheet). The Shortcuts app can't be
   shipped as a file here; build this recipe once (Shortcuts → + → Add Action):

   - **Receive** `URLs` from the Share Sheet (top of the shortcut, "Receive What's On Screen" → URLs).
   - **Text** action: paste your `X_RECEIPTS_SECRET`.
   - **Get Contents of URL** → `https://foiltcg.com/api/receipts`
     - Method: **POST**
     - Headers: `Authorization` = `Bearer ` + (the Text from the step above);
       `Content-Type` = `application/json`
     - Request Body: **JSON** → key `tweetUrl` = **Shortcut Input** (the shared URL)
   - **Get Dictionary Value** `reply` → **Copy to Clipboard**
   - **Get Dictionary Value** `intentUrl` (from the same Contents of URL) → **Open URLs**

   Name it `Foil receipts`. **Use it:** in X, share a tweet → `Foil receipts`.
   The draft lands on your clipboard and X's composer opens prefilled. Paste if
   needed, press Post. Three taps.

### What the endpoint returns

`POST /api/receipts` (Bearer `X_RECEIPTS_SECRET`, rate-limited, CORS-open) with
`{ tweetUrl?, text? }` returns JSON:

- `mode`: `"receipts"` (resolved card + real figures → gated draft + card link),
  `"figure_free"` (resolved but no sold data we stand behind → the card link,
  no numbers), or `"clarify"` (card not resolvable → asks for set/number).
- `reply`: the exact text to post. `intentUrl`: the prefilled `x.com/intent/post`
  URL (threaded when a tweet URL was given).
- `resolved`, `sold`, `cardPageUrl`, `figuresCited`: for reference.

**Honesty by construction:** every `$` figure in a receipts draft traces to real
`market_movers`/snapshot data (the same figure gate as the engagement engine),
no hedged numbers, no hype, no em dash. An unresolvable card is **never** guessed
— it asks for the set + number instead.

### Coverage note (honest)

Sold figures come from the live `market_movers` cache first, then the committed
`/lines` sold snapshot. A resolved card in neither returns `figure_free` (the
card link, no numbers) rather than a guess. Fuller coverage (a live PokeTrace
sold-history layer with a per-condition spread) is a tracked follow-up; it is
deliberately not a hard dependency because the PokeTrace key lapses ~2026-07-15.

### Acceptance check (do once, live)

On a real tweet about a chase card we have data for (e.g. a Moonbreon or a
Prismatic eeveelution-ex post): click the bookmarklet → confirm the panel shows
the right card + a figure-bearing draft → click Reply on X → confirm X's
composer is prefilled and threaded to that tweet. Then a raw test: bookmarklet on
a tweet that names no specific card → confirm the draft asks for set/number (no
invented figure).

---

## 2. Reply desk (§1) — the eve-detector (one-click reply on user-initiated contact)

Mentions of @FoilTCG and replies in our threads are USER-INITIATED CONTACT — X's
automation rules permit an API response. The desk drafts a reply for each and
delivers a card with **Reply / Edit / Skip**; **Reply API-posts your response
in-thread** (true one click). This is the only lane where the bot posts to X.

### How it runs

- A Vercel cron polls X **3x/day** (~13:07 / 17:07 / 22:07 UTC — collector-active
  hours), dedupes against `reply_desk_items`, and drafts a reply per inbound
  reusing the receipts guardrails (resolver null-over-guess, figures only from
  `market_movers`/snapshot, the figure/hedge gate).
- The foil-bot drains the queue and posts each card to `REPLY_DESK_CHANNEL_ID`
  with **Reply / Edit / Skip**:
  - **Reply** → relays to `/api/reply-desk/approve`, which API-posts the drafted
    reply threaded to the inbound tweet; you get a confirmation with the permalink.
  - **Edit** → a modal opens prefilled with the draft; revise, submit, it posts.
  - **Skip** → recorded, no post.
- **Card-request intake (§3b):** when an inbound names a card, the desk resolves
  it and drafts. If we have sold data → a receipts reply. If not → a "tracking it
  now: <card link>. Drop a target…" reply AND it enqueues demand-driven hydration
  (the card page fills in). Unresolvable text → the reply asks for set/number.
- **Image-bearing mentions (§3e):** a mention with an image whose text we can't
  resolve becomes a **human-look** card (image not auto-answered) — you identify
  the card from the tweet, then it runs the intake. The homepage request widget's
  "front of the queue" promise (ADR-102) is honored via same-day-ish hydration.

### One-time setup (John)

1. Apply the migrations: `SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN supabase db push`
   (adds `reply_desk_items` + the `engagement_brief_items.intent_url` column).
2. Set `X_REPLY_DESK_SECRET` (a fresh 32+ byte token) on **both** Vercel production
   AND the foil-bot Railway service (they must match).
3. Set `REPLY_DESK_CHANNEL_ID` on Railway (the `#content-engine` channel id, or a
   dedicated `#reply-desk`).
4. Ensure `X_BOT_OWNER_DISCORD_ID` is set on Railway (already is for /approve).
5. Set `REPLY_DESK_ENABLED=true` on Vercel production, then push.
6. **First live run (ladder rule — one clean run before trusting):** from your
   personal account, mention @FoilTCG about a chase card → wait for the next cron
   → the card appears in Discord → click **Reply** → confirm the reply posted
   in-thread and the confirmation permalink resolves.

The X write creds (`X_API_KEY` etc.) must be live for the Reply button to post —
the same creds the x-post bot uses. Until they're valid, Reply soft-fails with an
error on the card (nothing is posted).

## 4. Bio-link attribution (§4)

The @FoilTCG bio website should be `foiltcg.com/x`, which 302s to
`/?utm_source=x&utm_medium=bio&utm_campaign=profile` (the `utm_campaign=profile`
tag was added this goal — the redirect previously dropped it). This is the whole
reply→signup proof chain: a click from the bio is attributable in
`npm run subscriber-sources`. **John:** confirm the bio website field on X is set
to `https://foiltcg.com/x` (30-second check in X profile settings). ✅ Code side
done (the redirect carries the full UTM, pinned in `proxy.test.ts`).

## 5. Daily rhythm (the human contract)

The desk delivers cards **3x/day**; your contract is to **clear the queue at least
daily**. The one-click design IS the habit — there is deliberately no streak
gamification or nag machinery.

- Backstop: **`/pending`** (owner-only bot command) lists the unactioned reply-desk
  cards, highest-reach first, so nothing gets buried if you scrolled past it.
- Session cadence (the proven X pattern from the growth playbook): **two 10–15 min
  reply sessions/day beat one long one** — X rate-limits, and being early wins the
  top-reply/QT slots. The cron's ~13/17/22 UTC cadence is built for that rhythm.
- The receipts bookmarklet (§1) is for when you're already in the replies on X and
  want to attach receipts to something the desk didn't surface.

