import { NextRequest, NextResponse } from 'next/server';
import { mkdir } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

interface ScrapeRequestBody {
  asin: string;
  pincode?: string;
}

interface ScrapeData {
  price: string | null;
  priceRaw: number | null;
  listPrice: string | null;
  listPriceRaw: number | null;
  discountPercent: string | null;
  dealBadge: string | null;
  primeAvailable: boolean;
  brand: string | null;
  category: string | null;
  categories: string[];
  images: string[];
  imageCount: number;
  bulletPoints: string[];
  productDescription: string | null;
  aPlusContent: boolean;
  availability: string | null;
  availabilityStatus: 'in_stock' | 'out_of_stock' | 'limited' | 'unknown';
  deliveryEstimate: string | null;
  deliveryDate: string | null;
  rating: string | null;
  reviewCount: string | null;
  title: string | null;
  seller: string | null;
}

interface ScrapeResult {
  asin: string;
  pincode: string;
  url: string;
  scrapedAt: string;
  duration: number;
  retried: boolean;
  data: ScrapeData;
  error?: string;
}

type PlaywrightPage = import('playwright').Page;
type PlaywrightBrowserContext = import('playwright').BrowserContext;
type PlaywrightLocator = import('playwright').Locator;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
];

const PRODUCT_READY_SELECTORS = [
  '#productTitle',
  '#centerCol',
  '#ppd',
  '#corePriceDisplay_desktop_feature_div',
];

class ScraperError extends Error {
  code:
    | 'BLOCKED_BY_AMAZON' |'CAPTCHA_DETECTED' |'SCRAPE_TIMEOUT' |'SCRAPE_FAILED';

  constructor(
    code:
      | 'BLOCKED_BY_AMAZON' |'CAPTCHA_DETECTED' |'SCRAPE_TIMEOUT' |'SCRAPE_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'ScraperError';
    this.code = code;
  }
}

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function envNumber(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function humanDelay(min = 300, max = 900): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

function extractNumber(raw: string | null): number | null {
  if (!raw) return null;
  const normalized = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new ScraperError('SCRAPE_TIMEOUT', message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function firstVisible(page: PlaywrightPage, selectors: string[]): Promise<PlaywrightLocator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      try {
        if (await locator.isVisible({ timeout: 750 })) {
          return locator;
        }
      } catch {
        // Try the next selector.
      }
    }
  }

  return null;
}

async function ensurePageReady(page: PlaywrightPage): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout: 30_000 });

  for (const selector of PRODUCT_READY_SELECTORS) {
    try {
      await page.locator(selector).first().waitFor({ state: 'visible', timeout: 5_000 });
      return;
    } catch {
      // Keep trying fallbacks.
    }
  }
}

async function detectAmazonBlock(page: PlaywrightPage): Promise<void> {
  const bodyText = (await page.textContent('body').catch(() => ''))?.toLowerCase() ?? '';
  const titleText = (await page.title().catch(() => '')).toLowerCase();

  const blockedPage =
    titleText.includes('503') ||
    titleText.includes('service unavailable') ||
    bodyText.includes('api-services-support@amazon.com') ||
    bodyText.includes("we're sorry") ||
    bodyText.includes('an error occurred when we tried to process your request');

  if (blockedPage) {
    throw new ScraperError(
      'BLOCKED_BY_AMAZON',
      'Amazon returned a blocked/service-unavailable page for this request.'
    );
  }

  const captchaDetected =
    bodyText.includes('enter the characters you see below') ||
    bodyText.includes('sorry, we just need to make sure') ||
    bodyText.includes('robot check') ||
    (await page.locator('form[action="/errors/validateCaptcha"]').count()) > 0;

  if (captchaDetected) {
    throw new ScraperError(
      'CAPTCHA_DETECTED',
      'Amazon showed a CAPTCHA page. Wait a bit and retry.'
    );
  }
}

