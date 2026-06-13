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
          aria-label="FoilTCG home"
          className="inline-flex items-center transition hover:text-foil-coral"
        >
          <Logo size="md" />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          {/* Vending pivot: nav points only at the host lead-gen surfaces. The
              deal-finder routes (/deals, /cards, /blog) are dormant — unlinked,
              noindexed, off the sitemap — but the code is preserved in-tree. */}
          <Link
            href="/service-areas"
            className="text-foil-slate transition hover:text-foil-navy"
          >
            Service areas
          </Link>
          <Link
            href="/faq"
            className="text-foil-slate transition hover:text-foil-navy"
          >
            FAQ
          </Link>
          <Link
            href="/host"
            className="font-medium text-foil-navy transition hover:text-foil-coral"
          >
            Host a machine
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-foil-navy/10 bg-foil-cream">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        {/* Brand wordmark lockup (ADR-055) — FoilTCG in Fredoka, navy + gold. */}
        <div className="mb-6">
          <Link href="/" aria-label="FoilTCG home" className="inline-flex transition hover:opacity-80">
            <Logo size="md" />
          </Link>
        </div>
        <div className="mb-8 max-w-md">
          <p className="text-sm leading-relaxed text-foil-slate">
            We place and operate Pokémon card vending machines for Bay Area businesses.{" "}
            <Link
              href="/host"
              className="text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
            >
              Host one in your space →
            </Link>
          </p>
        </div>
        <div className="flex flex-col items-start justify-between gap-3 border-t border-foil-navy/10 pt-6 text-sm text-foil-slate sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Foil TCG, LLC · Built by a Level-4 TCGplayer seller</p>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href="/host"
              className="transition hover:text-foil-navy"
            >
              Host a machine
            </Link>
            <Link
              href="/service-areas"
              className="transition hover:text-foil-navy"
            >
              Service areas
            </Link>
            <Link
              href="/faq"
              className="transition hover:text-foil-navy"
            >
              FAQ
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
