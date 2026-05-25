"use client";

// Footer-variant email capture (Task #18 / Session 37). Thin wrapper that
// preselects the source tag + footer styling on the shared EmailCapture
// component so the (site) layout can drop it in without re-specifying
// either every time. Keeps the source-tag string in one place — changing
// the footer's analytics tag is a one-line edit here.
//
// The actual form lives in components/email-capture.tsx (was already
// shipping). This wrapper exists so that strategy-doc references to a
// "footer email capture" map cleanly to a discrete component, and so a
// future redesign (e.g. swapping the footer copy / layout) doesn't need
// to touch every consumer.

import { EmailCapture } from "@/components/email-capture";

export function FooterEmailCapture() {
  return (
    <EmailCapture
      source="footer"
      variant="footer"
      headline="Subscribe to the Foil newsletter."
    />
  );
}
