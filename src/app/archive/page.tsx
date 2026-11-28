'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase';
import { useOrderStore } from '@/store/useOrderStore';
import { STATUS_LABELS, type Order } from '@/types/order';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { todayStr } from '@/lib/followup';
import {
  DEFAULT_FILTERS,
  PAGE_SIZE,
  activeFilterCount,
  bankOptions,
  isArchived,
  isPaid,
  matchesArchiveFilters,
  matchesArchiveSearch,
  matchesStatus,
  nameOptions,
  platformOptions,
  previousStatusOf,
  sortArchived,
  totalsOf,
  type ArchiveFilters,
  type ArchiveStatusFilter,
} from '@/lib/archive';
import { errorMessage, toastWithUndo } from '@/app/follow-ups/_components/ui';
import { ArchiveSkeleton } from '@/components/loading/Skeleton';
import { DotsBlock, DotsOverlay } from '@/components/loading/LoadingDots';
import ArchiveCard from './_components/ArchiveCard';
import { chipOff, chipOn, platformTitle, rupees } from './_components/shared';

// The Monthly tab and the sheets load on first use (and are preloaded once the page is idle).
const loadMonthly = () => import('./_components/MonthlyView');
const loadOrderSheet = () => import('./_components/OrderSheet');
const loadFiltersSheet = () => import('./_components/FiltersSheet');
const MonthlyView = dynamic(loadMonthly, { ssr: false, loading: () => <DotsBlock label="Loading months" /> });
const OrderSheet = dynamic(loadOrderSheet, { ssr: false, loading: DotsOverlay });
const FiltersSheet = dynamic(loadFiltersSheet, { ssr: false, loading: DotsOverlay });

type Tab = 'orders' | 'monthly';
const TAB_KEY = 'of-archive-tab';

const RANGE_LABEL: Record<string, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_3_months: 'Last 3 months',
  this_year: 'This year',
};
const SORT_LABEL: Record<string, string> = {
  newest: 'newest first',
  oldest: 'oldest first',
  highest: 'highest refund first',
  slowest: 'took longest first',
};

function readTab(): Tab {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(TAB_KEY) === 'monthly' ? 'monthly' : 'orders';
  } catch {
    return 'orders';
  }
}

