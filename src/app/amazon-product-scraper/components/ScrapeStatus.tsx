'use client';

import React, { useRef, useEffect } from 'react';
import { ScrapeStatus as StatusType } from './ScraperPanel';

interface ScrapeStatusProps {
  status: StatusType;
  progressLog: string[];
  error: string | null;
}

const STATUS_CONFIG: Record<
  StatusType,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  idle: {
    label: 'Idle',
    color: 'text-slate-400',
    bg: 'bg-slate-700/40',
    border: 'border-slate-600/40',
    dot: 'bg-slate-500',
  },
  queued: {
    label: 'Queued',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
  },
  scraping: {
    label: 'Scraping',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
  },
  retrying: {
    label: 'Retrying (2/2)',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
  complete: {
    label: 'Complete',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    dot: 'bg-red-400',
  },
};

export default function ScrapeStatus({
  status,
  progressLog,
  error,
}: ScrapeStatusProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const cfg = STATUS_CONFIG[status];
  const isRunning = status === 'queued' || status === 'scraping' || status === 'retrying';

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [progressLog]);

  // Progress steps
  const STEPS = ['Queued', 'Browser Launch', 'Navigation', 'Page Ready', 'Data Extract', 'Complete'];
  const stepIndex =
    status === 'idle' ? -1 :
    status === 'queued' ? 0 :
    status === 'scraping' && progressLog.length <= 2 ? 1 :
    status === 'scraping' && progressLog.length <= 3 ? 2 :
    status === 'scraping' && progressLog.length <= 4 ? 3 :
    status === 'retrying' ? 3 :
    status === 'complete' ? 5 :
    status === 'failed' ? -2 : 4;

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800/60 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Scrape Status</h3>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
          <span
            className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${isRunning ? 'animate-pulse' : ''}`}
          />
          {cfg.label}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Step progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => (
              <React.Fragment key={`step-${i}`}>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all duration-300 ${
                      status === 'failed' && i <= Math.max(stepIndex, 0)
                        ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                        : i < stepIndex
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                        : i === stepIndex
                        ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400 ring-2 ring-blue-500/20' :'bg-slate-800/60 border border-slate-700/40 text-slate-600'
                    }`}
                  >
                    {i < stepIndex && status !== 'failed' ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : status === 'failed' && i <= Math.max(stepIndex, 0) ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className="text-[9px] text-slate-600 text-center w-12 leading-tight hidden sm:block">
                    {step}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-px mx-1 mt-[-12px]">
                    <div
                      className={`h-full transition-all duration-500 ${
                        i < stepIndex && status !== 'failed' ?'bg-emerald-500/40' :'bg-slate-700/40'
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Progress log terminal */}
        {progressLog.length > 0 && (
          <div
            ref={logRef}
            className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-3 h-[120px] overflow-y-auto scrollbar-thin space-y-1"
          >
            {progressLog.map((line, i) => (
              <div
                key={`log-${i}`}
                className="flex items-start gap-2 text-xs font-mono"
              >
                <span className="text-slate-600 flex-shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className={`${
                    line.includes('fail') || line.includes('CAPTCHA') || line.includes('error')
                      ? 'text-red-400' : line.includes('Retry') || line.includes('timeout')
                      ? 'text-amber-400' : line.includes('success') || line.includes('Extract') || line.includes('Parsing')
                      ? 'text-emerald-400' :'text-slate-400'
                  }`}
                >
                  {line}
                </span>
                {i === progressLog.length - 1 && isRunning && (
                  <span className="text-blue-400 animate-pulse">▊</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Idle placeholder */}
        {status === 'idle' && progressLog.length === 0 && (
          <div className="bg-slate-950/40 border border-slate-800/40 rounded-lg p-3 h-[80px] flex items-center justify-center">
            <p className="text-xs font-mono text-slate-700">
              — awaiting scrape job —
            </p>
          </div>
        )}

        {/* Error message */}
        {error && status === 'failed' && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/8 border border-red-500/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-xs font-mono text-red-400 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Success summary */}
        {status === 'complete' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <p className="text-xs font-mono text-emerald-400">
              Scrape completed — data extracted successfully
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
