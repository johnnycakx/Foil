<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:external-platform-rules -->
# Read the docs before touching any external platform

Before integrating with, calling, or making a claim about any external platform — eBay (Developer, EPN, Browse, Marketplace Notifications), TCGplayer, Stripe, Supabase, Beehiiv, Resend, Vercel, GitHub, Railway, Discord, PokeTrace, PriceCharting, Pokemon TCG SDK, Anthropic, Brave Search, or any other — read the platform's official documentation first.

Do NOT assume from training data:
- API request/response shapes (field names, nesting, optional vs required)
- Auth header formats, OAuth grant flows, or token TTLs
- ID/credential string formats (length, character class, prefix conventions, dash placement)
- Webhook payload structures or the response shape the platform expects back
- Rate limits, quota behavior, or pagination semantics
- Dashboard URL paths or which page exposes which value

If a fact about an external platform is load-bearing for a code path, an env-var name, a runtime check, or a piece of advice to John — that fact must trace back to the official docs URL OR an empirically-verified call (curl, test harness, sandbox round-trip). Not training data. Not memory. Not "I'm pretty sure."

When in doubt, **ask before asserting**. A 30-second clarifying question is cheaper than a goal cycle spent debugging an OAuth call that fails because the grant_type string was wrong, or a 5-minute back-and-forth re-pasting a credential because the format assumption was stale.

This rule exists because training data is stale, platforms change, and the cost of a wrong external-platform assertion is asymmetric — confidence with no source is the failure mode.
<!-- END:external-platform-rules -->
