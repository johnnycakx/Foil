import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.poketrace.com" },
      { protocol: "https", hostname: "images.poketrace.com" },
    ],
  },
};

export default nextConfig;
