import type { NextConfig } from "next";
import createMDX from "@next/mdx";

// Parse the Supabase project host out of NEXT_PUBLIC_SUPABASE_URL so
// next/image accepts the public-bucket URLs cacheCardImage emits.
function supabaseStorageHost(): string {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return "*.supabase.co";
    return new URL(url).hostname;
  } catch {
    return "*.supabase.co";
  }
}

const nextConfig: NextConfig = {
  // .mdx pages render directly via file-based routing alongside .tsx
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // The card-hero MOTION path (ADR-074 Phase 1) encodes MP4 via the self-
  // contained WASM encoder `h264-mp4-encoder`. Keep it a runtime require (loaded
  // dynamically in lib/social/mp4-encoder.ts) instead of bundling its embedded
  // WASM into the function — same treatment Next already gives `sharp`.
  serverExternalPackages: ["h264-mp4-encoder"],
  // /cards + /cards/sets/[set-id] fan out N parallel pokemontcg.io fetches
  // (~50 cards per Base-era set). When pokemontcg.io is slow, the default
  // 60s per-page static-generation timeout fires before the parallel-fetch
  // group resolves. Bump to 5 min — first build that warms the next/fetch
  // 24h revalidate cache pays the full cost; subsequent builds are cheap.
  // Pre-existing build issue (first surfaced in the b67ed97 deploy); fix
  // ride-alongs Session 39 because the failure is blocking the visual-
  // identity deploy.
  staticPageGenerationTimeout: 300,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.poketrace.com" },
      { protocol: "https", hostname: "images.poketrace.com" },
      { protocol: "https", hostname: "images.pokemontcg.io" },
      // Pokemon TCG SDK has federated some image URLs to scrydex.com.
      // Without this, ~2 of 8 search hits on /start fall back to broken-image.
      // See Session 38 followup note.
      { protocol: "https", hostname: "images.scrydex.com" },
      {
        protocol: "https",
        hostname: supabaseStorageHost(),
        pathname: "/storage/v1/object/public/card-images/**",
      },
    ],
  },
  experimental: {
    // Default is 1MB. Binder photos easily exceed it before reaching the
    // server. Client-side resize keeps typical uploads well under this cap;
    // 10MB is the ceiling for pathological inputs that resize doesn't help.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

// Plugin names must be strings (not imported functions) so Turbopack can pass
// them across the Rust boundary. Serializable options only.
//
// `remark-frontmatter` is required so the `---title:...---` YAML at the top of
// every blog post is parsed as frontmatter (then stripped from the body) rather
// than rendered as paragraph text. Session-40 / Task #23 fix.
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-frontmatter", "remark-gfm"],
    rehypePlugins: [
      [
        "rehype-pretty-code",
        {
          theme: "github-dark-dimmed",
          keepBackground: false,
        },
      ],
    ],
  },
});

export default withMDX(nextConfig);
