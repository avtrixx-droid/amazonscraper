# Amazon Scraper Deployment Guide

## Environment Variables Required

Set these in your deployment platform:

```bash
# Scraper Configuration
PLAYWRIGHT_HEADLESS=true
AMAZON_BROWSER_CHANNEL=chromium
AMAZON_PERSISTENT_SESSION=false
AMAZON_MANUAL_RECOVERY=false
AMAZON_MANUAL_WAIT_MS=30000
AMAZON_REQUEST_TIMEOUT_MS=60000
AMAZON_REUSE_BROWSER=false

# Optional: Warmup and session management
AMAZON_WARMUP_HOME=false
AMAZON_PROFILE_DIR=.playwright/amazon-profile

# Your existing env vars
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# ... other vars
```

## Netlify Deployment

1. **Connect Repository**
   - Go to [Netlify](https://app.netlify.com)
   - Click "New site from Git"
   - Connect your GitHub/GitLab repository

2. **Build Settings**
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Node version: 18

3. **Environment Variables**
   - Add all environment variables listed above in Netlify's Environment Variables section

4. **Deploy**
   - Click "Deploy site"
   - Wait for build completion

## Render Deployment

1. **Connect Repository**
   - Go to [Render](https://dashboard.render.com)
   - Click "New" → "Web Service"
   - Connect your GitHub repository

2. **Service Configuration**
   - Name: amazon-scraper
   - Environment: Node
   - Build Command: `npm run build`
   - Start Command: `npm start`
   - Node Version: 18

3. **Environment Variables**
   - Add all environment variables listed above

4. **Advanced Settings**
   - Health Check Path: (leave empty)
   - Auto-Deploy: Yes (recommended)

5. **Deploy**
   - Click "Create Web Service"

## Important Notes

- **Playwright**: The build process now installs Chromium automatically
- **Memory**: Scraping can be memory-intensive; monitor your usage
- **Rate Limiting**: Amazon may block aggressive scraping
- **Timeouts**: Adjust `AMAZON_REQUEST_TIMEOUT_MS` based on your needs
- **Headless**: Keep `PLAYWRIGHT_HEADLESS=true` for production

## Troubleshooting

- If builds fail, check the Playwright installation logs
- For scraping timeouts, increase `AMAZON_REQUEST_TIMEOUT_MS`
- Monitor your deployment logs for Amazon blocking messages