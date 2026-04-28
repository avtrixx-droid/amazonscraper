import React from 'react';
import AppLogo from '@/components/ui/AppLogo';
import Link from 'next/link';

export default function Topbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 h-14 flex items-center justify-between">
        {/* Left: Logo + Home link */}
        <Link href="/amazon-product-scraper" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <AppLogo size={28} />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100 text-base tracking-tight">
              AmazonScraper
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
              v1.0
            </span>
          </div>
        </Link>

        {/* Right: Status indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800/60 border border-slate-700/50">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-slate-400 font-mono">
            Playwright Ready
          </span>
        </div>
      </div>
    </header>
  );
}