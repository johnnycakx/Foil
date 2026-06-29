// Guard for the foil-bot slash-command definitions (Railway crash 2026-06-29).
//
// Discord caps a slash-command DESCRIPTION at 100 characters, validated by
// @discordjs/builders at builder-construction time (module load). A 101+ char
// description throws ExpectedConstraintError the instant bot/src/handlers/
// slash-commands.ts is imported, crash-looping the bot at boot — which is
// exactly what a 104-char /approve description did in production.
//
// CI never imports the bot (separate package + discord.js), so this reads the
// source as TEXT and validates every setDescription string structurally. Also
// pins the brand-voice no-em-dash rule on these user-facing strings.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = readFileSync(join(ROOT, "bot/src/handlers/slash-commands.ts"), "utf8");

/** Discord's hard limit on slash-command + option descriptions. */
const DISCORD_DESCRIPTION_MAX = 100;

function descriptions(): string[] {
  // Matches .setDescription("...") — our descriptions carry no embedded quotes.
  return [...SRC.matchAll(/\.setDescription\(\s*"([^"]*)"/g)].map((m) => m[1]);
}

test("every slash-command description is within Discord's 100-char limit", () => {
  const descs = descriptions();
  assert.ok(descs.length >= 6, `expected to find the command descriptions, found ${descs.length}`);
  const over = descs.filter((d) => d.length > DISCORD_DESCRIPTION_MAX);
  assert.deepEqual(
    over.map((d) => `${d.length}: ${d}`),
    [],
    `These descriptions exceed Discord's ${DISCORD_DESCRIPTION_MAX}-char limit and will crash the bot at boot.`,
  );
});

test("no slash-command description contains an em dash (BRAND-VOICE Gate 12)", () => {
  const withEmDash = descriptions().filter((d) => d.includes("—"));
  assert.deepEqual(withEmDash, [], "Em dashes are banned in user-facing strings; recast with a comma, colon, or period.");
});
