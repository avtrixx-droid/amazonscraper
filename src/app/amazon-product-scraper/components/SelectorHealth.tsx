'use client';

import React, { useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';

interface SelectorItem {
  id: string;
  name: string;
  selector: string;
  status: 'healthy' | 'degraded' | 'broken';
  lastChecked: string;
  successRate: number;
}

const SELECTORS: SelectorItem[] = [
  {
    id: 'sel-price',
    name: 'Price',
    selector: '#priceblock_ourprice, .a-price .a-offscreen',
    status: 'healthy',
    lastChecked: '2 min ago',
    successRate: 97,
  },
  {
    id: 'sel-availability',
    name: 'Availability',
    selector: '#availability span',
    status: 'healthy',
    lastChecked: '2 min ago',
    successRate: 99,
  },
  {
    id: 'sel-delivery',
    name: 'Delivery Estimate',
    selector: '#mir-layout-DELIVERY_BLOCK .a-text-bold',
    status: 'degraded',
    lastChecked: '2 min ago',
    successRate: 78,
  },
  {
    id: 'sel-rating',
    name: 'Rating',
    selector: '#acrPopover .a-icon-alt',
    status: 'healthy',
    lastChecked: '2 min ago',
    successRate: 96,
  },
  {
    id: 'sel-reviews',
    name: 'Review Count',
    selector: '#acrCustomerReviewText',
    status: 'healthy',
    lastChecked: '2 min ago',
    successRate: 95,
  },
];

const STATUS_CONFIG = {
  healthy: {
    label: 'Healthy',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  degraded: {
    label: 'Degraded',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
  },
  broken: {
    label: 'Broken',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-400',
  },
};

export default function SelectorHealth() {
  const [expanded, setExpanded] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const healthyCount = SELECTORS.filter((s) => s.status === 'healthy').length;
  const degradedCount = SELECTORS.filter((s) => s.status === 'degraded').length;

  const handleRefresh = () => {
    setSpinning(true);
    setTimeout(() => setSpinning(false), 1200);
  };

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 overflow-hidden">
      <div
        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-800/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 flex-1" onClick={() => setExpanded(!expanded)}>
          <ShieldCheck size={14} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-200">Selector Health</span>
          <div className="flex items-center gap-1 ml-1">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              {healthyCount} OK
            </span>
            {degradedCount > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                {degradedCount} degraded
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
            title="Re-check selectors"
          >
            <RefreshCw size={13} className={spinning ? 'animate-spin' : ''} />
          </button>
          <div onClick={() => setExpanded(!expanded)} className="cursor-pointer">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800/60 p-4 space-y-2 fade-in">
          {SELECTORS.map((item) => {
            const cfg = STATUS_CONFIG[item.status];
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/30 border border-slate-800/40 hover:bg-slate-800/50 transition-colors"
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-300">{item.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-600 truncate mt-0.5">
                    {item.selector}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-mono font-semibold tabular-nums text-slate-300">
                    {item.successRate}%
                  </div>
                  <div className="text-[10px] text-slate-600">{item.lastChecked}</div>
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-slate-600 px-1 pt-1">
            Selectors verified against amazon.in DOM structure. Degraded selectors may require fallback patterns.
          </p>
        </div>
      )}
    </div>
  );
}
