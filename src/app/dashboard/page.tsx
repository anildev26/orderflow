'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase';
import { useOrderStore } from '@/store/useOrderStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { OrderStatus } from '@/types/order';
import OrderCard from '@/components/OrderCard';
import FilterPanel from '@/components/FilterPanel';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const router = useRouter();
  const orders = useOrderStore((s) => s.orders);
  const getActiveOrders = useOrderStore((s) => s.getActiveOrders);
  const getStats = useOrderStore((s) => s.getStats);
  const exportData = useOrderStore((s) => s.exportData);
  const importData = useOrderStore((s) => s.importData);

  const settingsPlatforms = useSettingsStore((s) => s.platforms);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const { user: authUser } = useAuth();

  const ALL_PLATFORMS: { value: string; label: string }[] = [
    { value: 'all', label: 'All' },
    ...settingsPlatforms,
  ];

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };
  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orderflow-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setProfileOpen(false);
    toast.success('Data exported successfully!');
  };

  const handleExportExcel = () => {
    const allOrders = useOrderStore.getState().orders;
    const headers = ['Order ID','Platform','Email','Brand','Product','Order Date','Amount','Seller Less','Mediator','Reviewer','Type','Status','Delivered Date','Return Days','Review/Rating Date','Refund Form Date','Informed Mediator Date','Payment Received Date','Payment Bank'];
    const rows = allOrders.map(o => [
      o.orderId, o.platform, o.email, o.brandName, o.productName, o.orderDate,
      o.totalAmount, o.sellerLess, o.mediatorName, o.reviewerName, o.orderType,
      o.status, o.deliveredDate || '', o.returnPeriodDays || '', o.reviewRatingDate || '', o.refundFormFilledDate || '', o.informedMediatorDate || '', o.paymentReceivedDate || '', o.paymentBank || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orderflow-orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setProfileOpen(false);
    toast.success('Excel/CSV exported successfully!');
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
      if (success) {
        toast.success('Data imported successfully!');
      } else {
        toast.error('Invalid backup file. Please use a valid JSON export.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setProfileOpen(false);
  };

  const fetchOrders = useOrderStore((s) => s.fetchOrders);
  const loading = useOrderStore((s) => s.loading);
  const initialized = useOrderStore((s) => s.initialized);

  useEffect(() => {
    setMounted(true);
    fetchOrders();
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [sortOption, setSortOption] = useState('newest');
  const [appliedStatus, setAppliedStatus] = useState<OrderStatus | 'all'>('all');

  const stats = useMemo(() => getStats(platformFilter), [orders, getStats, platformFilter]);
  const filteredOrders = useMemo(
    () => getActiveOrders(appliedStatus, searchQuery, 'all', platformFilter, monthFilter),
    [orders, appliedStatus, searchQuery, platformFilter, monthFilter, getActiveOrders]
  );

  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    switch (sortOption) {
      case 'oldest':
        sorted.sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
        break;
      case 'amount_high':
        sorted.sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0));
        break;
      case 'amount_low':
        sorted.sort((a, b) => (a.totalAmount || 0) - (b.totalAmount || 0));
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
        break;
    }
    return sorted;
  }, [filteredOrders, sortOption]);

  // Generate unique months from orders
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    orders.forEach((o) => {
      const d = new Date(o.orderDate);
      if (!isNaN(d.getTime())) {
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const y = d.getFullYear().toString();
        months.add(`${y}-${m}`);
      }
    });
    return Array.from(months).sort().reverse();
  }, [orders]);

  const formatMonth = (m: string) => {
    const [year, month] = m.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  const handleApplyFilters = () => {
    setAppliedStatus(statusFilter);
    setFiltersOpen(false);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPlatformFilter('all');
    setMonthFilter('all');
    setAppliedStatus('all');
    setSortOption('newest');
    setFiltersOpen(false);
  };

  // Click on KPI card to filter
  const handleKpiClick = (status: OrderStatus | 'all') => {
    setAppliedStatus(status);
    setStatusFilter(status);
  };

  const kpiCards = [
    {
      label: 'Active Orders',
      value: stats.totalOrders.toString(),
      sub: 'Non-archived orders',
      color: 'text-yellow-400',
      filterStatus: 'all' as OrderStatus | 'all',
      clickable: true,
    },
    {
      label: 'Total Amount',
      value: `₹${stats.totalAmount.toLocaleString('en-IN')}`,
      sub: 'Active order value',
      color: 'text-green-400',
      filterStatus: 'all' as OrderStatus | 'all',
      clickable: true,
    },
    {
      label: 'Refund Form Pending',
      value: stats.refundFormPending.toString(),
      sub: 'Form not yet filled',
      color: 'text-red-400',
      filterStatus: 'refund_form_pending' as OrderStatus | 'all',
      clickable: true,
    },
    {
      label: 'Refund Form Filled',
      value: stats.refundFormFilled.toString(),
      sub: 'Awaiting processing',
      color: 'text-green-400',
      filterStatus: 'refund_form_filled' as OrderStatus | 'all',
      clickable: true,
    },
    {
      label: 'Archived (Paid)',
      value: stats.archivedOrders.toString(),
      sub: 'Payment received',
      color: 'text-emerald-400',
      filterStatus: 'payment_received' as OrderStatus | 'all',
      clickable: false,
      link: '/archive',
    },
    {
      label: 'Actual Spent',
      value: `₹${stats.actualSpent.toLocaleString('en-IN')}`,
      sub: 'Your money invested',
      color: 'text-cyan-400',
      filterStatus: 'all' as OrderStatus | 'all',
      clickable: false,
    },
  ];

  if (!mounted || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dashboard-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <div className="text-text-muted text-sm">Loading orders...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-dashboard-bg/80 backdrop-blur-xl border-b border-dashboard-border">
        <div className="flex items-center justify-end px-6 h-14 gap-2">
          <ThemeToggle />
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
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
                  <button onClick={handleExportExcel} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-dashboard-bg hover:text-text-primary transition">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export Data (CSV)
                  </button>
                  <button onClick={handleExportJSON} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-dashboard-bg hover:text-text-primary transition">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Backup Data (JSON)
                  </button>
                  <button onClick={() => { fileInputRef.current?.click(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-dashboard-bg hover:text-text-primary transition">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import Backup
                  </button>
                  <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
                  <div className="border-t border-dashboard-border mt-1 pt-1">
                    <button onClick={() => { setProfileOpen(false); router.push('/account-settings'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-dashboard-bg hover:text-text-primary transition">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Account Settings
                    </button>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Page header */}
      <div className="px-6 pt-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-text-primary">OrderFlow</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFiltersOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-dashboard-card border border-dashboard-border rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-dashboard-card-hover transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-2 px-3 py-2 bg-dashboard-card border border-dashboard-border rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-dashboard-card-hover transition"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Always-visible Search Bar */}
        <div className="mb-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by order ID, product name, reviewer, mediator..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-dashboard-card border border-dashboard-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none transition"
            />
          </div>
        </div>

        {/* Platform Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-hide">
          {ALL_PLATFORMS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPlatformFilter(p.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition ${
                platformFilter === p.value
                  ? 'bg-accent-blue text-white'
                  : 'bg-dashboard-card border border-dashboard-border text-text-secondary hover:text-text-primary hover:bg-dashboard-card-hover'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Month, Sort & Order Count */}
        <div className="flex items-center gap-2 mb-4">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="bg-dashboard-card border border-dashboard-border rounded-lg px-2.5 py-1.5 text-xs text-text-secondary outline-none"
          >
            <option value="all">All Months</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </select>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="bg-dashboard-card border border-dashboard-border rounded-lg px-2.5 py-1.5 text-xs text-text-secondary outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="amount_high">Amount: High → Low</option>
            <option value="amount_low">Amount: Low → High</option>
          </select>
          <span className="ml-2 md:ml-4 text-xs text-text-muted whitespace-nowrap">
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pb-4">
          {kpiCards.map((kpi, i) =>
            kpi.clickable ? (
              <button
                key={i}
                onClick={() => handleKpiClick(kpi.filterStatus)}
                className={`text-left p-4 rounded-xl bg-dashboard-card border border-dashboard-border hover:bg-dashboard-card-hover transition cursor-pointer ${
                  appliedStatus === kpi.filterStatus ? 'ring-2 ring-accent-blue' : ''
                }`}
              >
                <p className="text-xs text-text-muted">{kpi.label}</p>
                <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[10px] text-text-muted mt-0.5">{kpi.sub}</p>
              </button>
            ) : kpi.link ? (
              <Link
                key={i}
                href={kpi.link}
                className="text-left p-4 rounded-xl bg-dashboard-card border border-dashboard-border hover:bg-dashboard-card-hover transition cursor-pointer"
              >
                <p className="text-xs text-text-muted">{kpi.label}</p>
                <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[10px] text-text-muted mt-0.5">{kpi.sub}</p>
              </Link>
            ) : (
              <div
                key={i}
                className="text-left p-4 rounded-xl bg-dashboard-card border border-dashboard-border"
              >
                <p className="text-xs text-text-muted">{kpi.label}</p>
                <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[10px] text-text-muted mt-0.5">{kpi.sub}</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Orders list */}
      <div className="px-6 pb-8 space-y-3 mt-1">
        {sortedOrders.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-text-muted text-lg">No orders found</p>
            <p className="text-text-muted text-sm mt-1">
              Try adjusting your filters or{' '}
              <Link href="/order-form" className="text-accent-blue hover:underline">
                create a new order
              </Link>
            </p>
          </div>
        ) : (
          sortedOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))
        )}
      </div>

      {/* Filter Panel */}
      <FilterPanel
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      {/* Mobile floating button - New Order */}
      <Link
        href="/order-form"
        className="fixed bottom-5 right-5 z-30 h-11 px-4 bg-accent-blue text-white rounded-full shadow-lg shadow-accent-blue/30 flex items-center gap-2 hover:bg-blue-600 active:scale-95 transition md:hidden"
        aria-label="New Order"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-sm font-medium">New Order</span>
      </Link>
    </div>
  );
}
