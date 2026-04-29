'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { ExternalLink, Hash } from 'lucide-react';

interface FormValues {
  asin: string;
}

interface ScrapeFormProps {
  onScrape: (asin: string) => void;
  isRunning: boolean;
}

const EXAMPLE_ASINS = [
  { asin: 'B0CHX1W1XY', label: 'iPhone 15' },
  { asin: 'B0BDJH4GGG', label: 'Galaxy S23 Ultra' },
  { asin: 'B09G9FPHY6', label: 'realme narzo 50A' },
];

export default function ScrapeForm({ onScrape, isRunning }: ScrapeFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { asin: '' },
  });

  const asinValue = watch('asin');

  const onSubmit = (data: FormValues) => {
    onScrape(data.asin.trim().toUpperCase());
  };

  const amazonUrl =
    asinValue.trim().length > 0
      ? `https://www.amazon.in/dp/${asinValue.trim().toUpperCase()}`
      : null;

  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Scrape Configuration</h2>
          <p className="text-xs text-slate-500 mt-0.5">Amazon.in · Playwright Chromium</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-500/80" />
          <span className="text-xs text-slate-500 font-mono">amazon.in</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-5">
        <div className="space-y-1.5">
          <label
            htmlFor="asin"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 tracking-wide uppercase"
          >
            <Hash size={12} className="text-orange-400" />
            ASIN
            <span className="text-red-400 ml-0.5">*</span>
          </label>
          <p className="text-xs text-slate-600">
            10-character Amazon Standard Identification Number
          </p>
          <div className="relative">
            <input
              id="asin"
              type="text"
              placeholder="e.g. B0CHX1W1XY"
              autoComplete="off"
              spellCheck={false}
              className={`w-full bg-slate-800/60 border rounded-lg px-3 py-2.5 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all duration-150 pr-10 ${
                errors.asin
                  ? 'border-red-500/60 focus:ring-red-500/20' :'border-slate-700/60 focus:ring-orange-500/20 focus:border-orange-500/50'
              }`}
              {...register('asin', {
                required: 'ASIN is required',
                pattern: {
                  value: /^[A-Za-z0-9]{10}$/,
                  message: 'ASIN must be exactly 10 alphanumeric characters',
                },
              })}
            />
            {asinValue.length > 0 && (
              <button
                type="button"
                onClick={() => setValue('asin', '')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          {errors.asin && (
            <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {errors.asin.message}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 mt-2">
            {EXAMPLE_ASINS.map((item) => (
              <button
                key={`asin-chip-${item.asin}`}
                type="button"
                onClick={() => setValue('asin', item.asin, { shouldValidate: true })}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all duration-150 border ${
                  asinValue.toUpperCase() === item.asin
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' :'bg-slate-800/40 text-slate-500 border-slate-700/40 hover:text-slate-300 hover:border-slate-600/60'
                }`}
              >
                {item.asin}
                <span className="ml-1 text-slate-600 font-sans">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {amazonUrl && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
            <div className="w-4 h-4 flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-orange-400">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="text-xs font-mono text-slate-400 truncate flex-1">{amazonUrl}</span>
            <a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-slate-600 hover:text-orange-400 transition-colors"
              title="Open in browser"
            >
              <ExternalLink size={13} />
            </a>
          </div>
        )}

        <div className="rounded-lg border border-slate-800/60 bg-slate-950/30 px-3 py-2">
          <p className="text-[11px] text-slate-500">
            Delivery estimate will be based on Amazon&apos;s current default session/location.
          </p>
        </div>

        <button
          type="submit"
          disabled={isRunning}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 active:scale-[0.98] ${
            isRunning
              ? 'bg-slate-700/60 text-slate-500 cursor-not-allowed border border-slate-700/40' :'bg-orange-500 hover:bg-orange-400 text-white border border-orange-400/30 shadow-lg shadow-orange-500/20'
          }`}
        >
          {isRunning ? (
            <>
              <svg
                className="animate-spin w-4 h-4 text-slate-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Scraping in progress…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Run Scraper
            </>
          )}
        </button>
      </form>
    </div>
  );
}
