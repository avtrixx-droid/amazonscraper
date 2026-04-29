import { createRequire } from 'module';
import { dirname, resolve } from 'path';
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

  images: {
    remotePatterns: imageHosts,
    minimumCacheTTL: 60,
  },

  webpack(config) {
    config.resolve ||= {};
    config.resolve.alias ||= {};
    config.resolve.alias['@'] = resolve(__dirname, 'src');
    return config;
  },
};

if (nextMajor >= 16) {
  nextConfig.turbopack = { root: __dirname };
} else {
  nextConfig.eslint = { ignoreDuringBuilds: true };
}

export default nextConfig;
