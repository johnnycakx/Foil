// The vault — token-access watchlist page (watchlist-web-app, ADR-093).
// Pins the acceptance criteria:
//   - Token: unguessable, constant-time verified, context-separated from the
//     unsubscribe token (an unsubscribe token can NEVER open a vault);
//     tampering fails; no email in the URL.
//   - The page 404s on any bad token (structural pin) and is PUBLIC (proxy).
//   - Pause/resume semantics: vault + unsubscribe pauses resumable;
//     complaint pauses are NOT (ADR-090/093) — pinned at the action layer.
//   - The alert engine's suppression only counts unsubscribe/complaint
//     sources (a vault pause never makes new watches dead).
//   - Recovery + welcome email carry the link; recovery never discloses
//     account existence (structural pins).
//   - /start + the card form + alert emails all distribute the link.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildVaultUrl, mintVaultToken, verifyVaultToken } from "../vault-token.ts";
import { mintUnsubscribeToken, verifyUnsubscribeToken } from "../unsubscribe-token.ts";
import { vaultEmailBody, vaultEmailSubject } from "../wishlist/vault-email.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const SECRET = "test-secret-key-that-is-long-enough";

function withSecret<T>(fn: () => T): T {
  const prev = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  process.env.UNSUBSCRIBE_TOKEN_SECRET = SECRET;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.UNSUBSCRIBE_TOKEN_SECRET;
    else process.env.UNSUBSCRIBE_TOKEN_SECRET = prev;
  }
}

test("vault token: mint → verify round-trip; email embedded in the payload, not the URL", () => {
  withSecret(() => {
    const token = mintVaultToken("Collector@Example.com");
    assert.ok(token);
    const v = verifyVaultToken(token!);
    assert.ok(v.ok);
    if (v.ok) assert.equal(v.email, "collector@example.com");
    const url = buildVaultUrl("collector@example.com", { baseUrl: "https://foiltcg.com" });
    assert.ok(url!.startsWith("https://foiltcg.com/w/"));
    assert.doesNotMatch(url!, /collector@example\.com/, "the raw email never appears in the URL");
  });
});

test("vault token: tampering fails closed (payload swap, signature bitflip, truncation)", () => {
  withSecret(() => {
    const token = mintVaultToken("victim@example.com")!;
    const [payload, sig] = token.split(".");
    // Payload swapped for another email, original signature kept.
    const other = mintVaultToken("attacker@example.com")!.split(".")[0];
    assert.equal(verifyVaultToken(`${other}.${sig}`).ok, false);
    // Signature bitflip.
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    assert.equal(verifyVaultToken(`${payload}.${flipped}`).ok, false);
    // Truncation + garbage.
    assert.equal(verifyVaultToken(payload).ok, false);
    assert.equal(verifyVaultToken("garbage").ok, false);
    assert.equal(verifyVaultToken("").ok, false);
  });
});

test("audience separation: an unsubscribe token can NEVER open the vault (and vault → unsubscribe also fails)", () => {
  withSecret(() => {
    const unsub = mintUnsubscribeToken("victim@example.com")!;
    const asVault = verifyVaultToken(unsub);
    assert.equal(asVault.ok, false, "the context-separated HMAC must reject cross-audience tokens");
    // And the reverse: a vault token is not a valid unsubscribe token either.
    const vault = mintVaultToken("victim@example.com")!;
    assert.equal(verifyUnsubscribeToken(vault).ok, false);
  });
});

test("missing secret → tokens unmintable and unverifiable (soft-fail, no broken links)", () => {
  const prev = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  delete process.env.UNSUBSCRIBE_TOKEN_SECRET;
  try {
    assert.equal(mintVaultToken("x@example.com"), null);
    assert.equal(buildVaultUrl("x@example.com"), null);
    assert.equal(verifyVaultToken("anything.anything").ok, false);
  } finally {
    if (prev !== undefined) process.env.UNSUBSCRIBE_TOKEN_SECRET = prev;
  }
});

