import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "./posts-meta";
import { EmailCapture } from "@/components/email-capture";

const TITLE = "Foil Blog — Pokémon TCG deals, pricing, and market reads";
const DESCRIPTION =
  "Field notes on Pokémon card deals, market pricing, condition grading, and what's worth buying right now — from the team building Foil.";
const URL_PATH = "/blog";

export const metadata: Metadata = {
  // Dormant under the vending pivot (docs/vending Goal A §3): de-indexed,
  // unlinked, and off the sitemap. Posts preserved in-tree.
  robots: { index: false, follow: false },
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
    <>
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pt-12 pb-20 sm:px-8 sm:pt-20">
        <p className="text-xs font-medium uppercase tracking-wider text-foil-gold">
          Field notes
        </p>
        <h1 className="font-display mt-3 text-4xl font-bold tracking-[-0.02em] text-foil-navy sm:text-5xl">
          Foil Blog
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-foil-slate">
          Posts on Pokémon card deals, market pricing, condition grading, and
          what&apos;s actually worth buying right now — from the team building Foil.
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

      <section className="mx-auto w-full max-w-4xl px-5 pb-12 sm:px-8">
        <EmailCapture source="blog-index-footer" variant="footer" />
      </section>
    </>
  );
}