function manualRecoveryEnabled(): boolean {
  return process.env.PLAYWRIGHT_HEADLESS === 'false' && envFlag('AMAZON_MANUAL_RECOVERY', true);
}

async function waitForManualRecovery(
  page: PlaywrightPage,
  reason: ScraperError,
  phase: 'warmup' | 'product'
): Promise<boolean> {
  const waitMs = envNumber('AMAZON_MANUAL_WAIT_MS', 120_000);
  const deadline = Date.now() + waitMs;

  console.log(
    `[amazon-scraper] ${reason.code} during ${phase}. Browser will stay open for manual recovery for ${Math.round(
      waitMs / 1000
    )}s.`
  );
  console.log(
    '[amazon-scraper] If Amazon shows CAPTCHA / sorry page, solve it in the opened browser window and leave the product page open.'
  );

  await page.bringToFront().catch(() => {});

  while (Date.now() < deadline) {
    await humanDelay(1500, 2500);

    try {
      await detectAmazonBlock(page);
      return true;
    } catch (error) {
      if (!(error instanceof ScraperError)) {
        throw error;
      }

      if (error.code !== 'BLOCKED_BY_AMAZON' && error.code !== 'CAPTCHA_DETECTED') {
        throw error;
      }
    }
  }

  return false;
}

async function ensureAmazonAccessible(
  page: PlaywrightPage,
  phase: 'warmup' | 'product',
  productUrl?: string
): Promise<void> {
  try {
    await detectAmazonBlock(page);
  } catch (error) {
    if (
      !manualRecoveryEnabled() ||
      !(error instanceof ScraperError) ||
      (error.code !== 'BLOCKED_BY_AMAZON' && error.code !== 'CAPTCHA_DETECTED')
    ) {
      throw error;
    }

    const recovered = await waitForManualRecovery(page, error, phase);
    if (!recovered) {
      throw error;
    }

    if (phase === 'product' && productUrl) {
      const onProductPage = page.url().includes('/dp/');
      if (!onProductPage) {
        await page.goto(productUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
          referer: 'https://www.amazon.in/',
        });
        await humanDelay(1000, 1800);
      }
    }

    await detectAmazonBlock(page);
  }
}

let sharedAmazonContext: PlaywrightBrowserContext | null = null;
let sharedAmazonClose: (() => Promise<void>) | null = null;

async function launchBrowser(): Promise<{
  context: PlaywrightBrowserContext;
  close: () => Promise<void>;
  reused: boolean;
}> {
  const reuseBrowser = envFlag('AMAZON_REUSE_BROWSER', true);
  if (reuseBrowser && sharedAmazonContext) {
    return {
      context: sharedAmazonContext,
      close: async () => {},
      reused: true,
    };
  }

  const { chromium } = await import('playwright');
  const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
  const usePersistentContext = envFlag('AMAZON_PERSISTENT_SESSION', !headless);
  const browserChannel = process.env.AMAZON_BROWSER_CHANNEL;
  const contextOptions = {
    viewport: { width: 1440, height: 900 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    extraHTTPHeaders: {
      'Accept-Language': 'en-IN,en;q=0.9',
    },
    ...(headless ? { userAgent: randomUA() } : {}),
  };
  const launchOptions = {
    headless,
    slowMo: headless ? 0 : 120,
    channel: browserChannel || undefined,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-infobars',
      '--lang=en-IN',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  };

  let context: PlaywrightBrowserContext;
  let browser: import('playwright').Browser | undefined;
  let close: () => Promise<void>;

  if (usePersistentContext) {
    const profileDir =
      process.env.AMAZON_PROFILE_DIR ||
      path.join(process.cwd(), '.playwright', headless ? 'amazon-headless-profile' : 'amazon-profile');

    await mkdir(profileDir, { recursive: true });
    context = await chromium.launchPersistentContext(profileDir, {
      ...launchOptions,
      ...contextOptions,
    });
    close = async () => {
      await context.close().catch(() => {});
    };
  } else {
    browser = await chromium.launch(launchOptions);
    context = await browser.newContext(contextOptions);
    close = async () => {
      await context.close().catch(() => {});
      await browser?.close().catch(() => {});
    };
  }

  if (reuseBrowser) {
    sharedAmazonContext = context;
    sharedAmazonClose = async () => {
      await close();
      sharedAmazonContext = null;
      sharedAmazonClose = null;
    };
    close = async () => {};
  }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en', 'en-GB'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(window, 'chrome', { value: { runtime: {} } });
  });

  return { context, close };
}

