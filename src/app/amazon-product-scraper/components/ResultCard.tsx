'use client';

import React from 'react';
import type { ScrapeResult } from './ScraperPanel';
import { ExternalLink, RotateCcw, MessageSquare, Truck, Package, Tag, Store } from 'lucide-react';

interface ResultCardProps {
  result: ScrapeResult;
}

const AVAILABILITY_CONFIG = {
  in_stock: {
    label: 'In Stock',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-400',
  },
  limited: {
    label: 'Limited Stock',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    dot: 'bg-amber-400',
  },
  out_of_stock: {
    label: 'Out of Stock',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/25',
    dot: 'bg-red-400',
  },
  unknown: {
    label: 'Unknown',
    color: 'text-slate-400',
    bg: 'bg-slate-700/30',
    border: 'border-slate-600/30',
    dot: 'bg-slate-500',
  },
};

function StarRating({ rating }: { rating: string }) {
  const val = parseFloat(rating);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={`star-${i}`}
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill={i <= Math.round(val) ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          className={i <= Math.round(val) ? 'text-amber-400' : 'text-slate-600'}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      <span className="text-sm font-semibold text-amber-400 ml-1 tabular-nums">{rating}</span>
    </div>
  );
}

export default function ResultCard({ result }: ResultCardProps) {
  const avCfg = AVAILABILITY_CONFIG[result.data.availabilityStatus];
  const scrapedTime = new Date(result.scrapedAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const primeLabel = result.data.primeAvailable ? 'Yes' : 'No';

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 overflow-hidden fade-in">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800/60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-200 leading-snug line-clamp-2">
              {result.data.title ?? `Amazon Product — ${result.asin}`}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-mono text-orange-400/70 hover:text-orange-400 transition-colors"
              >
                amazon.in/dp/{result.asin}
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${avCfg.bg} ${avCfg.border} ${avCfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${avCfg.dot}`} />
            {avCfg.label}
          </div>
        </div>
      </div>

      {/* Price hero */}
      <div className="px-5 py-5 border-b border-slate-800/60 bg-gradient-to-r from-orange-500/5 to-transparent">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">
              Current Price
            </p>
            <p className="text-4xl font-bold text-slate-100 tabular-nums tracking-tight">
              {result.data.price ?? (
                <span className="text-slate-600 text-2xl">Not available</span>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
              {result.data.brand && (
                <span className="rounded-full border border-slate-700/70 px-2 py-1 bg-slate-950/70">
                  Brand: {result.data.brand}
                </span>
              )}
              {result.data.category && (
                <span className="rounded-full border border-slate-700/70 px-2 py-1 bg-slate-950/70">
                  Category: {result.data.category}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            {result.data.rating && (
              <StarRating rating={result.data.rating} />
            )}
            {result.data.reviewCount && (
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 justify-end">
                <MessageSquare size={11} />
                {result.data.reviewCount} reviews
              </p>
            )}
            <div className="mt-3 text-right text-xs text-slate-400 space-y-1">
              {result.data.listPrice && (
                <p>List Price: {result.data.listPrice}</p>
              )}
              {result.data.discountPercent && (
                <p>Discount: {result.data.discountPercent}</p>
              )}
              <p>Prime: {primeLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Data grid */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Delivery estimate */}
        <DataField
          icon={<Truck size={13} className="text-blue-400" />}
          label="Delivery Estimate"
          value={result.data.deliveryEstimate}
          mono={false}
          highlight="blue"
        />

        {/* Availability raw */}
        <DataField
          icon={<Package size={13} className="text-slate-400" />}
          label="Availability Text"
          value={result.data.availability}
          mono={false}
          highlight="neutral"
        />

        {/* Seller */}
        <DataField
          icon={<Store size={13} className="text-slate-400" />}
          label="Sold By"
          value={result.data.seller}
          mono={false}
          highlight="neutral"
        />

        {/* Prime */}
        <DataField
          icon={<Truck size={13} className="text-blue-400" />}
          label="Prime"
          value={primeLabel}
          mono={false}
          highlight="blue"
        />

        {/* Images */}
        <DataField
          icon={<ExternalLink size={13} className="text-slate-400" />}
          label="Images"
          value={result.data.imageCount ? `${result.data.imageCount} found` : 'None'}
          mono={false}
          highlight="neutral"
        />

        {/* A+ Content */}
        <DataField
          icon={<Store size={13} className="text-slate-400" />}
          label="A+ Content"
          value={result.data.aPlusContent ? 'Yes' : 'No'}
          mono={false}
          highlight="neutral"
        />

        {/* ASIN */}
        <DataField
          icon={<Tag size={13} className="text-orange-400" />}
          label="ASIN"
          value={result.asin}
          mono
          highlight="orange"
        />
      </div>

      {/* Footer metadata */}
      <div className="px-5 py-3 border-t border-slate-800/60 flex items-center justify-between bg-slate-900/40">
        <div className="flex items-center gap-3 text-xs text-slate-600 font-mono">
          <span>Scraped at {scrapedTime}</span>
          <span className="text-slate-800">·</span>
          <span>{(result.duration / 1000).toFixed(2)}s</span>
          {result.retried && (
            <>
              <span className="text-slate-800">·</span>
              <span className="flex items-center gap-1 text-amber-500/70">
                <RotateCcw size={10} />
                retried
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-slate-600 font-mono">Playwright</span>
        </div>
      </div>
    </div>
  );
}

function DataField({
  icon,
  label,
  value,
  mono,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  mono: boolean;
  highlight: 'blue' | 'orange' | 'neutral';
}) {
  const valueColor =
    highlight === 'blue' ?'text-blue-300'
      : highlight === 'orange' ?'text-orange-300' :'text-slate-300';

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p
        className={`text-sm leading-snug ${mono ? 'font-mono' : ''} ${
          value ? valueColor : 'text-slate-600 italic'
        }`}
      >
        {value ?? 'Not extracted'}
      </p>
    </div>
  );
}
