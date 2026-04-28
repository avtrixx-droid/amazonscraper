'use client';

import React, { useState, useCallback } from 'react';
import ScrapeForm from './ScrapeForm';
import ScrapeStatus from './ScrapeStatus';
import ResultCard from './ResultCard';
import JsonViewer from './JsonViewer';
import ScrapeHistory from './ScrapeHistory';
import SelectorHealth from './SelectorHealth';
import { toast } from 'sonner';

export type ScrapeStatus =
  | 'idle' |'queued' |'scraping' |'retrying' |'complete' |'failed';

export interface ScrapeResult {
  asin: string;
  url: string;
  scrapedAt: string;
  duration: number;
  retried: boolean;
  data: {
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
  };
  error?: string;
}

export interface HistoryEntry {
  id: string;
  asin: string;
  status: ScrapeStatus;
  duration: number;
  retried: boolean;
  scrapedAt: string;
  price: string | null;
  availability: string | null;
}

// ── Real scrape via API route ────────────────────────────────────────────────
async function runScrape(
  asin: string,
  onStatusChange: (s: ScrapeStatus) => void,
  onProgress: (msg: string) => void
): Promise<ScrapeResult> {
  onStatusChange('queued');
  onProgress('Queuing scrape job…');
  await delay(300);

  onStatusChange('scraping');
  onProgress('Launching Playwright browser (Chromium)…');
  await delay(600);

  onProgress(`Navigating to amazon.in/dp/${asin}…`);
  await delay(400);

  onProgress('Page loaded — checking Amazon session…');
  await delay(300);

  onProgress('Opening product page and waiting for content…');
  await delay(300);

  onProgress('Reading price, availability, delivery estimate, rating…');

  const res = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asin }),
  });

  const json = await res.json();

  if (!res.ok) {
    const errMsg = json?.error ?? `HTTP ${res.status}`;
    if (json?.captcha) {
      onStatusChange('failed');
      onProgress('Scrape failed — CAPTCHA detected. Retry in a few minutes.');
      throw new Error(errMsg);
    }

    onProgress(`Scrape failed — ${errMsg}`);
    onStatusChange('failed');
    throw new Error(errMsg);
  }

  if (json.retried) {
    onStatusChange('retrying');
    onProgress('First attempt timed out — retrying (attempt 2/2)…');
    await delay(600);
    onProgress('Retry successful — extracting data…');
    await delay(400);
  }

  onProgress('Extracting price, availability, delivery, rating…');
  await delay(300);
  onProgress('Parsing structured data…');
  await delay(200);

  onStatusChange('complete');
  return json as ScrapeResult;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Initial history mock data ────────────────────────────────────────────────
const INITIAL_HISTORY: HistoryEntry[] = [
  {
    id: 'job-001',
    asin: 'B0CHX1W1XY',
    status: 'complete',
    duration: 4102,
    retried: false,
    scrapedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    price: '₹66,999',
    availability: 'In stock',
  },
  {
    id: 'job-002',
    asin: 'B0BDJH4GGG',
    status: 'complete',
    duration: 5318,
    retried: true,
    scrapedAt: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
    price: '₹84,999',
    availability: 'Only 3 left in stock',
  },
  {
    id: 'job-003',
    asin: 'B09G9FPHY6',
    status: 'failed',
    duration: 8200,
    retried: true,
    scrapedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    price: null,
    availability: null,
  },
  {
    id: 'job-004',
    asin: 'B0CHX1W1XY',
    status: 'complete',
    duration: 3901,
    retried: false,
    scrapedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    price: '₹66,999',
    availability: 'In stock',
  },
  {
    id: 'job-005',
    asin: 'B08N5WRWNW',
    status: 'complete',
    duration: 4450,
    retried: false,
    scrapedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    price: '₹5,299',
    availability: 'In stock',
  },
  {
    id: 'job-006',
    asin: 'B07VGRJDFY',
    status: 'complete',
    duration: 6100,
    retried: true,
    scrapedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    price: '₹12,499',
    availability: 'In stock',
  },
  {
    id: 'job-007',
    asin: 'B09X7CRKRZ',
    status: 'failed',
    duration: 9100,
    retried: true,
    scrapedAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    price: null,
    availability: null,
  },
];

