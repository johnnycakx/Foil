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
//
// Session 40 / Task #23: suppressed on /start. The /start page has its
// own in-form newsletter opt-in checkbox; rendering the footer email
// capture there was redundant.

import { usePathname } from "next/navigation";
import { EmailCapture } from "@/components/email-capture";

// Routes that already capture an email and shouldn't also show the
// footer capture. Add a route here if a new page ships its own primary
// email-capture surface.
const SUPPRESS_ON_ROUTES: readonly string[] = ["/start"];

export function FooterEmailCapture() {
  const pathname = usePathname();
  if (pathname && SUPPRESS_ON_ROUTES.includes(pathname)) return null;
  return (
    <EmailCapture
      source="footer"
      variant="footer"
      headline="Subscribe to the Foil newsletter."
    />
  );
}
