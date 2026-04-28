import React from 'react';
import AppLogo from '@/components/ui/AppLogo';
import { Activity, BookOpen, Zap } from 'lucide-react';

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export default function Topbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 h-14 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <AppLogo size={28} />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100 text-base tracking-tight">
                AmazonScraper
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                v1.0
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1 ml-6">
            <NavItem href="/amazon-product-scraper" active>
              <Zap size={14} />
              Scraper
            </NavItem>
          </div>
        </div>

        {/* Right: Status + Links */}
        <div className="flex items-center gap-3">
          {/* API Status indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800/60 border border-slate-700/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-slate-400 font-mono">
              Playwright Ready
            </span>
          </div>

          <div className="flex items-center gap-1">
            <a
              href="https://playwright.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all duration-150"
              title="Playwright Docs"
            >
              <BookOpen size={16} />
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all duration-150"
              title="GitHub"
            >
              <GithubIcon size={16} />
            </a>
            <div className="p-2 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all duration-150 cursor-pointer">
              <Activity size={16} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function NavItem({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
        active
          ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' :'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
      }`}
    >
      {children}
    </a>
  );
}