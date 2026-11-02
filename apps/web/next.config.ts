import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const nextConfig: NextConfig = {
  // The AoO planner moved into the Kingdom Planner (shared ?plan= links keep
  // their query); the old KvK War Room is gone — its links land on the KvK Map.
  async redirects() {
    return [
      { source: '/aoo-strategy', destination: '/kingdom-planner', permanent: false },
      { source: '/kvk-map/:path*', destination: '/kingdom-planner?section=kvk-map', permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
