# Render Deployment Guide

## What Was Fixed

This project had a few Render-specific deployment problems:

1. The Blueprint file was inside `amazonscraper/` instead of the repository root.
2. The service did not declare a `rootDir`, even though this repository is a monorepo.
3. The Render start command used `npm run serve`, which did not reliably bind to Render's injected `PORT`.
4. The scraper runtime was using `playwright-core` plus a Lambda-oriented Chromium package, which is brittle on Render web services.
5. The build did not install a matching Playwright Chromium binary and Linux dependencies.

These are now fixed.

## Current Render Setup

Use the repo-root [render.yaml](/Users/avtrix/Projects/Scrapper/render.yaml:1).

Key settings:

- `rootDir: amazonscraper`
- `buildCommand: npm install && npm run render:build`
- `startCommand: npm start`
- `healthCheckPath: /`
- `PLAYWRIGHT_BROWSERS_PATH=0`

## If You Deploy With Blueprint

1. Push the updated repository.
2. In Render, create a new Blueprint or sync the existing one.
3. Render will read the root `render.yaml`.
4. The service should build from `amazonscraper/` automatically.

## If You Deploy Manually In Render UI

Use these exact values:

- Environment: `Node`
- Root Directory: `amazonscraper`
- Build Command: `npm install && npm run render:build`
- Start Command: `npm start`
- Health Check Path: `/`

Environment variables:

```bash
NODE_ENV=production
NODE_VERSION=22.16.0
PLAYWRIGHT_BROWSERS_PATH=0
PLAYWRIGHT_HEADLESS=true
AMAZON_PERSISTENT_SESSION=false
AMAZON_MANUAL_RECOVERY=false
AMAZON_WARMUP_HOME=false
AMAZON_REUSE_BROWSER=true
```

## Notes

- `PLAYWRIGHT_BROWSERS_PATH=0` makes the Playwright browser install hermetic, so the Chromium binary lives with the app instead of depending on a machine-level cache.
- `npm run render:build` installs Chromium with Linux dependencies before running `next build`.
- `npm start` respects Render's `PORT`.
- If Amazon blocks requests in production, the app should still deploy successfully; that is a runtime scraping limitation, not a Render deploy failure.