export default function ArchivePage() {
  const router = useRouter();
  const orders = useOrderStore((s) => s.orders);
  const initialized = useOrderStore((s) => s.initialized);
  const loadError = useOrderStore((s) => s.loadError);
  const fetchOrders = useOrderStore((s) => s.fetchOrders);
  const exportData = useOrderStore((s) => s.exportData);
  const importData = useOrderStore((s) => s.importData);
  const reopenOrder = useOrderStore((s) => s.reopenOrder);
  const restoreFollowUp = useOrderStore((s) => s.restoreFollowUp);
  const editPaymentDetails = useOrderStore((s) => s.editPaymentDetails);
  const { user: authUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [tab, setTabState] = useState<Tab>(readTab);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ArchiveFilters>(DEFAULT_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const query = useDeferredValue(search);
  const today = todayStr();

  useEffect(() => {
    setMounted(true);
    if (!initialized) void fetchOrders();
    const idle = window.setTimeout(() => {
      void loadMonthly();
      void loadOrderSheet();
      void loadFiltersSheet();
    }, 0);
    return () => window.clearTimeout(idle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTab = (t: Tab) => {
    setTabState(t);
    try {
      window.sessionStorage.setItem(TAB_KEY, t);
    } catch {
      // the tab is just not remembered
    }
  };

  // ── Data: everything below works on orders already in memory, so typing and filtering never wait. ──
  const archived = useMemo(() => orders.filter(isArchived), [orders]);
  const searched = useMemo(() => archived.filter((o) => matchesArchiveSearch(o, query)), [archived, query]);
  const filtered = useMemo(() => searched.filter((o) => matchesArchiveFilters(o, filters, today)), [searched, filters, today]);
  const totals = useMemo(() => totalsOf(filtered), [filtered]);
  const list = useMemo(() => sortArchived(filtered.filter((o) => matchesStatus(o, filters.status)), filters.sort), [filtered, filters.status, filters.sort]);

  const platforms = useMemo(() => platformOptions(archived), [archived]);
  const mediators = useMemo(() => nameOptions(archived, 'mediator'), [archived]);
  const reviewers = useMemo(() => nameOptions(archived, 'reviewer'), [archived]);
  const banks = useMemo(() => bankOptions(archived), [archived]);
  const bankNames = useMemo(() => banks.filter((b) => b.key !== '__none__').map((b) => b.name), [banks]);

  const filterCount = activeFilterCount(filters);
  const narrowed = !!query.trim() || filterCount > 0;

  // Show 30 at a time; start again from the top whenever the search or filters change.
  const listKey = `${query}|${JSON.stringify(filters)}`;
  const [page, setPage] = useState({ key: listKey, n: PAGE_SIZE });
  const shown = page.key === listKey ? page.n : PAGE_SIZE;
  const visible = list.slice(0, shown);
  const hasMore = list.length > shown;
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || tab !== 'orders') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setPage({ key: listKey, n: shown + PAGE_SIZE });
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, listKey, shown, tab, mounted, initialized]);

  const countFor = useCallback(
    (f: ArchiveFilters) =>
      searched.filter((o) => matchesArchiveFilters(o, f, today) && (tab === 'monthly' ? isPaid(o) : matchesStatus(o, f.status))).length,
    [searched, today, tab],
  );

  const clearAll = () => {
    setSearch('');
    setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort }));
  };

  const openOrder = useCallback((o: Order) => setOpenId(o.id), []);
  const openOrderObj = openId ? archived.find((o) => o.id === openId) : undefined;

  // ── Actions ──
  const savePayment = async (o: Order, date: string, bank: string) => {
    try {
      await editPaymentDetails(o.id, date, bank);
      toast.success('Paid date and bank saved');
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save'));
      return false;
    }
  };

  const reopen = async (o: Order) => {
    const back = previousStatusOf(o);
    try {
      const snapshot = await reopenOrder(o.id);
      toastWithUndo(`Reopened. Back to ${STATUS_LABELS[back]} on the Dashboard.`, () => restoreFollowUp(snapshot));
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'Could not reopen'));
      return false;
    }
  };

  const retry = async () => {
    setRetrying(true);
    await fetchOrders();
    setRetrying(false);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleExportJSON = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecommerce-orders-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setProfileOpen(false);
    toast.success('Data exported successfully!');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const success = await importData(text);
      if (success) toast.success('Data imported successfully!');
      else toast.error('Invalid backup file.');
    };
    reader.readAsText(file);
    e.target.value = '';
    setProfileOpen(false);
  };

  if (!mounted || !initialized) return <ArchiveSkeleton />;

  // Active filters as removable chips.
  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.range !== 'any' && (filters.range !== 'custom' || filters.from || filters.to)) {
    const label = filters.range === 'custom' ? `${filters.from || '…'} to ${filters.to || '…'}` : RANGE_LABEL[filters.range];
    activeChips.push({ key: 'range', label, clear: () => setFilters((f) => ({ ...f, range: 'any', from: '', to: '' })) });
  }
  for (const p of filters.platforms) {
    activeChips.push({ key: `p-${p}`, label: platformTitle(p), clear: () => setFilters((f) => ({ ...f, platforms: f.platforms.filter((x) => x !== p) })) });
  }
  if (filters.mediator) {
    activeChips.push({ key: 'med', label: `Mediator: ${mediators.find((m) => m.key === filters.mediator)?.name || filters.mediator}`, clear: () => setFilters((f) => ({ ...f, mediator: '' })) });
  }
  if (filters.reviewer) {
    activeChips.push({ key: 'rev', label: `Reviewer: ${reviewers.find((m) => m.key === filters.reviewer)?.name || filters.reviewer}`, clear: () => setFilters((f) => ({ ...f, reviewer: '' })) });
  }
  for (const b of filters.banks) {
    activeChips.push({ key: `b-${b}`, label: banks.find((x) => x.key === b)?.name || b, clear: () => setFilters((f) => ({ ...f, banks: f.banks.filter((x) => x !== b) })) });
  }

  const showLoadError = !!loadError && orders.length === 0;

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-dashboard-bg/80 backdrop-blur-xl border-b border-dashboard-border">
        <div className="flex items-center justify-end h-14 gap-2 pl-14 pr-4 md:px-6">
          <ThemeToggle />
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label="Account menu"
              className="w-9 h-9 rounded-full bg-accent-blue flex items-center justify-center text-white font-bold text-xs hover:ring-2 hover:ring-accent-blue/50 transition"
            >
              {authUser?.initials || '??'}
            </button>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-11 z-[70] w-56 bg-dashboard-card border border-dashboard-border rounded-xl shadow-2xl py-2 overflow-hidden">
                  <div className="px-4 py-3 border-b border-dashboard-border">
                    <p className="text-sm font-semibold text-text-primary">{authUser?.displayName || 'User'}</p>
                    <p className="text-xs text-text-muted truncate">{authUser?.email || ''}</p>
                  </div>
                  <button type="button" onClick={handleExportJSON} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-dashboard-bg hover:text-text-primary transition">
                    Backup Data (JSON)
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-dashboard-bg hover:text-text-primary transition">
                    Import Backup
                  </button>
                  <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
                  <div className="border-t border-dashboard-border mt-1 pt-1">
                    <button type="button" onClick={() => { setProfileOpen(false); router.push('/account-settings'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-dashboard-bg hover:text-text-primary transition">
                      Account Settings
                    </button>
                    <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition">
                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-5 pb-16 space-y-4 min-w-0">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Archive</h1>
          <p className="text-sm text-text-muted mt-0.5">Orders you were paid for, and cancelled orders</p>
        </div>

        {showLoadError ? (
          <div role="alert" className="rounded-xl border border-accent-red/30 bg-accent-red/10 p-5 text-center space-y-3">
            <p className="font-semibold text-text-primary">Couldn&apos;t load your orders</p>
            <p className="text-sm text-text-secondary">Check your internet connection and try again.</p>
            <button type="button" onClick={retry} disabled={retrying} className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent-blue text-white disabled:opacity-60">
              {retrying ? 'Trying…' : 'Try again'}
            </button>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label="Archive views" className="flex border-b border-dashboard-border">
              {(['orders', 'monthly'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`flex-1 sm:flex-none sm:px-8 py-2.5 -mb-px border-b-2 text-sm font-semibold transition ${
                    tab === t ? 'border-accent-blue text-accent-blue' : 'border-transparent text-text-muted hover:text-text-primary'
                  }`}
                >
                  {t === 'orders' ? 'Orders' : 'Monthly'}
                </button>
              ))}
            </div>

            {tab === 'orders' && (
              <div className="grid grid-cols-3 gap-2">
                <Tile label="Refund received" value={rupees(totals.received)} tone="green" />
                <Tile label="Paid" value={String(totals.paid)} />
                <Tile label="Cancelled" value={String(totals.cancelled)} tone="red" />
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order ID, product, mediator, reviewer…"
                aria-label="Search archived orders"
                className="w-full bg-dashboard-card border border-dashboard-border rounded-xl pl-9 pr-10 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg inline-flex items-center justify-center text-text-muted hover:text-text-primary"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick chips */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
              {tab === 'orders' &&
                ([
                  ['all', `All ${totals.paid + totals.cancelled}`],
                  ['paid', `Paid ${totals.paid}`],
                  ['cancelled', `Cancelled ${totals.cancelled}`],
                ] as [ArchiveStatusFilter, string][]).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setFilters((f) => ({ ...f, status: id }))} aria-pressed={filters.status === id} className={filters.status === id ? chipOn : chipOff}>
                    {label}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, range: f.range === 'this_month' ? 'any' : 'this_month', from: '', to: '' }))}
                aria-pressed={filters.range === 'this_month'}
                className={filters.range === 'this_month' ? chipOn : chipOff}
              >
                This month
              </button>
              <button type="button" onClick={() => setFiltersOpen(true)} className={`${filterCount > 0 ? chipOn : chipOff} border-dashed`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12M10 19h4" />
                </svg>
                Filters{filterCount > 0 ? ` · ${filterCount}` : ''}
              </button>
            </div>

            {activeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeChips.map((c) => (
                  <button key={c.key} type="button" onClick={c.clear} className="inline-flex items-center gap-1 max-w-full px-2 py-1 rounded-md bg-accent-blue/10 text-accent-blue text-xs font-medium" aria-label={`Remove filter ${c.label}`}>
                    <span className="break-words min-w-0 text-left">{c.label}</span>
                    <span aria-hidden="true">✕</span>
                  </button>
                ))}
                <button type="button" onClick={() => setFilters((f) => ({ ...DEFAULT_FILTERS, status: f.status, sort: f.sort }))} className="text-xs font-semibold text-text-muted hover:text-text-primary px-1">
                  Clear all
                </button>
              </div>
            )}

            {tab === 'orders' ? (
              <>
                <p className="text-xs text-text-muted" aria-live="polite">
                  {list.length} order{list.length === 1 ? '' : 's'} · {SORT_LABEL[filters.sort]}
                  {narrowed && filters.status !== 'cancelled' && totals.paid > 0 && (
                    <> · <span className="text-accent-green font-semibold">{rupees(totals.received)}</span> received</>
                  )}
                </p>

                {list.length === 0 ? (
                  <EmptyState hasAny={archived.length > 0} narrowed={narrowed || filters.status !== 'all'} onClear={clearAll} />
                ) : (
                  <>
                    <div className="grid gap-2.5 lg:grid-cols-2">
                      {visible.map((o) => (
                        <ArchiveCard key={o.id} order={o} query={query} today={today} onOpen={openOrder} />
                      ))}
                    </div>
                    {hasMore && (
                      <div ref={sentinel} className="flex justify-center pt-1">
                        <button type="button" onClick={() => setPage({ key: listKey, n: shown + PAGE_SIZE })} className="px-4 py-2 rounded-lg text-sm font-semibold border border-dashboard-border bg-dashboard-card text-text-secondary hover:text-text-primary">
                          Show more ({list.length - shown} left)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <MonthlyView orders={filtered} today={today} filtered={narrowed} onOpenOrder={openOrder} onClearFilters={clearAll} />
            )}
          </>
        )}
      </div>

      {filtersOpen && (
        <FiltersSheet
          initial={filters}
          platforms={platforms}
          mediators={mediators}
          reviewers={reviewers}
          banks={banks}
          countFor={countFor}
          onApply={(f) => {
            setFilters(f);
            setFiltersOpen(false);
          }}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {openOrderObj && (
        <OrderSheet key={openOrderObj.id} order={openOrderObj} bankNames={bankNames} onClose={() => setOpenId(null)} onSavePayment={savePayment} onReopen={reopen} />
      )}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-accent-green' : tone === 'red' ? 'text-accent-red' : 'text-text-primary';
  return (
    <div className="rounded-xl border border-dashboard-border bg-dashboard-card p-3 min-w-0">
      <p className="text-[11px] text-text-muted leading-tight">{label}</p>
      <p className={`text-base sm:text-xl font-bold tabular-nums mt-1 break-all ${color}`}>{value}</p>
    </div>
  );
}

function EmptyState({ hasAny, narrowed, onClear }: { hasAny: boolean; narrowed: boolean; onClear: () => void }) {
  if (hasAny && narrowed) {
    return (
      <div className="text-center py-14 px-4">
        <p className="text-text-primary font-semibold">No orders match</p>
        <p className="text-sm text-text-muted mt-1">Try a different search or clear the filters.</p>
        <button type="button" onClick={onClear} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-accent-blue text-white">
          Clear search and filters
        </button>
      </div>
    );
  }
  return (
    <div className="text-center py-14 px-4">
      <svg className="w-14 h-14 mx-auto text-text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
      <p className="text-text-primary font-semibold">No archived orders yet</p>
      <p className="text-sm text-text-muted mt-1">Orders move here when you mark them paid or cancelled.</p>
    </div>
  );
}
