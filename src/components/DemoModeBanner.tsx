'use client';

import Link from 'next/link';
import { useState } from 'react';
import { restartTour } from './DemoWalkthrough';

export default function DemoModeBanner() {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-medium shadow-lg hover:bg-amber-500/20 transition"
      >
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        Demo Mode
      </button>
    );
  }

  return (
    <div
      data-tour="demo-cta"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl"
    >
      <div className="rounded-2xl border border-amber-500/30 bg-dashboard-card/95 backdrop-blur-xl shadow-2xl shadow-black/30 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-400 leading-tight">Demo Mode — Sample data only</p>
            <p className="text-[11px] text-text-muted leading-tight truncate">
              Actions are disabled. Sign up to manage your own real orders.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
          <button
            onClick={restartTour}
            className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-dashboard-border text-xs text-text-secondary hover:text-text-primary hover:bg-dashboard-bg transition"
          >
            Restart tour
          </button>
          <Link
            href="/signup"
            className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 transition text-center"
          >
            Create workspace →
          </Link>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded text-text-muted hover:text-text-primary transition"
            aria-label="Collapse banner"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
