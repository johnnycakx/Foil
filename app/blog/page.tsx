import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "./posts-meta";

const TITLE = "Foil Blog — Pokémon card valuation, scanning, and grading";
const DESCRIPTION =
  "Field notes on Pokémon card prices, scanning workflows, condition grading, and Japanese-set deep dives from the team building Foil.";
const URL_PATH = "/blog";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL_PATH },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Foil",
    url: URL_PATH,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@foilcards",
  },
};

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return DATE_FMT.format(d);
}

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#0B1428] text-white antialiased">
      <header className="border-b border-white/5 bg-[#0B1428]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-[#FF6B5C]" />
            Foil
          </Link>
          <Link
            href="/login"
            className="text-sm text-zinc-300 transition hover:text-white"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pt-12 pb-20 sm:px-8 sm:pt-20">
        <p className="text-xs font-medium uppercase tracking-wider text-[#FF6B5C]">
          Field notes
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Foil Blog
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-300">
          Posts on Pokémon card valuation, scanning workflows, condition grading,
          and Japanese-set deep dives — from the team building Foil.
        </p>

        {posts.length === 0 ? (
          <p className="mt-12 text-zinc-400">No posts yet. Check back soon.</p>
        ) : (
          <ul className="mt-12 divide-y divide-white/5 border-y border-white/5">
            {posts.map((post) => (
              <li key={post.slug} className="py-6">
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <time
                      dateTime={post.date}
                      className="font-mono text-xs uppercase tracking-wider text-zinc-500"
                    >
                      {formatDate(post.date)}
                    </time>
                    {post.tags.length > 0 && (
                      <span className="flex flex-wrap gap-1.5">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400"
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-white transition group-hover:text-[#FF6B5C] sm:text-2xl">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    {post.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="border-t border-white/5 bg-[#0B1428]">
        <div className="mx-auto w-full max-w-4xl px-5 py-8 text-sm text-zinc-500 sm:px-8">
          © {new Date().getFullYear()} Foil. Pokémon TCG card valuation, in seconds.
        </div>
      </footer>
    </div>
  );
}
