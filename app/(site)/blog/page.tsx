import type { Metadata } from "next";
import Link from "next/link";
import { getVendingPosts } from "./posts-meta";

const TITLE = "Foil Blog — Pokémon card vending machine hosting in the Bay Area";
const DESCRIPTION =
  "Guides for Bay Area business owners on hosting a Pokémon card vending machine: is it worth it for your venue, how revenue-share hosting works, and where we place machines.";
const URL_PATH = "/blog";

export const metadata: Metadata = {
  // Live vending blog surface (ADR-063): indexable. Only vending posts are
  // listed here (getVendingPosts); the dormant deal-finder posts stay
  // noindexed + unlisted (vending pivot, ADR-060).
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
  const posts = getVendingPosts();

  return (
    <>
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pt-12 pb-20 sm:px-8 sm:pt-20">
        <p className="text-xs font-medium uppercase tracking-wider text-foil-gold">
          Host guides
        </p>
        <h1 className="font-display mt-3 text-4xl font-bold tracking-[-0.02em] text-foil-navy sm:text-5xl">
          Foil Blog
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-foil-slate">
          Straight answers for Bay Area business owners weighing a Pokémon card
          vending machine: whether it fits your venue, what it costs you, and how
          hosting works.
        </p>

        {posts.length === 0 ? (
          <p className="mt-12 text-foil-slate">No posts yet. Check back soon.</p>
        ) : (
          <ul className="mt-12 divide-y divide-foil-navy/10 border-y border-foil-navy/10">
            {posts.map((post) => (
              <li key={post.slug} className="py-6">
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <time
                      dateTime={post.date}
                      className="font-mono text-xs uppercase tracking-wider text-foil-slate"
                    >
                      {formatDate(post.date)}
                    </time>
                    {post.tags.length > 0 && (
                      <span className="flex flex-wrap gap-1.5">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-foil-gold/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foil-navy"
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display mt-2 text-xl font-bold tracking-[-0.02em] text-foil-navy transition group-hover:text-foil-coral sm:text-2xl">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm text-foil-slate">
                    {post.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <section className="mx-auto w-full max-w-4xl px-5 pb-16 sm:px-8">
        <div className="rounded-2xl border border-foil-gold/40 bg-foil-cream p-6 shadow-lg shadow-foil-navy/10 sm:p-8">
          <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
            Thinking about hosting a machine?
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-foil-slate">
            We place and operate Pokémon card vending machines for Bay Area
            businesses. Zero cost, fully managed, and a monthly revenue share for
            space you already have.
          </p>
          <Link
            href="/host"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-foil-navy px-5 py-3 text-sm font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40"
          >
            Host a machine
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