test("/w is PUBLIC (token IS the auth) — segment-scoped so /whatever stays gated", async () => {
  const { isPublicRoute } = await import("../supabase/public-routes.ts");
  assert.equal(isPublicRoute("/w"), true);
  assert.equal(isPublicRoute("/w/some-token"), true);
  assert.equal(isPublicRoute("/whatever"), false);
});

test("vault page: bad token → notFound(); private URL space is noindexed (structural)", () => {
  const src = read("app/(site)/w/[token]/page.tsx");
  assert.match(src, /if \(!verified\.ok\) notFound\(\)/);
  assert.match(src, /robots: \{ index: false/);
  assert.match(src, /force-dynamic/);
});

test("vault actions: every write is scoped to token-email AND row id; complaint pauses are not resumable (ADR-093)", () => {
  const src = read("app/actions/vault.ts");
  // Every row mutation carries both scopes.
  const emailScopes = (src.match(/\.eq\("email", auth\.email\)/g) ?? []).length;
  assert.ok(emailScopes >= 4, "update/pause/resume/remove must all be email-scoped");
  // Resume never clears a complaint-sourced pause.
  assert.match(src, /\.neq\("paused_source", "complaint"\)/);
  // Pause writes the vault source (freely resumable, never suppression).
  assert.match(src, /paused_source: "vault"/);
});

test("suppression counts only unsubscribe/complaint — a vault pause never kills new watches (ADR-093)", async () => {
  const { SUPPRESSION_SOURCES } = await import("../wishlist/pause.ts");
  assert.deepEqual([...SUPPRESSION_SOURCES], ["unsubscribe", "complaint"]);
  const pauseSrc = read("lib/wishlist/pause.ts");
  assert.match(pauseSrc, /\.in\("paused_source", SUPPRESSION_SOURCES/);
  // resumeWatchlistAlerts skips complaint rows.
  assert.match(pauseSrc, /\.neq\("paused_source", "complaint"\)/);
});

test("recovery flow: uniform response, sends only when rows exist (structural — no account disclosure)", () => {
  const src = read("app/actions/vault.ts");
  assert.match(src, /return \{ ok: true \}; \/\/ uniform response/);
  assert.match(src, /if \(\(count \?\? 0\) > 0\)/);
  const page = read("app/(site)/w/page.tsx");
  assert.match(page, /If that email has a vault, the link is on its way/);
});

test("vault link email: welcome + recovery subjects, one link, private-link warning, no images/buttons", () => {
  const welcome = vaultEmailBody({
    kind: "welcome",
    vaultUrl: "https://foiltcg.com/w/tok",
    unsubscribeUrl: "https://foiltcg.com/api/unsubscribe?token=u",
  });
  assert.match(welcome, /Your vault is open/);
  assert.match(welcome, /https:\/\/foiltcg\.com\/w\/tok/);
  assert.match(welcome, /treat it like a private calendar link/);
  assert.doesNotMatch(welcome, /<img/i);
  assert.equal(vaultEmailSubject("welcome"), "Your Foil vault is open");
  assert.equal(vaultEmailSubject("recovery"), "Your Foil vault link");
});

test("the link is distributed everywhere (structural): /api/start response, /start screen, card form, alert email", () => {
  assert.match(read("app/api/start/route.ts"), /vault_url:/);
  assert.match(read("app/api/start/route.ts"), /sendVaultLinkEmail\(email, "welcome"\)/);
  assert.match(read("components/start-page-form.tsx"), /Open your vault/);
  assert.match(read("app/actions/create-watchlist.ts"), /vaultUrl: isFirstWatch \? buildVaultUrl/);
  assert.match(read("components/cards/watchlist-form.tsx"), /Open your vault/);
  assert.match(read("lib/wishlist/scan-batch.ts"), /manageUrl: buildVaultUrl/);
});

test("HIGH fix: the inline vault link is returned ONLY for a first-watch (no pre-existing vault to leak)", () => {
  // /security-review HIGH: echoing buildVaultUrl(email) to an unauthenticated
  // submitter turned "knows your email" into "reads/edits your existing
  // watchlist." The link is now inline only when there's nothing pre-existing;
  // existing vaults are inbox-only.
  const startSrc = read("app/api/start/route.ts");
  assert.match(startSrc, /vault_url: isFirstWatch \? \(buildVaultUrl\(email\) \?\? undefined\) : undefined/);
  assert.match(startSrc, /vault_link_emailed: isFirstWatch/);
  const actionSrc = read("app/actions/create-watchlist.ts");
  assert.match(actionSrc, /vaultUrl: isFirstWatch \? buildVaultUrl\(parsed\.value\.email\) : null/);
  // The success screens fall back to "check your inbox" copy.
  assert.match(read("components/cards/watchlist-form.tsx"), /vaultLinkEmailed/);
  assert.match(read("components/start-page-form.tsx"), /vaultLinkEmailed/);
});

test("MEDIUM fix: complaint is an ABSORBING pause state — escalates over an existing vault/unsubscribe pause", () => {
  // The IS-NULL pause gate can't re-source an already-paused row, so a user who
  // vault-paused then filed a complaint would keep 'vault' — vault-resumable +
  // not counted as suppression. pauseWatchlistAlerts now escalates every
  // already-paused, not-yet-complaint row to 'complaint' when source is complaint.
  const src = read("lib/wishlist/pause.ts");
  assert.match(src, /if \(source === "complaint"\)/);
  assert.match(src, /\.update\(\{ paused_source: "complaint" \}\)/);
  assert.match(src, /\.not\("alerts_paused_at", "is", null\)\s*\.neq\("paused_source", "complaint"\)/);
});

test("MEDIUM fix: recovery form is guarded (honeypot + per-IP limit) and sends off the response path (timing)", () => {
  const src = read("app/actions/vault.ts");
  assert.match(src, /String\(formData\.get\("website"\)/, "honeypot");
  assert.match(src, /recoveryLimiter\.check\(ipKey\)/, "per-IP budget");
  assert.match(src, /after\(async \(\) => \{/, "send off the response path (no timing oracle)");
  assert.match(read("app/(site)/w/page.tsx"), /name="website"/, "honeypot field on the form");
});

test("LOW fix: unsubscribe verifier rejects a repackaged cross-context payload explicitly (not via JSON.parse accident)", async () => {
  const prev = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  process.env.UNSUBSCRIBE_TOKEN_SECRET = SECRET;
  try {
    const { verifyUnsubscribeToken } = await import("../unsubscribe-token.ts");
    // A vault token, fed to the unsubscribe verifier, must fail bad_payload
    // (the '{'-first-byte guard), never verify.
    const vaultTok = mintVaultToken("victim@example.com")!;
    const v = verifyUnsubscribeToken(vaultTok);
    assert.equal(v.ok, false);
    // And the vault page sets a same-origin referrer policy.
    assert.match(read("app/(site)/w/[token]/page.tsx"), /referrer: "same-origin"/);
  } finally {
    if (prev === undefined) delete process.env.UNSUBSCRIBE_TOKEN_SECRET;
    else process.env.UNSUBSCRIBE_TOKEN_SECRET = prev;
  }
});

test("binder doctrine (structural): pocket grid, page-turn pagination, one motion-safe settle, no loading gate", () => {
  const src = read("app/(site)/w/[token]/page.tsx");
  assert.match(src, /grid-cols-2 [^"]*lg:grid-cols-3/, "2-col mobile / 3-col desktop pocket grid");
  assert.match(src, /POCKETS_PER_PAGE = 9/, "the platonic binder page");
  assert.match(src, /Turn page/);
  const settle = read("components/vault/vault-settle.tsx");
  assert.match(settle, /motion-safe:animate-\[vault-settle/, "reduced-motion users get none");
  assert.match(settle, /localStorage/, "first visit only");
  assert.doesNotMatch(src, /<Suspense|isLoading|LoadingGate|skeleton/i, "no loading gate — sub-second load IS the feature");
});

test("add-in-place uses the SHARED typeahead — /start and the vault import the same component (no fork)", () => {
  assert.match(read("components/vault/vault-add-card.tsx"), /from "@\/components\/cards\/card-typeahead"/);
  assert.match(read("components/start-page-form.tsx"), /from "@\/components\/cards\/card-typeahead"/);
});
