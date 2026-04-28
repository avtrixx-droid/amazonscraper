'use client';

import React from 'react';
import Topbar from '@/components/Topbar';
import ScraperPanel from './components/ScraperPanel';
import { Toaster } from 'sonner';

export default function AmazonProductScraperPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Topbar />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 lg:px-8 xl:px-10 2xl:px-16 py-6">
        <ScraperPanel />
      </main>
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: 'hsl(222 47% 10%)',
            border: '1px solid hsl(217 33% 20%)',
            color: 'hsl(210 40% 96%)',
            fontFamily: 'Geist, sans-serif',
            fontSize: '13px',
          },
        }}
      />
    </div>
  );
}