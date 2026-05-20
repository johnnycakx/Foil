// Client-side pipeline orchestrator extracted from upload-form.tsx so the
// detect-vs-no-detect routing is testable without a React DOM. The single
// branch is the V1 primary flow; binder branch covers the multi-card opt-in.

import type { DetectResult, ScanResult } from "@/app/upload/actions";

export type ScanMode = "single" | "binder";

export type ScanPipelineDeps = {
  detectScan: (fd: FormData) => Promise<DetectResult>;
  identifyScan: (fd: FormData) => Promise<ScanResult>;
};

export type ScanPipelineEvents = {
  /** Called when the detect pass starts. Only fires in binder mode. */
  onDetect?: () => void;
  /** Called once the identify pass starts. `count` reflects detect output in
   *  binder mode, or 1 in single mode. */
  onIdentify?: (count: number) => void;
};

/**
 * Run the appropriate pipeline for the chosen mode.
 *
 *   single → skip detect entirely; identifyScan runs once on the full image.
 *   binder → detect → identifyScan-with-boxes (existing multi-card flow).
 *
 * Returns the raw ScanResult; callers (the React form) translate that into
 * UI phases. Throws if either deps call rejects — callers should catch.
 */
export async function runScanPipeline(
  photo: File,
  mode: ScanMode,
  deps: ScanPipelineDeps,
  events: ScanPipelineEvents = {},
): Promise<ScanResult> {
  if (mode === "single") {
    events.onIdentify?.(1);
    const fd = new FormData();
    fd.append("photo", photo);
    // Crucially: no "boxes" key. The server treats missing boxes as a single-
    // pass scan on the whole image.
    return deps.identifyScan(fd);
  }

  events.onDetect?.();
  const fdDetect = new FormData();
  fdDetect.append("photo", photo);
  const detection = await deps.detectScan(fdDetect);
  if (!detection.ok) {
    // Surface the detect-failure shape through ScanResult by re-mapping. The
    // shape of DetectResult matches the failure shape of ScanResult one-to-one
    // for the fields the UI consumes, but we explicitly construct the failure
    // here for clarity.
    return {
      ok: false,
      error: detection.error,
      rateLimited: detection.rateLimited,
      remainingFreeScans: detection.remainingFreeScans,
    };
  }
  events.onIdentify?.(detection.count);
  const fdIdentify = new FormData();
  fdIdentify.append("photo", photo);
  fdIdentify.append("detectedCount", String(detection.count));
  fdIdentify.append("boxes", JSON.stringify(detection.cards));
  return deps.identifyScan(fdIdentify);
}
