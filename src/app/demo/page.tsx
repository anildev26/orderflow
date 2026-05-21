'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTheme } from '@/context/ThemeContext';
import ThemeToggle from '@/components/ThemeToggle';
import { useDemoOrderStore, DemoOrder } from '@/store/useDemoOrderStore';
import { STATUS_LABELS, STATUS_COLORS } from '@/types/order';

const DemoWalkthrough = dynamic(() => import('@/components/DemoWalkthrough'), { ssr: false });
const DemoModeBanner = dynamic(() => import('@/components/DemoModeBanner'), { ssr: false });
const DemoOrderModal = dynamic(() => import('@/components/DemoOrderModal'), { ssr: false });

/* ─── helpers ─── */
function fmtDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}-${m}-${y}`;
}
function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

const PLATFORM_BADGE: Record<string, string> = {
  amazon: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  flipkart: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  meesho: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  myntra: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  jio: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  blinkit: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  ajio: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  shopsy: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  nykaa: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  other: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const BORDER_COLOR: Record<string, string> = {
  ordered: 'border-l-blue-500',
  delivered: 'border-l-cyan-500',
  review_rating_submitted: 'border-l-purple-500',
  refund_form_pending: 'border-l-red-500',
  refund_form_filled: 'border-l-green-500',
  informed_mediator: 'border-l-teal-500',
  payment_received: 'border-l-emerald-600',
  order_cancelled: 'border-l-gray-500',
};

/* ─── Disabled action tooltip wrapper ─── */
function DisabledAction({ children, label }: { children: React.ReactNode; label: string }) {
  const [tip, setTip] = useState(false);
  return (
    <div className="relative flex-1" onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
      <div className="pointer-events-none opacity-50">{children}</div>
      {tip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 text-center text-[10px] bg-dashboard-bg border border-dashboard-border rounded-lg px-2 py-1.5 text-text-secondary shadow-lg z-10">
          {label}
        </div>
      )}
    </div>
  );
}

/* ─── Demo Order Card ─── */
function DemoOrderCard({ order, onUpdateClick }: { order: DemoOrder; onUpdateClick?: () => void }) {
  const [showMessage, setShowMessage] = useState(false);
  const border = BORDER_COLOR[order.status] || 'border-l-blue-500';
  const badge = PLATFORM_BADGE[order.platform] || PLATFORM_BADGE.other;
  const days = daysAgo(order.orderDate);
  const statusLabel = STATUS_LABELS[order.status as keyof typeof STATUS_LABELS] || order.status;
  const statusColor = STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || 'bg-gray-500';

  return (
    <div
      data-tour={order === undefined ? undefined : 'order-card-status'}
      className={`rounded-xl overflow-hidden bg-dashboard-card border border-dashboard-border ${border} border-l-4`}
    >
      <div className="p-4">
        {/* Row 1 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize flex-shrink-0 ${badge}`}>
              {order.platform}
            </span>
            <span className="text-sm font-bold font-mono text-text-primary truncate">{order.orderId}</span>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-md text-white flex-shrink-0 ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {/* Row 2 */}
        <div className="mt-2 flex flex-col gap-1">
          <p className="text-sm font-medium text-text-primary truncate">{order.productName}</p>
          <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
            <span className="text-sm font-bold text-green-400">&#8377;{order.totalAmount.toLocaleString('en-IN')}</span>
            {order.sellerLess > 0 && <span>Less: &#8377;{order.sellerLess}</span>}
            <span>{fmtDate(order.orderDate)} ({days}d)</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
            {order.reviewerName && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-medium text-text-primary">{order.reviewerName}</span>
              </span>
            )}
            {order.mediatorName && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {order.mediatorName}
              </span>
            )}
            <span className="capitalize">{order.orderType}</span>
          </div>
        </div>

        {/* Mediator message preview */}
        {order.mediatorMessage && (
          <div
            className="mt-2 px-3 py-2 rounded-lg bg-dashboard-bg border border-dashboard-border"
          >
            <p className="text-[10px] text-text-muted mb-0.5">Mediator message</p>
            <p className="text-xs text-text-secondary line-clamp-2">{order.mediatorMessage}</p>
            {order.mediatorMessage.length > 80 && (
              <button
                onClick={() => setShowMessage(true)}
                className="text-[10px] text-accent-blue mt-0.5 hover:underline"
              >
                Read full message
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action buttons — disabled in demo */}
      <div
        data-tour="order-card-edit"
        className="px-4 pb-3 flex items-center gap-2"
      >
        {order.refundFormLink && (
          <a
            href={order.refundFormLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 text-center text-xs font-medium rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition inline-flex items-center justify-center gap-1.5"
          >
            Refund Form
          </a>
        )}
        {onUpdateClick ? (
          <button
            onClick={onUpdateClick}
            className="flex-1 py-2 text-center text-xs font-medium rounded-lg bg-accent-blue/10 border border-accent-blue/30 text-blue-400 hover:bg-accent-blue/20 transition"
          >
            Update Status
          </button>
        ) : (
          <DisabledAction label="Sign up to update order status">
            <button className="w-full py-2 text-center text-xs font-medium rounded-lg bg-accent-blue/10 border border-accent-blue/30 text-blue-400">
              Update Status
            </button>
          </DisabledAction>
        )}
        <DisabledAction label="Sign up to edit orders">
          <button className="p-2 rounded-lg border border-dashboard-border bg-dashboard-bg text-text-muted">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </DisabledAction>
        <DisabledAction label="Sign up to delete orders">
          <button className="p-2 rounded-lg border border-dashboard-border bg-dashboard-bg text-text-muted">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </DisabledAction>
      </div>

      {/* Message modal */}
      {showMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowMessage(false)}>
          <div className="bg-dashboard-card border border-dashboard-border rounded-xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-3">
              <p className="text-sm font-semibold">Mediator Message</p>
              <button onClick={() => setShowMessage(false)} className="text-text-muted hover:text-text-primary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{order.mediatorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sidebar nav items ─── */
function DemoSidebarItem({ icon, label, tourId, active = false }: { icon: React.ReactNode; label: string; tourId?: string; active?: boolean }) {
  return (
    <li data-tour={tourId}>
      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-default select-none ${active ? 'bg-sidebar-active text-white' : 'text-text-secondary'}`}>
        {icon}
        {label}
      </div>
    </li>
  );
}

/* ─── Main Demo Page ─── */
export default function DemoPage() {
  const { fetchVisible, orders, loading } = useDemoOrderStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [demoModal, setDemoModal] = useState<{ open: boolean; tourMode: boolean }>({ open: false, tourMode: false });

  useEffect(() => {
    setMounted(true);
    fetchVisible();
  }, [fetchVisible]);

  // Expose sidebar + modal controls so DemoWalkthrough can drive them during the tour
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__orderflow_open_sidebar__ = (open: boolean) => setMobileOpen(open);
    w.__orderflow_show_demo_modal__ = (open: boolean, tourMode = true) =>
      setDemoModal({ open, tourMode: open ? tourMode : false });
    return () => {
      delete w.__orderflow_open_sidebar__;
      delete w.__orderflow_show_demo_modal__;
    };
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        o.orderId.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q) ||
        o.mediatorName.toLowerCase().includes(q) ||
        o.brandName.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchesPlatform = platformFilter === 'all' || o.platform === platformFilter;
      return matchesSearch && matchesStatus && matchesPlatform;
    });
  }, [orders, searchQuery, statusFilter, platformFilter]);

  const stats = useMemo(() => {
    const total = orders.length;
    const refundPending = orders.filter((o) => o.status === 'refund_form_pending').length;
    const paymentReceived = orders.filter((o) => o.status === 'payment_received').length;
    const totalAmount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return { total, refundPending, paymentReceived, totalAmount };
  }, [orders]);

  const platforms = useMemo(() => {
    const s = new Set(orders.map((o) => o.platform));
    return Array.from(s);
  }, [orders]);

  return (
    <div className="flex min-h-screen bg-dashboard-bg text-text-primary">
      {/* Driver.js tour (auto-starts once) */}
      {mounted && <DemoWalkthrough autoStart />}

      {/* Demo banner */}
      {mounted && <DemoModeBanner />}

      {/* Demo order modal (shown during mediator-message tour step or on card click) */}
      {mounted && demoModal.open && orders.length > 0 && (
        <DemoOrderModal
          order={orders[0]}
          tourMode={demoModal.tourMode}
          onClose={() => setDemoModal({ open: false, tourMode: false })}
        />
      )}

      {/* ── Mobile sidebar overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile sidebar panel ── */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-60 bg-sidebar-bg border-r border-dashboard-border flex flex-col transition-transform duration-300 md:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between h-16 border-b border-dashboard-border px-4">
          <div className="flex items-center gap-2.5">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <defs>
                <linearGradient id="demo-grad-m" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              <rect width="40" height="40" rx="10" fill="url(#demo-grad-m)" />
              <path d="M12 14h16M12 20h10M12 26h13" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="29" cy="26" r="4" fill="white" opacity="0.9" />
            </svg>
            <span className="font-semibold text-sm leading-tight text-text-primary">
              OrderFlow<br />
              <span className="font-normal text-xs text-text-muted">Demo Mode</span>
            </span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg hover:bg-dashboard-card text-text-secondary hover:text-text-primary"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pt-4">
          <ul className="space-y-1">
            <DemoSidebarItem active label="Orders Dashboard" icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            } />
            <DemoSidebarItem tourId="sidebar-m-archive" label="Archive" icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            } />
            <DemoSidebarItem tourId="sidebar-m-analytics" label="My Order Analytics" icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            } />
            <DemoSidebarItem tourId="sidebar-m-features" label="Feature Requests" icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            } />
          </ul>
        </nav>
        <div className="p-3 border-t border-dashboard-border">
          <Link
            href="/signup"
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 transition"
          >
            Create free account →
          </Link>
        </div>
      </aside>

      {/* ── Desktop Sidebar ── */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-60 bg-sidebar-bg border-r border-dashboard-border flex-col hidden md:flex">
        <div className="flex items-center h-16 border-b border-dashboard-border px-4 gap-2.5">
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
            <defs>
              <linearGradient id="demo-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <rect width="40" height="40" rx="10" fill="url(#demo-grad)" />
            <path d="M12 14h16M12 20h10M12 26h13" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="29" cy="26" r="4" fill="white" opacity="0.9" />
          </svg>
          <span className="font-semibold text-sm leading-tight text-text-primary">
            OrderFlow<br />
            <span className="font-normal text-xs text-text-muted">Demo Mode</span>
          </span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pt-4">
          <ul className="space-y-1">
            <DemoSidebarItem active label="Orders Dashboard" icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            } />
            <DemoSidebarItem tourId="sidebar-archive" label="Archive" icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            } />
            <DemoSidebarItem tourId="sidebar-analytics" label="My Order Analytics" icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            } />
            <DemoSidebarItem tourId="sidebar-features" label="Feature Requests" icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            } />
          </ul>
        </nav>
        <div className="p-3 border-t border-dashboard-border">
          <Link
            href="/signup"
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 transition"
          >
            Create free account →
          </Link>
        </div>
      </aside>

      {/* Desktop spacer */}
      <div className="hidden md:block flex-shrink-0 w-60" />

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto pb-24">
        {/* Top bar */}
        <div
          data-tour="welcome"
          className="sticky top-0 z-30 bg-dashboard-bg/80 backdrop-blur-xl border-b border-dashboard-border"
        >
          <div className="flex items-center justify-between px-4 sm:px-6 h-14 gap-3">
            <div className="flex items-center gap-2">
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(true)}
                className="p-1.5 rounded-lg hover:bg-dashboard-card text-text-secondary hover:text-text-primary md:hidden"
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {/* Mobile logo */}
              <svg className="w-7 h-7 md:hidden" width="28" height="28" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="10" fill="url(#demo-grad)" />
                <path d="M12 14h16M12 20h10M12 26h13" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <h1 className="text-base font-bold text-text-primary">Orders Dashboard</h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Demo
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                href="/login"
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent-blue text-white hover:bg-blue-600 transition"
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-6 space-y-6">
          {/* KPI cards */}
          <div data-tour="kpi-cards" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Active Orders', value: stats.total, color: 'text-yellow-400', sub: 'Demo orders shown' },
              { label: 'Refund Pending', value: stats.refundPending, color: 'text-red-400', sub: 'Needs attention' },
              { label: 'Payment Received', value: stats.paymentReceived, color: 'text-emerald-400', sub: 'Completed' },
              { label: 'Total Amount', value: `₹${stats.totalAmount.toLocaleString('en-IN')}`, color: 'text-blue-400', sub: 'Across all orders' },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-dashboard-border bg-dashboard-card p-4">
                <p className="text-[10px] uppercase tracking-wide text-text-muted mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-[10px] text-text-muted mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Search + filter bar + action buttons */}
          <div data-tour="search-filter" className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by order ID, product, mediator…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-dashboard-border bg-dashboard-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-dashboard-border bg-dashboard-card text-text-primary focus:outline-none focus:border-accent-blue/50"
            >
              <option value="all">All Statuses</option>
              <option value="ordered">Ordered</option>
              <option value="delivered">Delivered</option>
              <option value="review_rating_submitted">Review Submitted</option>
              <option value="refund_form_pending">Refund Pending</option>
              <option value="refund_form_filled">Refund Form Filled</option>
              <option value="informed_mediator">Informed Mediator</option>
              <option value="payment_received">Payment Received</option>
              <option value="order_cancelled">Cancelled</option>
            </select>
            {platforms.length > 0 && (
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-dashboard-border bg-dashboard-card text-text-primary focus:outline-none focus:border-accent-blue/50"
              >
                <option value="all">All Platforms</option>
                {platforms.map((p) => (
                  <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            )}
          </div>

          {/* Import + Add order buttons (disabled) */}
          <div className="flex items-center gap-2 flex-wrap">
            <div data-tour="import-orders">
              <DisabledAction label="Sign up to import your previous orders">
                <button className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-dashboard-border bg-dashboard-card text-text-secondary">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import Orders
                </button>
              </DisabledAction>
            </div>
            <div data-tour="export-data">
              <DisabledAction label="Sign up to export your order data">
                <button className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-dashboard-border bg-dashboard-card text-text-secondary">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Data
                </button>
              </DisabledAction>
            </div>
            <div data-tour="telegram-track">
              <DisabledAction label="Sign up to track orders on Telegram">
                <button className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-dashboard-border bg-dashboard-card text-text-secondary">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Track on Telegram
                </button>
              </DisabledAction>
            </div>
            <div data-tour="add-order" className="ml-auto">
              <Link
                href="/signup"
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-accent-blue text-white hover:bg-blue-600 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Order
              </Link>
            </div>
          </div>

          {/* Order list */}
          <div data-tour="order-list">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-accent-blue border-t-transparent animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-text-muted">
                <p className="text-sm">No demo orders match your filters.</p>
                <button
                  onClick={() => { setSearchQuery(''); setStatusFilter('all'); setPlatformFilter('all'); }}
                  className="mt-2 text-xs text-accent-blue hover:underline"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((order, idx) => (
                  <div key={order.id} data-tour={idx === 0 ? 'order-card-status' : undefined}>
                    <DemoOrderCard
                      order={order}
                      onUpdateClick={idx === 0 ? () => setDemoModal({ open: true, tourMode: false }) : undefined}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment + archive callout */}
          <div data-tour="payment-archive" className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-400">Payment Received → Auto Archive</p>
              <p className="text-xs text-text-muted mt-0.5">
                When you mark an order as &quot;Payment Received&quot;, it moves to the Archive section automatically. Your active dashboard stays clean.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-dashboard-border bg-gradient-to-br from-blue-500/5 to-violet-500/5 p-6 text-center">
            <h2 className="text-lg font-bold mb-2">Ready to manage your own orders?</h2>
            <p className="text-sm text-text-muted mb-4">
              Create your free workspace and start tracking real orders in under a minute.
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              <Link
                href="/"
                className="px-4 py-2 rounded-lg border border-dashboard-border text-sm text-text-secondary hover:text-text-primary hover:bg-dashboard-card transition"
              >
                ← Back to overview
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 transition"
              >
                Create your workspace →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
