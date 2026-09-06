import type { NextConfig } from "next";

/**
 * LAYER is a local-first application: the entire product runs in the browser and
 * persists to IndexedDB. There is no server runtime, no API route that needs a
 * secret, and no required environment variable — which is what keeps deployment
 * (Vercel, or any static host) a one-liner.
 *
 * Next 16 no longer runs ESLint during `next build`, so linting is its own
 * script: `npm run lint`. Type checking still fails the build on error.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