async function warmupAmazonSession(page: PlaywrightPage): Promise<void> {
  await page.goto('https://www.amazon.in/', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await humanDelay(1200, 2200);
  await ensureAmazonAccessible(page, 'warmup');

  const cookieButton = await firstVisible(page, [
    'input[name="accept"]',
    '#sp-cc-accept',
    '[aria-label*="Accept Cookies" i]',
  ]);

  if (cookieButton) {
    await cookieButton.click({ delay: 75 }).catch(() => {});
    await humanDelay(500, 900);
  }
}

async function extractProductData(page: PlaywrightPage): Promise<ScrapeData> {
  const payload = await page.evaluate(() => {
    const normalize = (value: string | null | undefined) => {
      if (value == null) return null;
      return String(value).replace(/\s+/g, ' ').trim() || null;
    };

    const isVisible = (el: Element) => {
      const element = el as HTMLElement;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const firstText = (selectors: string[]) => {
      for (const selector of selectors) {
        const nodes = Array.from(document.querySelectorAll(selector));
        for (const node of nodes) {
          const text =
            normalize((node as HTMLElement).innerText) ||
            normalize(node.textContent) ||
            normalize(node.getAttribute('aria-label')) ||
            normalize((node as HTMLInputElement).value);

          if (!text) continue;
          if (!isVisible(node)) continue;
          return text;
        }
      }
      return null;
    };

    const title = firstText(['#productTitle', '#title span', 'h1.a-size-large']);

    const price =
      firstText([
        '#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        '#corePrice_feature_div .priceToPay .a-offscreen',
        '#corePrice_feature_div .a-price .a-offscreen',
        '#apex_desktop .priceToPay .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '#priceblock_saleprice',
        '#price_inside_buybox',
      ]) ||
      (() => {
        const whole = normalize(
          document.querySelector('.a-price.aok-align-center .a-price-whole')?.textContent
        );
        const fraction = normalize(
          document.querySelector('.a-price.aok-align-center .a-price-fraction')?.textContent
        );
        if (!whole) return null;
        return fraction ? `₹${whole}.${fraction}` : `₹${whole}`;
      })();

    const availabilityText = firstText([
      '#availability span',
      '#availability',
      '#outOfStock .a-color-state',
      '#buybox-see-all-buying-choices',
      '#merchant-info',
    ]);

    const deliveryEstimate = firstText([
      '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE',
      '#mir-layout-DELIVERY_BLOCK-slot-SECONDARY_DELIVERY_MESSAGE_LARGE',
      '#deliveryBlockMessage',
      '#deliveryMessageMirId',
      '#ddmDeliveryMessage',
      '#dynamicDeliveryMessage',
      '[data-cy="delivery-recipe"]',
    ]);

    const ratingText = firstText([
      '#acrPopover .a-icon-alt',
      '#averageCustomerReviews .a-icon-alt',
      'span[data-hook="rating-out-of-text"]',
    ]);

    const reviewCountText = firstText([
      '#acrCustomerReviewText',
      '#acrCustomerReviewLink span',
      'span[data-hook="total-review-count"]',
    ]);

    const seller = firstText([
      '#merchant-info a',
      '#sellerProfileTriggerId',
      '#tabular-buybox-truncate-0 .tabular-buybox-text',
      '#shipsFromSoldBy_feature_div .tabular-buybox-text[tabular-attribute-name="Sold by"]',
    ]);

    const brand = firstText(['#bylineInfo', '#brand', '#bylineInfo_feature_div']);

    const categories = Array.from(
      document.querySelectorAll(
        '#wayfinding-breadcrumbs_feature_div li a, #wayfinding-breadcrumbs_container a, .a-unordered-list.a-horizontal li a'
      )
    )
      .map((node) => normalize((node as HTMLElement).innerText) || normalize((node as HTMLElement).textContent))
      .filter(Boolean);

    const imageSrcs = Array.from(
      document.querySelectorAll('#altImages img, #imgTagWrapperId img, #landingImage, .imageBlock img')
    )
      .map((img) => normalize((img as HTMLImageElement).src) || normalize((img as HTMLImageElement).getAttribute('data-src')))
      .filter(Boolean);

    const images = Array.from(new Set(imageSrcs));

    const listPrice = firstText([
      '.a-text-strike',
      '#priceblock_listprice',
      '#listPriceValue',
      '#priceblock_ourprice_row .a-text-strike',
      '#priceblock_ourprice',
    ]);

    const dealBadge = firstText(['#dealBadge', '#deal_badge_text', '.dealBadge', '.a-badge-text']);
    const primeAvailable = !!document.querySelector('.a-icon-prime, .prime-logo, #primeEligibility, #primeLogo');

    const bulletPoints = Array.from(
      document.querySelectorAll('#feature-bullets li span.a-list-item, #feature-bullets li')
    )
      .map((node) => normalize((node as HTMLElement).innerText) || normalize((node as HTMLElement).textContent))
      .filter(Boolean);

    const productDescription = firstText([
      '#productDescription p',
      '#productDescription',
      '#bookDescription_feature_div',
      '#aplus .a-section',
    ]);

    const aPlusContent = !!document.querySelector('#aplus, #aplus_feature_div, #dpx-aplus, .aplus-module');

    const addToCartButton = document.querySelector('#add-to-cart-button') as
      | HTMLInputElement
      | HTMLButtonElement
      | null;

    const buyNowButton = document.querySelector('#buy-now-button') as
      | HTMLInputElement
      | HTMLButtonElement
      | null;

    const availabilitySignals = {
      addToCartVisible: !!addToCartButton && isVisible(addToCartButton),
      addToCartDisabled:
        !!addToCartButton && ('disabled' in addToCartButton ? !!addToCartButton.disabled : false),
      buyNowVisible: !!buyNowButton && isVisible(buyNowButton),
    };

    return {
      title,
      price,
      listPrice,
      dealBadge,
      primeAvailable,
      brand,
      categories,
      images,
      bulletPoints,
      productDescription,
      aPlusContent,
      availabilityText,
      deliveryEstimate,
      ratingText,
      reviewCountText,
      seller,
      availabilitySignals,
    };
  });

  const ratingMatch = payload.ratingText?.match(/(\d+(?:\.\d+)?)/);
  const rating = ratingMatch ? ratingMatch[1] : null;

  const reviewCountMatch = payload.reviewCountText?.match(/([\d,]+)/);
  const reviewCount = reviewCountMatch ? reviewCountMatch[1] : payload.reviewCountText;

  const images = payload.images ?? [];
  const categories = payload.categories ?? [];
  const priceRaw = extractNumber(payload.price);
  const listPriceRaw = extractNumber(payload.listPrice);
  const discountPercent =
    priceRaw != null && listPriceRaw != null && listPriceRaw > priceRaw
      ? `${Math.round(((listPriceRaw - priceRaw) / listPriceRaw) * 100)}%`
      : null;

  const category = categories.length > 0 ? categories[categories.length - 1] : null;

  let availabilityStatus: ScrapeData['availabilityStatus'] = 'unknown';
  const normalizedAvailability = payload.availabilityText?.toLowerCase() ?? '';

  if (
    normalizedAvailability.includes('currently unavailable') ||
    normalizedAvailability.includes('out of stock') ||
    normalizedAvailability.includes('unavailable')
  ) {
    availabilityStatus = 'out_of_stock';
  } else if (normalizedAvailability.includes('only') && normalizedAvailability.includes('left')) {
    availabilityStatus = 'limited';
  } else if (
    normalizedAvailability.includes('in stock') ||
    payload.availabilitySignals.addToCartVisible ||
    payload.availabilitySignals.buyNowVisible
  ) {
    availabilityStatus = 'in_stock';
  } else if (payload.availabilitySignals.addToCartDisabled) {
    availabilityStatus = 'out_of_stock';
  }

  let deliveryDate: string | null = null;
  if (payload.deliveryEstimate) {
    const dateMatch = payload.deliveryEstimate.match(
      /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+\d{1,2}\s+\w+|\b\d{1,2}\s+\w+\b/i
    );

    if (dateMatch) {
      const parsed = new Date(`${dateMatch[0]} ${new Date().getFullYear()}`);
      if (!Number.isNaN(parsed.getTime())) {
        deliveryDate = parsed.toISOString().slice(0, 10);
      }
    }
  }

  return {
    price: cleanText(payload.price),
    priceRaw,
    listPrice: cleanText(payload.listPrice),
    listPriceRaw,
    discountPercent,
    dealBadge: cleanText(payload.dealBadge),
    primeAvailable: payload.primeAvailable,
    brand: cleanText(payload.brand),
    category: cleanText(category),
    categories: payload.categories,
    images,
    imageCount: images.length,
    bulletPoints: payload.bulletPoints,
    productDescription: cleanText(payload.productDescription),
    aPlusContent: payload.aPlusContent,
    availability: cleanText(payload.availabilityText),
    availabilityStatus,
    deliveryEstimate: cleanText(payload.deliveryEstimate),
    deliveryDate,
    rating,
    reviewCount: cleanText(reviewCount),
    title: cleanText(payload.title),
    seller: cleanText(payload.seller),
  };
}

async function setPincodeOnPage(page: PlaywrightPage, pincode: string): Promise<void> {
  try {
    // Try to find and click the delivery location link
    const locationLink = await firstVisible(page, [
      '#nav-global-location-popover-link',
      '#glow-ingress-line2',
      '[data-action="a-modal-trigger"]',
    ]);
    if (!locationLink) return;

    await locationLink.click({ delay: 80 });
    await humanDelay(800, 1400);

    // Find pincode input
    const pincodeInput = await firstVisible(page, [
      'input[data-action="GLUXPostalInputAction"]',
      '#GLUXZipUpdateInput',
      'input[placeholder*="PIN" i]',
      'input[placeholder*="pincode" i]',
      'input[placeholder*="zip" i]',
    ]);
    if (!pincodeInput) return;

    await pincodeInput.fill('');
    await humanDelay(200, 400);
    await pincodeInput.type(pincode, { delay: 80 });
    await humanDelay(400, 700);

    // Submit
    const applyBtn = await firstVisible(page, [
      '#GLUXZipUpdate',
      'input[data-action="GLUXPostalInputAction"]',
      'span.a-button-text',
    ]);
    if (applyBtn) {
      await applyBtn.click({ delay: 60 });
      await humanDelay(1000, 1800);
    }

    // Close modal if still open
    const closeBtn = await firstVisible(page, [
      'button.a-popover-close',
      '.a-popover-footer .a-button-primary',
    ]);
    if (closeBtn) {
      await closeBtn.click({ delay: 60 });
      await humanDelay(500, 900);
    }
  } catch {
    // Pincode setting is best-effort; continue without it
  }
}

async function runScraper(asin: string, pincode: string, attempt = 1): Promise<ScrapeResult> {
  const url = `https://www.amazon.in/dp/${asin}`;
  const startTime = Date.now();

  const { context, close, reused } = await launchBrowser();
  const page = await context.newPage();

  try {
    if (envFlag('AMAZON_WARMUP_HOME', true) && !reused) {
      await warmupAmazonSession(page);
    }

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
      referer: 'https://www.amazon.in/',
    });
    await humanDelay(1200, 2200);
    await ensureAmazonAccessible(page, 'product', url);
    await ensurePageReady(page);

    // Set pincode if provided
    if (pincode && /^\d{6}$/.test(pincode)) {
      await setPincodeOnPage(page, pincode);
      // Re-navigate to product page after pincode change to get updated delivery info
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
        referer: 'https://www.amazon.in/',
      });
      await humanDelay(1000, 1800);
      await ensurePageReady(page);
    }

    const data = await extractProductData(page);

    return {
      asin,
      pincode,
      url,
      scrapedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      retried: attempt > 1,
      data,
    };
  } catch (error) {
    if (error instanceof ScraperError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown scraper error';
    throw new ScraperError('SCRAPE_FAILED', message);
  } finally {
    await page.close().catch(() => {});
    await close();
  }
}

