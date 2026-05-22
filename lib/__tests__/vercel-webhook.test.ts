// Vercel deploys webhook proxy — signature verification + embed shaping.
// We pin these contracts because they're the boundary between Vercel's
// signed POST and our Discord notification surface.

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { buildEmbed, verifySignature } from "../vercel-webhook.ts";

const SECRET = "test-secret-supplied-by-vercel";

function sign(body: string, secret = SECRET): string {
  return createHmac("sha1", secret).update(body).digest("hex");
}

test("verifySignature accepts the canonical Vercel HMAC-SHA1 form", () => {
  const body = '{"type":"deployment.succeeded"}';
  assert.equal(verifySignature(body, sign(body), SECRET), true);
});

test("verifySignature rejects when the body is mutated", () => {
  const body = '{"type":"deployment.succeeded"}';
  const sig = sign(body);
  const mutated = body.replace("succeeded", "error");
  assert.equal(verifySignature(mutated, sig, SECRET), false);
});

test("verifySignature rejects on a forged signature (correct length, wrong secret)", () => {
  const body = "{}";
  const forged = sign(body, "different-secret");
  assert.equal(verifySignature(body, forged, SECRET), false);
});

test("verifySignature rejects a header value of the wrong length without throwing", () => {
  const body = "{}";
  assert.equal(verifySignature(body, "tooshort", SECRET), false);
  assert.equal(verifySignature(body, "", SECRET), false);
});

test("verifySignature rejects a non-hex header value cleanly", () => {
  const body = "{}";
  assert.equal(verifySignature(body, "not-hex-at-all-but-the-right-length-padding", SECRET), false);
});

test("buildEmbed: deployment.succeeded → green color + ✅ + commit link", () => {
  const embed = buildEmbed({
    type: "deployment.succeeded",
    createdAt: 1779000000000,
    payload: {
      target: "production",
      project: { name: "foil" },
      deployment: {
        url: "foil-abc123.vercel.app",
        meta: {
          githubCommitSha: "deadbeefcafe1234",
          githubCommitRef: "main",
          githubCommitMessage: "feat: ship the thing\n\nbody",
          githubCommitAuthorName: "John Craig",
        },
      },
    },
  });
  assert.equal(embed.color, 0x4ade80);
  assert.ok(embed.title?.includes("✅"));
  assert.ok(embed.title?.toLowerCase().includes("succeeded"));
  assert.equal(embed.url, "https://foil-abc123.vercel.app");
  const fields = embed.fields ?? [];
  const findField = (name: string) => fields.find((f) => f.name === name)?.value;
  assert.equal(findField("Project"), "foil");
  assert.equal(findField("Environment"), "production");
  assert.equal(findField("Branch"), "main");
  assert.ok(findField("Commit")?.includes("deadbee"));
  assert.equal(findField("Author"), "John Craig");
  // Multi-line commit message gets first-line only
  assert.equal(findField("Message"), "feat: ship the thing");
});

test("buildEmbed: deployment.error → red color + ❌ + 'failed' title", () => {
  const embed = buildEmbed({
    type: "deployment.error",
    payload: { project: { name: "foil" }, target: "production", deployment: {} },
  });
  assert.equal(embed.color, 0xef4444);
  assert.ok(embed.title?.includes("❌"));
  assert.ok(embed.title?.toLowerCase().includes("failed"));
});

test("buildEmbed: deployment.canceled → yellow color + ⚠️ + 'canceled' title", () => {
  const embed = buildEmbed({
    type: "deployment.canceled",
    payload: { project: { name: "foil" }, target: "preview", deployment: {} },
  });
  assert.equal(embed.color, 0xfbbf24);
  assert.ok(embed.title?.includes("⚠️"));
  assert.ok(embed.title?.toLowerCase().includes("canceled"));
});

test("buildEmbed: omits Commit/Branch/Author fields when not present in payload", () => {
  const embed = buildEmbed({
    type: "deployment.succeeded",
    payload: { project: { name: "foil" }, target: "production", deployment: {} },
  });
  const names = (embed.fields ?? []).map((f) => f.name);
  assert.ok(!names.includes("Branch"));
  assert.ok(!names.includes("Commit"));
  assert.ok(!names.includes("Author"));
  // But Project + Environment still land
  assert.ok(names.includes("Project"));
  assert.ok(names.includes("Environment"));
});

test("buildEmbed: truncates commit messages over 120 chars to keep the embed compact", () => {
  const longMsg = "feat: " + "x".repeat(500);
  const embed = buildEmbed({
    type: "deployment.succeeded",
    payload: { project: { name: "foil" }, target: "production", deployment: { meta: { githubCommitMessage: longMsg } } },
  });
  const msg = (embed.fields ?? []).find((f) => f.name === "Message")?.value ?? "";
  assert.ok(msg.length <= 120, `expected ≤120 chars, got ${msg.length}`);
});
