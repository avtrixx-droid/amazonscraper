'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScrapeResultData {
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

export interface ScrapeResult {
  asin: string;
  pincode: string;
  url: string;
  scrapedAt: string;
  duration: number;
  retried: boolean;
  data: ScrapeResultData;
  error?: string;
}

interface AsinEntry {
  id: string;
  value: string;
}

interface RowResult {
  id: string;
  asin: string;
  pincode: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  result: ScrapeResult | null;
  error: string | null;
}

const STORAGE_KEY = 'amazon_scraper_history_v2';
const MAX_HISTORY = 5;

function extractAsin(input: string): string | null {
  const trimmed = input.trim();
  // Direct ASIN
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) return trimmed.toUpperCase();
  // URL pattern: /dp/XXXXXXXXXX or /gp/product/XXXXXXXXXX
  const match = trimmed.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  if (match) return match[1].toUpperCase();
  return null;
}

function isFastDelivery(deliveryEstimate: string | null): boolean {
  if (!deliveryEstimate) return false;
  const lower = deliveryEstimate.toLowerCase();
  return lower.includes('today') || lower.includes('tomorrow') || lower.includes('tonight');
}

function downloadCSV(rows: RowResult[]) {
  const headers = ['asin', 'pincode', 'title', 'price', 'rating', 'review_count', 'delivery_date', 'shipping', 'availability', 'seller'];
  const csvRows = [headers.join(',')];
  for (const row of rows) {
    if (row.status !== 'done' || !row.result) continue;
    const d = row.result.data;
    const escape = (v: string | null | undefined) => {
      if (!v) return '';
      return `"${String(v).replace(/"/g, '""')}"`;
    };
    const shippingType = d.primeAvailable ? 'Prime' : (d.deliveryEstimate?.toLowerCase().includes('free') ? 'Free' : 'Paid');
    csvRows.push([
      escape(row.asin),
      escape(row.pincode),
      escape(d.title),
      escape(d.price),
      escape(d.rating),
      escape(d.reviewCount),
      escape(d.deliveryDate ?? d.deliveryEstimate),
      escape(shippingType),
      escape(d.availability),
      escape(d.seller),
    ].join(','));
  }
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `amazon_scrape_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ScraperPanel() {
  const [asinEntries, setAsinEntries] = useState<AsinEntry[]>([{ id: uid(), value: '' }]);
  const [pincode, setPincode] = useState('');
  const [rows, setRows] = useState<RowResult[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const abortRef = useRef(false);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  }, []);

  const saveToHistory = useCallback((asins: string[]) => {
    setRecentSearches((prev) => {
      const combined = [...asins, ...prev.filter((a) => !asins.includes(a))].slice(0, MAX_HISTORY);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(combined)); } catch {}
      return combined;
    });
  }, []);

  const addAsinEntry = () => {
    setAsinEntries((prev) => [...prev, { id: uid(), value: '' }]);
  };

  const removeAsinEntry = (id: string) => {
    setAsinEntries((prev) => prev.length > 1 ? prev.filter((e) => e.id !== id) : prev);
  };

  const updateAsinEntry = (id: string, value: string) => {
    setAsinEntries((prev) => prev.map((e) => e.id === id ? { ...e, value } : e));
  };

  const handleClearAll = () => {
    setRows([]);
    setExpandedRows(new Set());
    setAsinEntries([{ id: uid(), value: '' }]);
    setPincode('');
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFetch = useCallback(async () => {
    const validEntries: { asin: string; pincode: string }[] = [];

    for (const entry of asinEntries) {
      const asin = extractAsin(entry.value);
      if (!asin) {
        toast.error(`Invalid ASIN or URL: "${entry.value || '(empty)'}"`);
        return;
      }
      validEntries.push({ asin, pincode: pincode.trim() });
    }

    if (validEntries.length === 0) {
      toast.error('Enter at least one ASIN or Amazon URL');
      return;
    }

    abortRef.current = false;
    setIsRunning(true);
    setExpandedRows(new Set());

    const initialRows: RowResult[] = validEntries.map((e) => ({
      id: uid(),
      asin: e.asin,
      pincode: e.pincode,
      status: 'pending',
      result: null,
      error: null,
    }));
    setRows(initialRows);

    saveToHistory(validEntries.map((e) => e.asin));

    // Process sequentially to avoid rate limiting
    const updatedRows = [...initialRows];
    for (let i = 0; i < updatedRows.length; i++) {
      if (abortRef.current) break;

      updatedRows[i] = { ...updatedRows[i], status: 'loading' };
      setRows([...updatedRows]);

      try {
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asin: updatedRows[i].asin, pincode: updatedRows[i].pincode }),
        });

        const json = await res.json();

        if (!res.ok) {
          updatedRows[i] = {
            ...updatedRows[i],
            status: 'error',
            error: json?.error ?? `HTTP ${res.status}`,
          };
        } else {
          updatedRows[i] = {
            ...updatedRows[i],
            status: 'done',
            result: json as ScrapeResult,
          };
        }
      } catch (err) {
        updatedRows[i] = {
          ...updatedRows[i],
          status: 'error',
          error: err instanceof Error ? err.message : 'Network error',
        };
      }

      setRows([...updatedRows]);
    }

    setIsRunning(false);
    const doneCount = updatedRows.filter((r) => r.status === 'done').length;
    const errCount = updatedRows.filter((r) => r.status === 'error').length;
    if (doneCount > 0) toast.success(`${doneCount} product${doneCount > 1 ? 's' : ''} scraped successfully${errCount > 0 ? `, ${errCount} failed` : ''}`);
    else if (errCount > 0) toast.error(`All ${errCount} scrape${errCount > 1 ? 's' : ''} failed`);
  }, [asinEntries, pincode, saveToHistory]);

  const doneRows = rows.filter((r) => r.status === 'done' && r.result);
  const lowestPrice = doneRows.length > 1
    ? Math.min(...doneRows.map((r) => r.result!.data.priceRaw ?? Infinity))
    : null;

  const hasResults = rows.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Input Section */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Product Lookup</h2>
          <span className="text-xs text-slate-500">Paste ASIN or Amazon URL</span>
        </div>

        {/* ASIN Entries */}
        <div className="space-y-2">
          {asinEntries.map((entry, idx) => (
            <div key={entry.id} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={entry.value}
                  onChange={(e) => updateAsinEntry(entry.id, e.target.value)}
                  placeholder={idx === 0 ? 'e.g. B0CHX1W1XY or https://www.amazon.in/dp/B0CHX1W1XY' : 'ASIN or Amazon URL'}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all"
                  disabled={isRunning}
                />
              </div>
              {asinEntries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAsinEntry(entry.id)}
                  disabled={isRunning}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all border border-slate-700/40"
                  title="Remove"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add More + Pincode row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={addAsinEntry}
            disabled={isRunning || asinEntries.length >= 10}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-700/50 hover:border-slate-600/60 bg-slate-800/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add more ASIN
          </button>

          <div className="flex items-center gap-2 flex-1 sm:max-w-[200px]">
            <div className="relative flex-1">
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Pincode (optional)"
                maxLength={6}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all"
                disabled={isRunning}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            {hasResults && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isRunning}
                className="px-3 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-700/50 hover:border-slate-600/60 bg-slate-800/40 transition-all disabled:opacity-40"
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              onClick={handleFetch}
              disabled={isRunning}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] ${
                isRunning
                  ? 'bg-slate-700/60 text-slate-500 cursor-not-allowed border border-slate-700/40' :'bg-orange-500 hover:bg-orange-400 text-white border border-orange-400/30 shadow-lg shadow-orange-500/20'
              }`}
            >
              {isRunning ? (
                <>
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Fetching…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  Fetch Data
                </>
              )}
            </button>
          </div>
        </div>

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-600 mr-1">Recent:</span>
            {recentSearches.map((asin) => (
              <button
                key={`recent-${asin}`}
                type="button"
                onClick={() => {
                  if (asinEntries.length === 1 && !asinEntries[0].value) {
                    updateAsinEntry(asinEntries[0].id, asin);
                  } else {
                    setAsinEntries((prev) => [...prev, { id: uid(), value: asin }]);
                  }
                }}
                disabled={isRunning}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800/40 text-slate-500 border border-slate-700/40 hover:text-slate-300 hover:border-slate-600/60 transition-all"
              >
                {asin}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results Table */}
      {hasResults && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/60">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-200">Results</h2>
              <span className="text-xs text-slate-500 font-mono">{rows.length} product{rows.length !== 1 ? 's' : ''}</span>
            </div>
            {doneRows.length > 0 && (
              <button
                type="button"
                onClick={() => downloadCSV(rows)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white border border-slate-700/50 hover:border-slate-600 bg-slate-800/40 hover:bg-slate-800/80 transition-all"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download CSV
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/60">
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider w-8"></th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Product</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Price</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Rating</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Reviews</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Delivery Date</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Shipping</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Availability</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider">Seller</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ResultRow
                    key={row.id}
                    row={row}
                    isExpanded={expandedRows.has(row.id)}
                    onToggle={() => toggleRow(row.id)}
                    isLowestPrice={
                      lowestPrice !== null &&
                      row.result?.data.priceRaw === lowestPrice &&
                      lowestPrice !== Infinity
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasResults && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-4">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <p className="text-slate-400 font-medium text-sm">No results yet</p>
          <p className="text-slate-600 text-xs mt-1 max-w-xs">
            Enter an ASIN or Amazon URL above and click{' '}
            <span className="text-orange-400">Fetch Data</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Result Row ────────────────────────────────────────────────────────────────

function ResultRow({
  row,
  isExpanded,
  onToggle,
  isLowestPrice,
}: {
  row: RowResult;
  isExpanded: boolean;
  onToggle: () => void;
  isLowestPrice: boolean;
}) {
  const d = row.result?.data;
  const fast = isFastDelivery(d?.deliveryEstimate ?? null);
  const isOos = d?.availabilityStatus === 'out_of_stock';

  const rowBg = isOos
    ? 'bg-red-500/5 hover:bg-red-500/8'
    : isLowestPrice
    ? 'bg-emerald-500/5 hover:bg-emerald-500/8' :'hover:bg-slate-800/30';

  const shippingType = d?.primeAvailable
    ? 'prime' : d?.deliveryEstimate?.toLowerCase().includes('free')
    ? 'free' :'paid';

  return (
    <>
      <tr
        className={`border-b border-slate-800/40 cursor-pointer transition-colors ${rowBg}`}
        onClick={row.status === 'done' ? onToggle : undefined}
      >
        {/* Expand toggle */}
        <td className="px-4 py-3 w-8">
          {row.status === 'done' && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            >
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          )}
          {row.status === 'loading' && (
            <svg className="animate-spin w-3.5 h-3.5 text-orange-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
          {row.status === 'error' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          )}
          {row.status === 'pending' && (
            <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />
          )}
        </td>

        {/* Product */}
        <td className="px-4 py-3 max-w-[220px]">
          {row.status === 'loading' || row.status === 'pending' ? (
            <div className="space-y-1.5">
              <div className="h-3.5 w-32 rounded bg-slate-800 shimmer" />
              <div className="h-2.5 w-20 rounded bg-slate-800/60 shimmer" />
            </div>
          ) : row.status === 'error' ? (
            <div>
              <p className="text-xs font-mono text-slate-300">{row.asin}</p>
              <p className="text-xs text-red-400 mt-0.5 truncate max-w-[200px]">{row.error}</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-200 line-clamp-2 leading-snug">
                {d?.title ?? row.asin}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono text-slate-500">{row.asin}</span>
                {isLowestPrice && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium">
                    Lowest
                  </span>
                )}
              </div>
            </div>
          )}
        </td>

        {/* Price */}
        <td className="px-4 py-3 whitespace-nowrap">
          {row.status === 'loading' || row.status === 'pending' ? (
            <div className="h-4 w-16 rounded bg-slate-800 shimmer" />
          ) : row.status === 'done' ? (
            <span className={`text-sm font-semibold tabular-nums ${isLowestPrice ? 'text-emerald-400' : 'text-slate-100'}`}>
              {d?.price ?? <span className="text-slate-600 text-xs font-normal">N/A</span>}
            </span>
          ) : <span className="text-slate-600 text-xs">—</span>}
        </td>

        {/* Rating */}
        <td className="px-4 py-3 whitespace-nowrap">
          {row.status === 'done' && d?.rating ? (
            <div className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span className="text-xs text-amber-400 font-medium tabular-nums">{d.rating}</span>
            </div>
          ) : row.status === 'loading' || row.status === 'pending' ? (
            <div className="h-3.5 w-10 rounded bg-slate-800 shimmer" />
          ) : <span className="text-slate-600 text-xs">—</span>}
        </td>

        {/* Reviews */}
        <td className="px-4 py-3 whitespace-nowrap">
          {row.status === 'done' ? (
            <span className="text-xs text-slate-400 tabular-nums">{d?.reviewCount ?? '—'}</span>
          ) : row.status === 'loading' || row.status === 'pending' ? (
            <div className="h-3.5 w-12 rounded bg-slate-800 shimmer" />
          ) : <span className="text-slate-600 text-xs">—</span>}
        </td>

        {/* Delivery Date */}
        <td className="px-4 py-3 max-w-[140px]">
          {row.status === 'done' ? (
            <div className="flex items-start gap-1.5">
              {fast && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400 flex-shrink-0 mt-0.5">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              )}
              <span className={`text-xs leading-snug ${fast ? 'text-blue-400 font-medium' : 'text-slate-400'}`}>
                {d?.deliveryDate ?? d?.deliveryEstimate ?? '—'}
              </span>
            </div>
          ) : row.status === 'loading' || row.status === 'pending' ? (
            <div className="h-3.5 w-24 rounded bg-slate-800 shimmer" />
          ) : <span className="text-slate-600 text-xs">—</span>}
        </td>

        {/* Shipping */}
        <td className="px-4 py-3 whitespace-nowrap">
          {row.status === 'done' ? (
            <ShippingBadge type={shippingType} />
          ) : row.status === 'loading' || row.status === 'pending' ? (
            <div className="h-5 w-14 rounded-full bg-slate-800 shimmer" />
          ) : <span className="text-slate-600 text-xs">—</span>}
        </td>

        {/* Availability */}
        <td className="px-4 py-3 whitespace-nowrap">
          {row.status === 'done' ? (
            <AvailabilityBadge status={d?.availabilityStatus ?? 'unknown'} />
          ) : row.status === 'loading' || row.status === 'pending' ? (
            <div className="h-5 w-16 rounded-full bg-slate-800 shimmer" />
          ) : <span className="text-slate-600 text-xs">—</span>}
        </td>

        {/* Seller */}
        <td className="px-4 py-3 max-w-[140px]">
          {row.status === 'done' ? (
            <span className="text-xs text-slate-400 truncate block">{d?.seller ?? '—'}</span>
          ) : row.status === 'loading' || row.status === 'pending' ? (
            <div className="h-3.5 w-20 rounded bg-slate-800 shimmer" />
          ) : <span className="text-slate-600 text-xs">—</span>}
        </td>
      </tr>

      {/* Expanded row */}
      {isExpanded && row.status === 'done' && row.result && (
        <tr className="border-b border-slate-800/40">
          <td colSpan={9} className="px-6 py-4 bg-slate-950/40">
            <ExpandedDetails result={row.result} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Shipping Badge ────────────────────────────────────────────────────────────

function ShippingBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; color: string }> = {
    prime: { label: 'Prime', color: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
    free: { label: 'Free', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
    paid: { label: 'Paid', color: 'text-slate-400 bg-slate-700/30 border-slate-600/30' },
  };
  const c = config[type] ?? config.paid;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${c.color}`}>
      {c.label}
    </span>
  );
}

// ── Availability Badge ────────────────────────────────────────────────────────

function AvailabilityBadge({ status }: { status: string }) {
  const config = {
    in_stock: { label: 'In Stock', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
    limited: { label: 'Limited', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
    out_of_stock: { label: 'Out of Stock', color: 'text-red-400 bg-red-500/10 border-red-500/25' },
    unknown: { label: 'Unknown', color: 'text-slate-400 bg-slate-700/30 border-slate-600/30' },
  }[status] ?? { label: 'Unknown', color: 'text-slate-400 bg-slate-700/30 border-slate-600/30' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${config.color}`}>
      {config.label}
    </span>
  );
}

// ── Expanded Details ──────────────────────────────────────────────────────────

function ExpandedDetails({ result }: { result: ScrapeResult }) {
  const d = result.data;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Bullet Points */}
      {d.bulletPoints && d.bulletPoints.length > 0 && (
        <div className="sm:col-span-2 lg:col-span-2">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">Key Features</p>
          <ul className="space-y-1.5">
            {d.bulletPoints.slice(0, 5).map((bp, i) => (
              <li key={`bp-${i}`} className="flex items-start gap-2 text-xs text-slate-300 leading-snug">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60 flex-shrink-0 mt-1.5" />
                {bp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Meta info */}
      <div className="space-y-3">
        {d.brand && (
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Brand</p>
            <p className="text-xs text-slate-300">{d.brand}</p>
          </div>
        )}
        {d.primeAvailable !== undefined && (
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Prime</p>
            <div className="flex items-center gap-1.5">
              {d.primeAvailable ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-blue-400">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                  <span className="text-xs text-blue-400 font-medium">Prime eligible</span>
                </>
              ) : (
                <span className="text-xs text-slate-500">Not Prime</span>
              )}
            </div>
          </div>
        )}
        {d.discountPercent && (
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Discount</p>
            <p className="text-xs text-emerald-400 font-medium">{d.discountPercent} off</p>
          </div>
        )}
        {d.category && (
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Category</p>
            <p className="text-xs text-slate-300">{d.category}</p>
          </div>
        )}
        <div>
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Scraped</p>
          <p className="text-xs text-slate-500 font-mono">
            {new Date(result.scrapedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            {' · '}{(result.duration / 1000).toFixed(1)}s
            {result.retried && ' · retried'}
          </p>
        </div>
      </div>
    </div>
  );
}

const HistoryEntry: React.FC = () => {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.warn('Placeholder: HistoryEntry is not implemented yet.');
  }, []);
  return (
    <div>
      {/* HistoryEntry placeholder */}
    </div>
  );
};

export { HistoryEntry };
const ScrapeStatus: React.FC = () => {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.warn('Placeholder: ScrapeStatus is not implemented yet.');
  }, []);
  return (
    <div>
      {/* ScrapeStatus placeholder */}
    </div>
  );
};

export { ScrapeStatus };