function normalizeError(error: unknown): ScraperError {
  if (error instanceof ScraperError) return error;

  const message = error instanceof Error ? error.message : 'Unknown scraper error';
  return new ScraperError('SCRAPE_FAILED', message);
}

function toErrorResponse(error: ScraperError) {
  if (error.code === 'BLOCKED_BY_AMAZON') {
    return NextResponse.json(
      {
        error:
          'Amazon returned a blocked or service-unavailable page for this request. Try again later or from a different IP/session.',
        blocked: true,
        hint:
          'For local MVP testing, try headed Chrome with a persistent profile: PLAYWRIGHT_HEADLESS=false AMAZON_BROWSER_CHANNEL=chrome AMAZON_PERSISTENT_SESSION=true npm run dev',
      },
      { status: 503 }
    );
  }

  if (error.code === 'CAPTCHA_DETECTED') {
    return NextResponse.json(
      {
        error: 'CAPTCHA detected on amazon.in. Please wait a few minutes and try again.',
        captcha: true,
      },
      { status: 503 }
    );
  }

  if (error.code === 'SCRAPE_TIMEOUT') {
    return NextResponse.json({ error: error.message }, { status: 504 });
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}

export async function POST(req: NextRequest) {
  let body: ScrapeRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const asin = body.asin?.trim().toUpperCase();
  const pincode = body.pincode?.trim() ?? '';

  if (!asin) {
    return NextResponse.json({ error: 'asin is required' }, { status: 400 });
  }

  if (!/^[A-Z0-9]{10}$/.test(asin)) {
    return NextResponse.json(
      { error: 'Invalid ASIN format. Expected exactly 10 alphanumeric characters.' },
      { status: 400 }
    );
  }

  const requestTimeoutMs = envNumber(
    'AMAZON_REQUEST_TIMEOUT_MS',
    manualRecoveryEnabled() ? 180_000 : 60_000
  );

  try {
    const firstAttempt = await withTimeout(
      runScraper(asin, pincode, 1),
      requestTimeoutMs,
      `Scrape timed out after ${Math.round(requestTimeoutMs / 1000)} seconds`
    );

    return NextResponse.json(firstAttempt);
  } catch (firstError) {
    const normalizedFirstError = normalizeError(firstError);

    if (
      normalizedFirstError.code === 'BLOCKED_BY_AMAZON' ||
      normalizedFirstError.code === 'CAPTCHA_DETECTED' ||
      normalizedFirstError.code === 'SCRAPE_TIMEOUT'
    ) {
      return toErrorResponse(normalizedFirstError);
    }

    try {
      const secondAttempt = await withTimeout(
        runScraper(asin, pincode, 2),
        requestTimeoutMs,
        `Scrape timed out after ${Math.round(requestTimeoutMs / 1000)} seconds`
      );

      secondAttempt.retried = true;
      return NextResponse.json(secondAttempt);
    } catch (secondError) {
      return toErrorResponse(normalizeError(secondError));
    }
  }
}
