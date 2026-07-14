// Channel-safety classification (ADR-085) — the load-bearing syndication policy:
// auto-post ONLY to own/owned feeds; NEVER into others' communities (ban risk);
// default-deny on anything unknown or not-yet-ready. These pins are the guardrail
// that survives whether or not the Postiz integration ever ships.

import test from "node:test";
import assert from "node:assert/strict";
import {
  SYNDICATION_CHANNELS,
  autoSafeChannels,
  isAutoSafe,
} from "../social/syndication-channels.ts";

test("communities Foil does not own are NEVER auto-safe (the whole point)", () => {
  for (const key of ["reddit", "discord_thirdparty"]) {
    const c = SYNDICATION_CHANNELS.find((ch) => ch.key === key);
    assert.equal(c?.safety, "human_only", `${key} must be human_only`);
    assert.equal(isAutoSafe(key), false, `${key} must never auto-post`);
  }
});

test("own feed / Foil-owned surfaces are auto-safe", () => {
  for (const key of ["x", "bluesky", "threads", "mastodon", "telegram_owned", "discord_owned"]) {
    assert.equal(isAutoSafe(key), true, `${key} should be auto-safe`);
  }
});

test("own accounts that don't exist yet are NOT auto-safe now (deferred, not human)", () => {
  for (const key of ["instagram", "tiktok"]) {
    const c = SYNDICATION_CHANNELS.find((ch) => ch.key === key);
    assert.equal(c?.safety, "auto_safe_needs_account");
    assert.equal(isAutoSafe(key), false, `${key} must not auto-post until the account exists`);
  }
});

test("linkedin (John's PERSONAL profile) is human_only with manual_paste transport — forever", () => {
  // John's retarget call (2026-07-14): personal profile, not the company page;
  // posting stays manual-paste for authenticity. No LinkedIn API client may be
  // added without a new policy decision — this pin is the tripwire.
  const c = SYNDICATION_CHANNELS.find((ch) => ch.key === "linkedin");
  assert.equal(c?.safety, "human_only", "linkedin must be human_only");
  assert.equal(c?.transport, "manual_paste", "linkedin transport is manual paste, not an API");
  assert.equal(isAutoSafe("linkedin"), false, "linkedin must never auto-post");
  assert.ok(!autoSafeChannels().some((ch) => ch.key === "linkedin"));
});

test("isAutoSafe is default-deny: an unknown channel key never auto-posts", () => {
  assert.equal(isAutoSafe("some-future-community"), false);
  assert.equal(isAutoSafe(""), false);
  assert.equal(isAutoSafe("REDDIT"), false); // case-sensitive; no accidental match
});

test("autoSafeChannels() returns ONLY auto_safe — no community, no needs-account", () => {
  const safe = autoSafeChannels();
  assert.ok(safe.length >= 4, "expected several own/owned channels");
  for (const c of safe) {
    assert.equal(c.safety, "auto_safe");
  }
  const safeKeys = new Set(safe.map((c) => c.key));
  assert.ok(!safeKeys.has("reddit"), "reddit must never be in the auto-safe set");
  assert.ok(!safeKeys.has("discord_thirdparty"));
  assert.ok(!safeKeys.has("instagram"), "needs-account channels are excluded until they exist");
  assert.ok(!safeKeys.has("tiktok"));
});

test("every channel is fully described (key/label/note) so the policy is self-documenting", () => {
  const keys = new Set<string>();
  for (const c of SYNDICATION_CHANNELS) {
    assert.ok(c.key && !keys.has(c.key), `duplicate or empty key: ${c.key}`);
    keys.add(c.key);
    assert.ok(c.label.length > 0, `${c.key} needs a label`);
    assert.ok(c.note.length > 0, `${c.key} needs a note`);
    assert.ok(["auto_safe", "auto_safe_needs_account", "human_only"].includes(c.safety));
  }
});

test("INVARIANT: a `postiz`-transport community channel can never be auto_safe", () => {
  // Postiz can technically post to subreddits; the safety classification — not
  // the transport — is what gates auto-posting. Pin that no human_only channel
  // is ever auto-safe regardless of transport.
  for (const c of SYNDICATION_CHANNELS) {
    if (c.safety === "human_only") assert.equal(isAutoSafe(c.key), false);
  }
});
