import type { NextConfig } from "next";

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
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.poketrace.com" },
      { protocol: "https", hostname: "images.poketrace.com" },
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

export default nextConfig;
