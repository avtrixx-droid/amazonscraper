# Amazon.in Playwright Scraper MVP

Simple Amazon product scraper built with Next.js and Playwright.

## What It Does

Given an `ASIN`, the scraper:

1. Opens `https://www.amazon.in/dp/{ASIN}`
2. Waits for the product page to load
3. Extracts:
   - price
   - availability
   - delivery estimate
   - rating
   - review count
4. Returns structured JSON

The API retries once for transient failures. CAPTCHA and hard timeouts are not retried.

## Local Setup

Use Node.js `20.x` or `22.x` if possible.

```bash
npm install
npm run playwright:install
```

Start the app:

```bash
npm run dev
```

Open:

- UI: [http://localhost:4028/amazon-product-scraper](http://localhost:4028/amazon-product-scraper)

## API

Endpoint:

```bash
POST /api/scrape
```

Request body:

```json
{
  "asin": "B0CHX1W1XY"
}
```

Example `curl`:

```bash
curl -X POST http://localhost:4028/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"asin":"B0CHX1W1XY"}'
```

Example response shape:

```json
{
  "asin": "B0CHX1W1XY",
  "url": "https://www.amazon.in/dp/B0CHX1W1XY",
  "scrapedAt": "2026-04-28T12:00:00.000Z",
  "duration": 8421,
  "retried": false,
  "data": {
    "price": "₹66,999",
    "priceRaw": 66999,
    "availability": "In stock",
    "availabilityStatus": "in_stock",
    "deliveryEstimate": "FREE delivery Friday, 2 May",
    "deliveryDate": "2026-05-02",
    "rating": "4.5",
    "reviewCount": "1234",
    "title": "Example product title",
    "seller": "Example seller"
  }
}
```

## Non-Headless Testing

If you want to visually watch Playwright:

```bash
PLAYWRIGHT_HEADLESS=false npm run dev
```

## Recommended Local Mode For Amazon Blocks

If Amazon keeps returning `blocked: true`, use a real Chrome session with a persistent profile:

```bash
PLAYWRIGHT_HEADLESS=false \
AMAZON_BROWSER_CHANNEL=chrome \
AMAZON_PERSISTENT_SESSION=true \
npm run dev
```

This does four useful things:

- uses installed Chrome instead of bundled Chromium
- keeps cookies/session across runs
- warms up on `amazon.in` before opening the product page
- supports manual recovery if Amazon shows a CAPTCHA or sorry page

The persistent profile will be created under:

```bash
.playwright/amazon-profile
```

If Chrome is not installed or you want a custom profile path:

```bash
PLAYWRIGHT_HEADLESS=false \
AMAZON_BROWSER_CHANNEL=chrome \
AMAZON_PERSISTENT_SESSION=true \
AMAZON_PROFILE_DIR=/absolute/path/to/profile \
npm run dev
```

If Amazon shows a sorry/CAPTCHA page in headed mode:

1. Leave the scrape request running.
2. Solve the CAPTCHA or browse normally in the opened Amazon window.
3. Keep the product page open.
4. The API will keep polling for up to about 120 seconds by default and then continue automatically.

Optional knobs:

```bash
AMAZON_MANUAL_RECOVERY=true
AMAZON_MANUAL_WAIT_MS=180000
AMAZON_REQUEST_TIMEOUT_MS=180000
```

## Quick Test Checklist

1. Start the app with `npm run dev`.
2. Open the UI and run a known ASIN.
3. Confirm the result card shows price, availability, delivery estimate, rating, and review count.
4. Open the JSON tab and confirm the response payload is populated.
5. Run the same test once through `curl` to validate the API directly.
6. Try one invalid ASIN like `ABC` and confirm the API returns `400`.
7. If you get `blocked: true`, restart in headed Chrome persistent mode and retry.

## Notes

- This is an MVP scraper, not a production anti-bot system.
- Delivery estimate is based on Amazon's default current session/location.
- Amazon can still show CAPTCHA or vary selectors.
- Local testing is more reliable with normal Playwright than `playwright-core`.
- If your IP is already rate-limited by Amazon, even headed mode may still be blocked.
# amazonscraper
