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
import { FooterEmailCapture } from "@/components/footer-email-capture";

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
          className="font-display flex items-center gap-2 text-lg font-bold tracking-tight text-foil-navy transition hover:text-foil-coral"
        >
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foil-gold opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-foil-gold" />
          </span>
          Foil
        </Link>
        <nav className="flex items-center gap-5 text-sm">
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
          <Link
            href="/login"
            className="text-foil-slate transition hover:text-foil-navy"
          >
            Sign in
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
        <div className="mb-8 max-w-md">
          <FooterEmailCapture />
        </div>
        <div className="flex flex-col items-start justify-between gap-3 border-t border-foil-navy/10 pt-6 text-sm text-foil-slate sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Foil. The best price on any Pokémon card.</p>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href="/newsletter"
              className="transition hover:text-foil-navy"
            >
              Newsletter
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
              Sign in
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
