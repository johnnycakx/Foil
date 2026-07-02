// Shared layout for the public marketing surface — homepage, /cards index +
// per-card pages, /blog index + posts, the three pillar pages. Everything
// inside the (site) route group renders inside this layout.
//
// Routes that should NOT use this layout (and live outside the group):
//   - /login, /auth/* — minimal layouts, no marketing header
//   - /upload, /account — authenticated app shell
//   - /api/* — no layout at all
//
// Session 39 (ADR-029): cream/navy/gold palette. Coral is hover-only.

import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-foil-cream text-foil-navy antialiased">
      <SiteHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-foil-navy/10 bg-foil-cream/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link
          href="/"
          aria-label="Foil home"
          className="inline-flex items-center transition hover:text-foil-coral"
        >
          <Logo size="md" />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/deals"
            className="font-medium text-foil-navy transition hover:text-foil-coral"
          >
            Today&apos;s deals
          </Link>
          <Link
            href="/cards"
            className="text-foil-slate transition hover:text-foil-navy"
          >
            Browse cards
          </Link>
          <Link
            href="/blog"
            className="text-foil-slate transition hover:text-foil-navy"
          >
            Blog
          </Link>
          {/* Dual-track (ADR-064): the deal-finder is the primary surface; the
              vending lead-gen business lives at /host. Keep one clear entry
              point so vending isn't orphaned. */}
          <Link
            href="/host"
            className="text-foil-slate transition hover:text-foil-navy"
          >
            Host a machine
          </Link>
          {/* F6: no "Sign in" in the main nav — watchlists work with no account,
              so a sign-in CTA up top only confuses cold visitors. The route +
              auth flow are untouched; a discreet "Account" link lives in the
              footer, and /upload still routes to /login at the paywall. */}
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-foil-navy/10 bg-foil-cream">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        {/* Brand wordmark lockup (ADR-094) — the hanko seal + "Foil" in Bricolage, navy ink. */}
        <div className="mb-6">
          <Link href="/" aria-label="Foil home" className="inline-flex transition hover:opacity-80">
            <Logo size="md" />
          </Link>
        </div>
        {/* Footer is nav / legal / trust only (email-ask-cleanup, ADR-066) — the
            footer email form was removed so each page makes ONE email ask. The
            "Newsletter" link below routes intent-driven visitors to /newsletter. */}
        <div className="flex flex-col items-start justify-between gap-3 border-t border-foil-navy/10 pt-6 text-sm text-foil-slate sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <Image
              src="/founder/john-craig.webp"
              alt="John Craig, founder of Foil"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-foil-navy/10"
            />
            <p>© {new Date().getFullYear()} Foil TCG, LLC · Built by John Craig</p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Site→X funnel loop (audit 2026-06-29): the only visible follow CTA.
                Secondary to the per-page email ask (ADR-066) — calm navy ink, no
                loud color. A plain styled link + inline glyph, NOT the official
                embed widget (that ships heavy third-party JS that hurts LCP/CWV).
                rel="me" is a zero-cost brand-entity identity signal. */}
            <a
              href="https://x.com/FoilTCG"
              target="_blank"
              rel="me noopener noreferrer"
              aria-label="Follow Foil on X (opens in a new tab)"
              className="inline-flex items-center gap-1.5 transition hover:text-foil-navy"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="currentColor"
                className="h-3.5 w-3.5"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Follow on X
            </a>
            <Link
              href="/newsletter"
              className="transition hover:text-foil-navy"
            >
              Newsletter
            </Link>
            <Link
              href="/pricing-methodology"
              className="transition hover:text-foil-navy"
            >
              Methodology
            </Link>
            <Link
              href="/host"
              className="transition hover:text-foil-navy"
            >
              Host a machine
            </Link>
            <Link
              href="/legal/privacy"
              className="transition hover:text-foil-navy"
            >
              Privacy
            </Link>
            <Link
              href="/legal/terms"
              className="transition hover:text-foil-navy"
            >
              Terms
            </Link>
            <Link
              href="/login"
              className="underline decoration-foil-navy/20 underline-offset-4 transition hover:text-foil-navy hover:decoration-foil-gold"
            >
              Account
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
