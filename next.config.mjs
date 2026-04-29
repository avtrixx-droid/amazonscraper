import { createRequire } from 'module';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { imageHosts } from './image-hosts.config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

let nextMajor = 15; // Default to Next.js 15
try {
  const nextVersion = require('next/package.json').version;
  nextMajor = parseInt(nextVersion.split('.')[0], 10);
} catch (error) {
  // next not installed yet during build, use default
  console.log('Next.js version detection failed, using default config for Next.js 15+');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  distDir: process.env.DIST_DIR || '.next',

  typescript: {
    ignoreBuildErrors: true,
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

if (nextMajor >= 16) {
  nextConfig.turbopack = { root: __dirname };
} else {
  nextConfig.eslint = { ignoreDuringBuilds: true };
}

export default nextConfig;