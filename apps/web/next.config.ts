import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/rok-suite",
  assetPrefix: "/rok-suite/",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
