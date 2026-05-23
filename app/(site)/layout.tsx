// Shared layout for the public marketing surface — homepage, /cards index +
// per-card pages, /blog index + posts, the three pillar pages. Everything
// inside the (site) route group renders inside this layout.
//
// Routes that should NOT use this layout (and live outside the group):
//   - /login, /auth/* — minimal layouts, no marketing header
//   - /upload, /account — authenticated app shell
//   - /api/* — no layout at all
//
// The four sources-of-truth problem (Session 23): every public page was
// re-implementing its own Header() + Footer() inline. Lifted both into this
// layout so a nav change is one edit, not five.

import Link from "next/link";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#0B1428] text-white antialiased">
      <SiteHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-[#0B1428]/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white transition hover:text-zinc-200"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-[#FF6B5C]" />
          Foil
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/cards"
            className="text-zinc-300 transition hover:text-white"
          >
            Browse cards
          </Link>
          <Link
            href="/blog"
            className="text-zinc-300 transition hover:text-white"
          >
            Blog
          </Link>
          <Link
            href="/login"
            className="text-zinc-300 transition hover:text-white"
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
    <footer className="border-t border-white/5 bg-[#0B1428]">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 px-5 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:px-8">
        <p>© {new Date().getFullYear()} Foil. The best price on any Pokémon card.</p>
        <p>
          Already have access?{" "}
          <Link
            href="/login"
            className="text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-zinc-400"
          >
            Sign in
          </Link>
        </p>
      </div>
    </footer>
  );
}
