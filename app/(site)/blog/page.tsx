import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts, isVendingPost } from "./posts-meta";
import { EmailCapture } from "@/components/email-capture";

const TITLE = "Foil Blog — Pokémon TCG deals, pricing, and market reads";
const DESCRIPTION =
  "Field notes on Pokémon card deals, market pricing, condition grading, and what's worth buying right now — from the team building Foil.";
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
    // Overriding openGraph suppresses the file-based app/opengraph-image.tsx,
    // so reference the dynamic OG explicitly or the share card is blank.
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@FoilTCG",
    images: ["/opengraph-image"],
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
  // Collector posts lead the index; vending posts move to a compact
  // "For businesses" section below (design-loop-round2 §5: a collector must
  // never land on a vending blog — the PAGES stay live + linked for SEO,
  // they just stop leading). Partition is ADR-063's pillar gate.
  const posts = getAllPosts();
  const collectorPosts = posts.filter((p) => !isVendingPost(p));
  const vendingPosts = posts.filter(isVendingPost);

  return (
    // Night register (design-loop-round2 §3) — the chrome flips via body:has().
    <main data-tone="night" className="bg-foil-night text-foil-cream">
      <div className="mx-auto w-full max-w-4xl flex-1 px-5 pt-12 pb-20 sm:px-8 sm:pt-20">
        <p className="text-xs font-medium uppercase tracking-wider text-foil-accent">
          Field notes
        </p>
        <h1 className="font-display mt-3 text-4xl font-bold tracking-[-0.02em] text-foil-cream sm:text-5xl">
          Foil Blog
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-foil-cream/70">
          Posts on Pokémon card deals, market pricing, condition grading, and
          what&apos;s actually worth buying right now — from the team building Foil.
        </p>

        {collectorPosts.length === 0 ? (
          <p className="mt-12 text-foil-cream/60">No posts yet. Check back soon.</p>
        ) : (
          <ul className="mt-12 divide-y divide-foil-cream/10 border-y border-foil-cream/10">
            {collectorPosts.map((post) => (
              <li key={post.slug} className="py-6">
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <time
                      dateTime={post.date}
                      className="font-mono text-xs uppercase tracking-wider text-foil-cream/50"
                    >
                      {formatDate(post.date)}
                    </time>
                    {post.tags.length > 0 && (
                      <span className="flex flex-wrap gap-1.5">
                        {post.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-foil-cream/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foil-cream/70"
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display mt-2 text-xl font-bold tracking-[-0.02em] text-foil-cream transition group-hover:text-foil-accent sm:text-2xl">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-base text-foil-cream/60">
                    {post.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {vendingPosts.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-lg font-semibold text-foil-cream/80">
              For businesses
            </h2>
            <p className="mt-1 text-sm text-foil-cream/50">
              Hosting one of our card vending machines — a different audience,
              kept out of the collector feed.
            </p>
            <ul className="mt-4 space-y-2">
              {vendingPosts.map((post) => (
                <li key={post.slug}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-sm text-foil-cream/70 underline decoration-foil-cream/20 underline-offset-4 transition hover:text-foil-cream hover:decoration-foil-accent"
                  >
                    {post.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-16">
          <EmailCapture source="blog-index-footer" variant="footer" tone="night" />
        </section>
      </div>
    </main>
  );
}
