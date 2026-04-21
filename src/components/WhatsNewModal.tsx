'use client';

import { useEffect } from 'react';
import { WHATS_NEW_STORAGE_KEY, LATEST_VERSION } from './whatsNewConstants';

export { WHATS_NEW_STORAGE_KEY, LATEST_VERSION };

interface WhatsNewModalProps {
  open: boolean;
  onClose: () => void;
}

const CHANGELOG = [
  {
    version: 'v1.0.6',
    date: 'Apr 2026',
    items: [
      { type: 'new', text: 'Excel import template — download from profile menu, fill old orders offline, then import in one go' },
      { type: 'new', text: 'Template mirrors the order form: platform, email, product, date, amount, deal type, plus a single Status Date that adapts to the status you pick (Delivered / Review / Refund Form Filled / Informed Mediator / Payment Received)' },
      { type: 'improvement', text: 'Date cells use the real Excel date type — double-click for a calendar in Excel Online / Google Sheets, or type DD/MM/YYYY in Excel desktop' },
      { type: 'improvement', text: 'Mediator and Reviewer are free-text columns so you can use your own names' },
      { type: 'improvement', text: 'Import auto-detects Excel template (.xlsx) vs JSON backup; row-level validation tells you the exact row to fix' },
      { type: 'improvement', text: 'Duplicate Order IDs are skipped — existing orders are never overwritten' },
      { type: 'improvement', text: 'Faster dashboard load — heavy modals (Filters, What\u2019s New, Update/Edit Order) now load on-demand' },
      { type: 'fix', text: 'Mobile sidebar shows the open-in-new-tab icon next to Order Form, matching desktop' },
    ],
  },
  {
    version: 'v1.0.5',
    date: 'Apr 2026',
    items: [
      { type: 'new', text: 'Feature Requests board — submit, like, and dislike ideas' },
      { type: 'new', text: "What's New section with changelog" },
      { type: 'new', text: 'Platform checkbox selection in order form (no more settings redirect)' },
      { type: 'new', text: 'Admin controls on Feature Requests (mark done, dev team comments)' },
    ],
  },
  {
    version: 'v1.0.4',
    date: 'Mar 2026',
    items: [
      { type: 'new', text: 'Telegram bot for order tracking by Order ID (no login needed)' },
      { type: 'security', text: 'Rate limiting on all auth routes (max 5 attempts / 15 min)' },
      { type: 'security', text: 'Disposable email domains blocked at signup' },
    ],
  },
  {
    version: 'v1.0.3',
    date: 'Feb 2026',
    items: [
      { type: 'new', text: 'Meesho, Ajio, Blinkit, Shopsy, Nykaa added as default platforms' },
      { type: 'fix', text: 'Fixed duplicate order bug — cancelling one no longer affects others with same Order ID' },
      { type: 'fix', text: 'Fixed date picker showing wrong "today" date in IST timezone' },
    ],
  },
  {
    version: 'v1.0.2',
    date: 'Jan 2026',
    items: [
      { type: 'new', text: 'Archive page for completed/paid orders' },
      { type: 'new', text: 'Analytics page with order insights and charts' },
      { type: 'new', text: 'Excel/CSV and JSON export' },
    ],
  },
  {
    version: 'v1.0.1',
    date: 'Dec 2025',
    items: [
      { type: 'new', text: 'Copy order details for WhatsApp sharing' },
      { type: 'new', text: 'Import/export JSON backup' },
      { type: 'improvement', text: 'Collapsible sidebar with icon-only mode on desktop' },
    ],
  },
];

const TYPE_STYLES: Record<string, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  fix: { label: 'Fix', cls: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  improvement: { label: 'Improved', cls: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
  security: { label: 'Security', cls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
};

export default function WhatsNewModal({ open, onClose }: WhatsNewModalProps) {
  useEffect(() => {
    if (open) {
      localStorage.setItem(WHATS_NEW_STORAGE_KEY, LATEST_VERSION);
    }
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-dashboard-card border border-dashboard-border rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dashboard-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-blue/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">What&apos;s New</h2>
              <p className="text-xs text-text-muted">Latest updates in OrderFlow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-dashboard-bg text-text-muted hover:text-text-primary transition"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
          {CHANGELOG.map((release, i) => (
            <div key={release.version}>
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${i === 0 ? 'bg-accent-blue text-white' : 'bg-dashboard-bg text-text-secondary border border-dashboard-border'}`}>
                  {release.version}
                </span>
                <span className="text-xs text-text-muted">{release.date}</span>
                {i === 0 && (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                    Latest
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {release.items.map((item, j) => {
                  const style = TYPE_STYLES[item.type] ?? TYPE_STYLES.improvement;
                  return (
                    <li key={j} className="flex items-start gap-3">
                      <span className={`mt-0.5 flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${style.cls}`}>
                        {style.label}
                      </span>
                      <span className="text-sm text-text-secondary leading-snug">{item.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-dashboard-border bg-dashboard-bg/50">
          <p className="text-xs text-text-muted text-center">OrderFlow — built for e-commerce order management</p>
        </div>
      </div>
    </div>
  );
}
