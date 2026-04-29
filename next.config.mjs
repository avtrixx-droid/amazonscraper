import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  distDir: process.env.DIST_DIR || '.next',

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 60,
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      // @sparticuz/chromium relies on relative path resolution to find its binary files.
      // Bundling it breaks that resolution, so we mark it as external.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        '@sparticuz/chromium',
        'playwright-core',
      ];
    }
    return config;
  },
};
export default nextConfig;