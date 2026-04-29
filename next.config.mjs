import { createRequire } from 'module';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { imageHosts } from './image-hosts.config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const nextVersion = require('next/package.json').version;
const nextMajor = parseInt(nextVersion.split('.')[0], 10);

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
  }
};

if (nextMajor >= 16) {
  nextConfig.turbopack = { root: __dirname };
} else {
  nextConfig.eslint = { ignoreDuringBuilds: true };
}

export default nextConfig;