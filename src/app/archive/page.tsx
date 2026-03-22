'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase';
import { useOrderStore } from '@/store/useOrderStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';

const PLATFORM_BADGE_COLORS: Record<string, string> = {
  amazon: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  flipkart: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  meesho: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  myntra: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  jio: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  blinkit: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  ajio: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  other: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function ArchivePage() {
  const router = useRouter();
  const orders = useOrderStore((s) => s.orders);
  const getArchivedOrders = useOrderStore((s) => s.getArchivedOrders);
  const fetchOrders = useOrderStore((s) => s.fetchOrders);
  const exportData = useOrderStore((s) => s.exportData);
  const importData = useOrderStore((s) => s.importData);
  const initialized = useOrderStore((s) => s.initialized);
  const settingsPlatforms = useSettingsStore((s) => s.platforms);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user: authUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    setMounted(true);
    if (!initialized) fetchOrders();
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [platform, setPlatform] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bankFilter, setBankFilter] = useState<string>('all');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const archivedOrders = useMemo(() => {
    let filtered = orders.filter((o) => o.status === 'payment_received');
    if (platform && platform !== 'all') filtered = filtered.filter((o) => o.platform === platform);
    if (startDate) filtered = filtered.filter((o) => o.orderDate >= startDate);
    if (endDate) filtered = filtered.filter((o) => o.orderDate <= endDate);
    if (bankFilter && bankFilter !== 'all') filtered = filtered.filter((o) => o.paymentBank === bankFilter);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter((o) => {
        if (searchField === 'orderid') return o.orderId.toLowerCase().includes(q);
        if (searchField === 'product_name') return o.productName.toLowerCase().includes(q);
        if (searchField === 'mediator') return o.mediatorName.toLowerCase().includes(q);
        if (searchField === 'reviewer') return o.reviewerName.toLowerCase().includes(q);
        // 'all' - search across all fields
        return o.orderId.toLowerCase().includes(q) ||
          o.productName.toLowerCase().includes(q) ||
          o.mediatorName.toLowerCase().includes(q) ||
          o.reviewerName.toLowerCase().includes(q);
      });
    }
    return filtered.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [orders, search, searchField, platform, startDate, endDate, bankFilter]);

  const totalRefundReceived = useMemo(
    () => archivedOrders.reduce((sum, o) => sum + (o.totalAmount - o.sellerLess), 0),
    [archivedOrders]
  );

  const uniqueBanks = useMemo(() => {
    const allArchived = orders.filter((o) => o.status === 'payment_received');
    const banks = new Set<string>();
    allArchived.forEach((o) => { if (o.paymentBank) banks.add(o.paymentBank); });
    return Array.from(banks).sort();
  }, [orders]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dashboard-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <div className="text-text-muted text-sm">Loading...</div>
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
        <h1 className="text-2xl font-bold text-text-primary mb-1">Archive</h1>
        <p className="text-sm text-text-muted mb-4">Orders where payment has been received</p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="p-4 rounded-xl bg-dashboard-card border border-dashboard-border">
            <p className="text-xs text-text-muted">Archived Orders</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">{archivedOrders.length}</p>
          </div>
          <div className="p-4 rounded-xl bg-dashboard-card border border-dashboard-border">
            <p className="text-xs text-text-muted">Total Refund Received</p>
            <p className="text-xl font-bold text-green-400 mt-1">&#8377;{totalRefundReceived.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-4 rounded-xl bg-dashboard-card border border-dashboard-border">
            <p className="text-xs text-text-muted">Total Order Value</p>
            <p className="text-xl font-bold text-blue-400 mt-1">
              &#8377;{archivedOrders.reduce((s, o) => s + o.totalAmount, 0).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Platform Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-hide">
          {ALL_PLATFORMS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPlatform(p.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition ${
                platform === p.value
                  ? 'bg-accent-blue text-white'
                  : 'bg-dashboard-card border border-dashboard-border text-text-secondary hover:text-text-primary hover:bg-dashboard-card-hover'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Search with field selector */}
        <div className="flex gap-2 mb-3">
          <select
            value={searchField}
            onChange={(e) => setSearchField(e.target.value)}
            className="bg-dashboard-card border border-dashboard-border rounded-lg px-3 py-2.5 text-sm text-text-secondary focus:ring-2 focus:ring-accent-blue outline-none"
          >
            <option value="all">All Fields</option>
            <option value="orderid">Order ID</option>
            <option value="product_name">Product Name</option>
            <option value="mediator">Mediator</option>
            <option value="reviewer">Reviewer</option>
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search archived orders..."
            className="flex-1 bg-dashboard-card border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none"
          />
        </div>

        {/* Date range & Bank filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-text-muted whitespace-nowrap">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-dashboard-card border border-dashboard-border rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-2 focus:ring-accent-blue outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-text-muted whitespace-nowrap">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-dashboard-card border border-dashboard-border rounded-lg px-3 py-2 text-sm text-text-primary focus:ring-2 focus:ring-accent-blue outline-none"
            />
          </div>
          <select
            value={bankFilter}
            onChange={(e) => setBankFilter(e.target.value)}
            className="bg-dashboard-card border border-dashboard-border rounded-lg px-3 py-2 text-sm text-text-secondary focus:ring-2 focus:ring-accent-blue outline-none"
          >
            <option value="all">All Banks</option>
            {uniqueBanks.map((bank) => (
              <option key={bank} value={bank}>{bank}</option>
            ))}
          </select>
          {(startDate || endDate || bankFilter !== 'all') && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setBankFilter('all'); }}
              className="px-3 py-2 text-xs text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg transition"
            >
              Clear Filters
            </button>
          )}
        </div>

        <p className="text-xs text-text-muted mb-3">
          {archivedOrders.length} archived order{archivedOrders.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Archived orders list */}
      <div className="px-6 pb-8 space-y-3">
        {archivedOrders.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <p className="text-text-muted text-lg">No archived orders</p>
            <p className="text-text-muted text-sm mt-1">Orders move here when payment is received</p>
          </div>
        ) : (
          archivedOrders.map((order) => {
            const isExpanded = expandedOrder === order.id;
            return (
            <div
              key={order.id}
              className="rounded-xl overflow-hidden bg-dashboard-card border border-dashboard-border border-l-4 border-l-emerald-500"
            >
              <button
                type="button"
                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                className="w-full text-left p-4 hover:bg-dashboard-card-hover transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-bold text-text-primary truncate">{order.orderId}</p>
                    <p className="text-sm text-text-secondary mt-0.5">{order.productName}</p>
                    <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${PLATFORM_BADGE_COLORS[order.platform.toLowerCase()] || PLATFORM_BADGE_COLORS.other}`}>
                        {order.platform}
                      </span>
                      <span>|</span>
                      <span>{order.orderDate}</span>
                      <span>|</span>
                      <span>{order.orderType}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-green-400">&#8377;{order.totalAmount.toLocaleString('en-IN')}</p>
                    {order.sellerLess > 0 && (
                      <p className="text-xs text-text-muted">Less: &#8377;{order.sellerLess}</p>
                    )}
                    <p className="text-xs font-bold text-emerald-400 mt-1">
                      Received Amount: &#8377;{(order.totalAmount - order.sellerLess).toLocaleString('en-IN')}
                    </p>
                    <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-600 text-white">
                      Payment Received
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-dashboard-border pt-3 space-y-2 text-xs">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <span className="text-text-muted">Reviewer</span>
                      <p className="font-semibold text-text-primary">{order.reviewerName || '-'}</p>
                    </div>
                    <div>
                      <span className="text-text-muted">Mediator</span>
                      <p className="font-semibold text-text-primary">{order.mediatorName || '-'}</p>
                    </div>
                    <div>
                      <span className="text-text-muted">Email</span>
                      <p className="font-semibold text-text-primary truncate">{order.email || '-'}</p>
                    </div>
                    {order.deliveredDate && (
                      <div>
                        <span className="text-text-muted">Delivered</span>
                        <p className="font-semibold text-text-primary">{new Date(order.deliveredDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                    )}
                    {order.reviewRatingDate && (
                      <div>
                        <span className="text-text-muted">Review/Rating</span>
                        <p className="font-semibold text-text-primary">{new Date(order.reviewRatingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                    )}
                    {order.refundFormFilledDate && (
                      <div>
                        <span className="text-text-muted">Refund Form Filled</span>
                        <p className="font-semibold text-text-primary">{new Date(order.refundFormFilledDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                    )}
                    {order.informedMediatorDate && (
                      <div>
                        <span className="text-text-muted">Informed Mediator</span>
                        <p className="font-semibold text-text-primary">{new Date(order.informedMediatorDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                    )}
                    {order.paymentReceivedDate && (
                      <div>
                        <span className="text-text-muted">Payment Received</span>
                        <p className="font-semibold text-text-primary">{new Date(order.paymentReceivedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                    )}
                    {order.paymentBank && (
                      <div>
                        <span className="text-text-muted">Payment Bank</span>
                        <p className="font-semibold text-emerald-400">{order.paymentBank}</p>
                      </div>
                    )}
                    {order.brandName && (
                      <div>
                        <span className="text-text-muted">Brand</span>
                        <p className="font-semibold text-text-primary">{order.brandName}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}
