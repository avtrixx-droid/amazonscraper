'use client';

import React, { useState } from 'react';
import { HistoryEntry, ScrapeStatus } from './ScraperPanel';
import { Play, RotateCcw, Clock, TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface ScrapeHistoryProps {
  history: HistoryEntry[];
  onRerun: (asin: string) => void;
  isRunning: boolean;
}

const STATUS_CONFIG: Record<
  ScrapeStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  idle: {
    label: 'Idle',
    color: 'text-slate-400',
    bg: 'bg-slate-700/30',
    border: 'border-slate-600/30',
  },
  queued: {
    label: 'Queued',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
  },
  scraping: {
    label: 'Scraping',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
  },
  retrying: {
    label: 'Retrying',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
  },
  complete: {
    label: 'Complete',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/25',
  },
};

function formatRelativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: HistoryEntry }> }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-mono text-slate-300 font-medium">{entry.asin}</p>
      <p className="text-orange-400 font-semibold mt-1 tabular-nums">
        {(entry.duration / 1000).toFixed(2)}s
      </p>
      {entry.retried && (
        <p className="text-amber-400/70 text-[10px]">retried</p>
      )}
    </div>
  );
}

export default function ScrapeHistory({
  history,
  onRerun,
  isRunning,
}: ScrapeHistoryProps) {
  const [showChart, setShowChart] = useState(false);

  const successCount = history.filter((h) => h.status === 'complete').length;
  const failCount = history.filter((h) => h.status === 'failed').length;
  const avgDuration =
    history.length > 0
      ? history.reduce((s, h) => s + h.duration, 0) / history.length
      : 0;

  const chartData = [...history].reverse().map((h, i) => ({
    ...h,
    index: i + 1,
  }));

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">Scrape History</h3>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800/60 text-slate-500 border border-slate-700/40">
            Last {history.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats row */}
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className="text-emerald-400 font-mono font-semibold tabular-nums">
              {successCount} OK
            </span>
            <span className="text-slate-700">·</span>
            <span className="text-red-400 font-mono font-semibold tabular-nums">
              {failCount} failed
            </span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-400 font-mono tabular-nums">
              {(avgDuration / 1000).toFixed(1)}s avg
            </span>
          </div>
          <button
            onClick={() => setShowChart(!showChart)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all duration-150 border ${
              showChart
                ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :'text-slate-500 hover:text-slate-300 border-slate-700/40 hover:bg-slate-800/40'
            }`}
          >
            <TrendingUp size={12} />
            Chart
          </button>
        </div>
      </div>

      {/* Duration chart */}
      {showChart && (
        <div className="px-5 py-4 border-b border-slate-800/60 fade-in">
          <p className="text-[11px] text-slate-500 mb-3 uppercase tracking-wider font-medium">
            Scrape Duration (ms) — chronological
          </p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={chartData} barSize={18}>
              <XAxis
                dataKey="index"
                tick={{ fontSize: 10, fill: '#475569', fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.05)' }} />
              <Bar dataKey="duration" radius={[3, 3, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={`cell-${entry.id}`}
                    fill={
                      entry.status === 'failed' ?'hsl(0 72% 51% / 0.6)'
                        : entry.retried
                        ? 'hsl(38 92% 50% / 0.7)'
                        : 'hsl(25 95% 53% / 0.7)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2">
            {[
              { color: 'bg-orange-500/70', label: 'Success' },
              { color: 'bg-amber-400/70', label: 'Retried' },
              { color: 'bg-red-500/60', label: 'Failed' },
            ].map((item) => (
              <div key={`legend-${item.label}`} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-sm ${item.color}`} />
                <span className="text-[10px] text-slate-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {history.length === 0 ? (
        <div className="p-8 flex flex-col items-center justify-center text-center">
          <Clock size={28} className="text-slate-700 mb-3" />
          <p className="text-sm text-slate-500 font-medium">No scrape history yet</p>
          <p className="text-xs text-slate-600 mt-1">
            Completed jobs will appear here with duration and results
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/60">
                {['ASIN', 'Status', 'Price', 'Duration', 'Time', ''].map(
                  (col) => (
                    <th
                      key={`th-${col}`}
                      className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => {
                const cfg = STATUS_CONFIG[entry.status];
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-orange-400/80 hover:text-orange-400 cursor-default">
                        {entry.asin}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.bg} ${cfg.border} ${cfg.color}`}
                        >
                          {cfg.label}
                        </span>
                        {entry.retried && (
                          <span title="Retried">
                            <RotateCcw size={11} className="text-amber-500/60" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono tabular-nums text-slate-300">
                        {entry.price ?? (
                          <span className="text-slate-600">—</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono tabular-nums text-slate-400">
                        {(entry.duration / 1000).toFixed(2)}s
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600 whitespace-nowrap">
                        {formatRelativeTime(entry.scrapedAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onRerun(entry.asin)}
                        disabled={isRunning}
                        title={`Re-run scrape for ${entry.asin}`}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 border border-transparent hover:border-slate-700/40 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Play size={10} />
                        Re-run
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-slate-800/60 flex items-center justify-between">
        <p className="text-[11px] text-slate-600">
          Showing last {history.length} of max 50 daily requests
        </p>
        <p className="text-[11px] font-mono text-slate-600">
          {successCount}/{history.length} succeeded
        </p>
      </div>
    </div>
  );
}
