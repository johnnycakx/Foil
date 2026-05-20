// Pins the client-side scan pipeline routing. The user-visible promise is
// "single-card mode skips the detect pass and goes straight to identify."
// We test that contract by mocking the two server actions and watching which
// ones get called for each mode.
//
// detectScan + identifyScan are both server actions, so we can't import them
// directly into a unit test. Instead we test runScanPipeline (the extracted
// pure-logic orchestrator) and inject test doubles.

import test from "node:test";
import assert from "node:assert/strict";
import { runScanPipeline } from "../scan-pipeline.ts";
import type { DetectResult, ScanResult } from "../../app/upload/actions.ts";

const FAKE_PHOTO = new File([new Uint8Array([0xff, 0xd8, 0xff])], "card.jpg", {
  type: "image/jpeg",
});

function okScanResult(cardCount: number): Extract<ScanResult, { ok: true }> {
  return {
    ok: true,
    fileName: "card.jpg",
    sizeBytes: 3,
    mimeType: "image/jpeg",
    latencyMs: 800,
    pricingMs: 400,
    passes: cardCount <= 1 ? "single" : "multi",
    detectedCount: cardCount,
    cache: { read: 0, written: 0, input: 0 },
    data: {
      cards: Array(cardCount)
        .fill(null)
        .map((_, i) => ({
          // Stub IdentifiedCard fields the type wants — values don't matter for
          // these routing tests.
          status: "identified",
          insufficientReason: null,
          name: `Card ${i}`,
          hp: null,
          collectorNumber: null,
          setCode: null,
          setCodeRaw: null,
          setSymbolDescription: null,
          regulationMark: null,
          rarity: null,
          illustrator: null,
          variant: null,
          language: "EN" as const,
          conditionEstimate: null,
          confidence: 80,
          visualNotes: null,
          boundingBox: null,
          pricing: { matched: false, reason: "stub", failure: { code: "unreadable", message: "", topCandidates: [] } },
          quotes: [],
          quantity: 1,
        })),
      overallConfidence: 80,
      unidentifiedCount: 0,
      totalValue: 0,
      pricedCount: 0,
    },
  };
}

function okDetectResult(count: number): Extract<DetectResult, { ok: true }> {
  return {
    ok: true,
    count,
    cards: Array(count)
      .fill(null)
      .map((_, i) => ({
        x: i * 0.1,
        y: 0.1,
        width: 0.1,
        height: 0.14,
        detectionConfidence: 0.9,
      })),
    detectMs: 200,
  };
}

test("single mode: detectScan is NEVER called, identifyScan runs exactly once on the full image", async () => {
  let detectCalls = 0;
  let identifyCalls = 0;
  let identifyFormDataKeys: string[] = [];

  const result = await runScanPipeline(
    FAKE_PHOTO,
    "single",
    {
      detectScan: async () => {
        detectCalls++;
        return okDetectResult(0);
      },
      identifyScan: async (fd) => {
        identifyCalls++;
        identifyFormDataKeys = Array.from(fd.keys());
        return okScanResult(1);
      },
    },
  );

  assert.strictEqual(detectCalls, 0, "single mode MUST skip detectScan");
  assert.strictEqual(identifyCalls, 1, "single mode MUST call identifyScan exactly once");
  assert.ok(
    !identifyFormDataKeys.includes("boxes"),
    "single mode FormData MUST NOT include 'boxes' — that's how the server routes to single-pass identify",
  );
  assert.ok(
    identifyFormDataKeys.includes("photo"),
    "single mode FormData MUST include 'photo'",
  );
  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.data.cards.length, 1, "single mode result is exactly one PricedCard");
    assert.strictEqual(result.passes, "single");
  }
});

test("single mode: events fire onIdentify(1) only — no onDetect", async () => {
  const events: string[] = [];
  await runScanPipeline(
    FAKE_PHOTO,
    "single",
    {
      detectScan: async () => okDetectResult(0),
      identifyScan: async () => okScanResult(1),
    },
    {
      onDetect: () => events.push("detect"),
      onIdentify: (n) => events.push(`identify:${n}`),
    },
  );
  assert.deepStrictEqual(events, ["identify:1"]);
});

test("binder mode: detect then identify, with boxes in identify FormData", async () => {
  let detectCalls = 0;
  let identifyCalls = 0;
  let identifyKeys: string[] = [];
  let identifyBoxesJson = "";

  const result = await runScanPipeline(
    FAKE_PHOTO,
    "binder",
    {
      detectScan: async () => {
        detectCalls++;
        return okDetectResult(7);
      },
      identifyScan: async (fd) => {
        identifyCalls++;
        identifyKeys = Array.from(fd.keys());
        identifyBoxesJson = String(fd.get("boxes") ?? "");
        return okScanResult(7);
      },
    },
  );

  assert.strictEqual(detectCalls, 1, "binder mode MUST call detectScan once");
  assert.strictEqual(identifyCalls, 1, "binder mode MUST call identifyScan once");
  assert.ok(identifyKeys.includes("boxes"), "binder mode FormData MUST include 'boxes'");
  assert.ok(identifyKeys.includes("detectedCount"), "binder mode FormData MUST include 'detectedCount'");
  const boxes = JSON.parse(identifyBoxesJson);
  assert.strictEqual(boxes.length, 7);
  assert.strictEqual(result.ok, true);
});

test("binder mode: events fire onDetect then onIdentify(N)", async () => {
  const events: string[] = [];
  await runScanPipeline(
    FAKE_PHOTO,
    "binder",
    {
      detectScan: async () => okDetectResult(5),
      identifyScan: async () => okScanResult(5),
    },
    {
      onDetect: () => events.push("detect"),
      onIdentify: (n) => events.push(`identify:${n}`),
    },
  );
  assert.deepStrictEqual(events, ["detect", "identify:5"]);
});

test("binder mode: detect failure is propagated, identify is NOT called", async () => {
  let identifyCalls = 0;
  const result = await runScanPipeline(
    FAKE_PHOTO,
    "binder",
    {
      detectScan: async () => ({ ok: false, error: "rate limit", rateLimited: true, remainingFreeScans: 0 }),
      identifyScan: async () => {
        identifyCalls++;
        return okScanResult(1);
      },
    },
  );
  assert.strictEqual(identifyCalls, 0, "identifyScan MUST NOT run when detect fails");
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.strictEqual(result.error, "rate limit");
    assert.strictEqual(result.rateLimited, true);
  }
});

test("single mode: identify failure is propagated", async () => {
  const result = await runScanPipeline(
    FAKE_PHOTO,
    "single",
    {
      detectScan: async () => okDetectResult(0),
      identifyScan: async () => ({ ok: false, error: "vision down" }),
    },
  );
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.strictEqual(result.error, "vision down");
  }
});
