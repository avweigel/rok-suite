/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "/rok-suite",
  assetPrefix: "/rok-suite/",
  // optional: if you want to disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
