// mention.ts: @mention parsing + Discord truncation. The real handler also
// drives discord.js + Anthropic — we test the pure functions here.

import test from "node:test";
import assert from "node:assert/strict";
import { stripMention, truncateForDiscord } from "../handlers/mention.ts";
import { parseSonnetPrefix } from "../handlers/conversation.ts";

const BOT_ID = "1507171299422765116";

test("stripMention removes a leading <@BOT_ID>", () => {
  assert.equal(stripMention(`<@${BOT_ID}> hello world`, BOT_ID), "hello world");
});

test("stripMention also handles the legacy <@!BOT_ID> nickname mention", () => {
  assert.equal(stripMention(`<@!${BOT_ID}> nick form`, BOT_ID), "nick form");
});

test("stripMention is a no-op if the message doesn't start with a mention", () => {
  assert.equal(stripMention("plain text", BOT_ID), "plain text");
});

test("stripMention trims surrounding whitespace", () => {
  assert.equal(stripMention(`<@${BOT_ID}>     whitespace eaten   `, BOT_ID), "whitespace eaten");
});

test("parseSonnetPrefix flags /sonnet messages and strips the prefix", () => {
  const r = parseSonnetPrefix("/sonnet what's on the roadmap?");
  assert.equal(r.sonnetOverride, true);
  assert.equal(r.userMessage, "what's on the roadmap?");
});

test("parseSonnetPrefix is case-insensitive on the prefix", () => {
  const r = parseSonnetPrefix("/SONNET ping");
  assert.equal(r.sonnetOverride, true);
  assert.equal(r.userMessage, "ping");
});

test("parseSonnetPrefix leaves /sonnet-elsewhere messages alone", () => {
  const r = parseSonnetPrefix("what does /sonnet do?");
  assert.equal(r.sonnetOverride, false);
  assert.equal(r.userMessage, "what does /sonnet do?");
});

test("parseSonnetPrefix handles empty body after the prefix", () => {
  const r = parseSonnetPrefix("/sonnet");
  assert.equal(r.sonnetOverride, true);
  assert.equal(r.userMessage, "(empty message)");
});

test("truncateForDiscord keeps short messages intact", () => {
  assert.equal(truncateForDiscord("short"), "short");
});

test("truncateForDiscord caps long messages with a truncation marker", () => {
  const long = "x".repeat(5000);
  const out = truncateForDiscord(long);
  assert.ok(out.length <= 1900, `expected ≤1900 chars, got ${out.length}`);
  assert.ok(out.endsWith("[…truncated for Discord]"));
});