export default function ScraperPanel() {
  const [status, setStatus] = useState<ScrapeStatus>('idle');
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(INITIAL_HISTORY);
  const [activeTab, setActiveTab] = useState<'result' | 'json'>('result');

  const handleScrape = useCallback(
    async (asin: string) => {
      setStatus('idle');
      setProgressLog([]);
      setResult(null);
      setError(null);

      const startTs = Date.now();

      try {
        const res = await runScrape(
          asin,
          (s) => setStatus(s),
          (msg) => setProgressLog((prev) => [...prev, msg])
        );
        setResult(res);
        setStatus('complete');
        toast.success('Scrape completed successfully', {
          description: `${asin} · ${(res.duration / 1000).toFixed(1)}s${res.retried ? ' (retried)' : ''}`,
        });

        const entry: HistoryEntry = {
          id: `job-${Date.now()}`,
          asin,
          status: 'complete',
          duration: res.duration,
          retried: res.retried,
          scrapedAt: res.scrapedAt,
          price: res.data.price,
          availability: res.data.availability,
        };
        setHistory((prev) => [entry, ...prev.slice(0, 9)]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown scrape error';
        setError(msg);
        setStatus('failed');
        toast.error('Scrape failed', { description: msg });

        const entry: HistoryEntry = {
          id: `job-${Date.now()}`,
          asin,
          status: 'failed',
          duration: Date.now() - startTs,
          retried: false,
          scrapedAt: new Date().toISOString(),
          price: null,
          availability: null,
        };
        setHistory((prev) => [entry, ...prev.slice(0, 9)]);
      }
    },
    []
  );

  const handleRerun = useCallback(
    (asin: string) => {
      handleScrape(asin);
    },
    [handleScrape]
  );

  const isRunning = status === 'queued' || status === 'scraping' || status === 'retrying';

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">
            Amazon Product Scraper
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Extract price, availability, delivery &amp; rating from{' '}
            <span className="text-orange-400 font-mono">amazon.in</span> using
            Playwright. Max 50 requests/day.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500">
          <span className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700/50">
            Node.js + Playwright
          </span>
          <span className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700/50">
            amazon.in
          </span>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] 2xl:grid-cols-[460px_1fr] gap-6">
        {/* ── Left Column ── */}
        <div className="flex flex-col gap-4">
          <ScrapeForm onScrape={handleScrape} isRunning={isRunning} />
          <ScrapeStatus
            status={status}
            progressLog={progressLog}
            error={error}
          />
          <SelectorHealth />
        </div>

        {/* ── Right Column ── */}
        <div className="flex flex-col gap-4">
          {/* Tab switcher */}
          {(result || status === 'failed') && (
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900/60 border border-slate-800/60 w-fit fade-in">
              <button
                onClick={() => setActiveTab('result')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                  activeTab === 'result' ?'bg-slate-800 text-slate-100 shadow-sm' :'text-slate-400 hover:text-slate-200'
                }`}
              >
                Result Card
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                  activeTab === 'json' ?'bg-slate-800 text-slate-100 shadow-sm' :'text-slate-400 hover:text-slate-200'
                }`}
              >
                JSON / CSV
              </button>
            </div>
          )}

          {/* Result or placeholder */}
          {status === 'idle' && !result && (
            <EmptyResultPlaceholder />
          )}
          {isRunning && !result && (
            <ResultSkeleton />
          )}
          {result && activeTab === 'result' && (
            <ResultCard result={result} />
          )}
          {result && activeTab === 'json' && (
            <JsonViewer result={result} />
          )}
          {status === 'failed' && !result && (
            <FailedState error={error} />
          )}

          {/* History always visible */}
          <ScrapeHistory history={history} onRerun={handleRerun} isRunning={isRunning} />
        </div>
      </div>
    </div>
  );
}

function EmptyResultPlaceholder() {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
      <div className="w-14 h-14 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <p className="text-slate-400 font-medium text-sm">No scrape results yet</p>
      <p className="text-slate-600 text-xs mt-1 max-w-xs">
        Enter an ASIN on the left, then click{' '}
        <span className="text-orange-400">Run Scraper</span> to extract product
        data from amazon.in
      </p>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-6 space-y-4 min-h-[280px]">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-5 w-3/4 rounded bg-slate-800 shimmer" />
          <div className="h-3.5 w-1/2 rounded bg-slate-800/60 shimmer" />
        </div>
        <div className="h-6 w-20 rounded-full bg-slate-800 shimmer ml-4" />
      </div>
      <div className="h-px bg-slate-800/60" />
      <div className="grid grid-cols-2 gap-4">
        {['field-1','field-2','field-3','field-4','field-5','field-6'].map((k) => (
          <div key={k} className="space-y-1.5">
            <div className="h-3 w-16 rounded bg-slate-800/60 shimmer" />
            <div className="h-5 w-24 rounded bg-slate-800 shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FailedState({ error }: { error: string | null }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 flex flex-col items-center justify-center text-center min-h-[200px] fade-in">
      <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="text-red-400 font-medium text-sm">Scrape Failed</p>
      <p className="text-red-400/70 text-xs mt-1 max-w-sm font-mono">
        {error ?? 'Unknown error occurred during scrape'}
      </p>
      <p className="text-slate-500 text-xs mt-3">
        Retry was attempted once. Check selector health or try a different ASIN.
      </p>
    </div>
  );
}
