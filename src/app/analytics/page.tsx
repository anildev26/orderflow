'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase';
import { useOrderStore } from '@/store/useOrderStore';
import MonthlyTrendChart from '@/components/MonthlyTrendChart';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';

export default function AnalyticsPage() {
  const router = useRouter();
  const orders = useOrderStore((s) => s.orders);
  const getStats = useOrderStore((s) => s.getStats);
  const fetchOrders = useOrderStore((s) => s.fetchOrders);
  const exportData = useOrderStore((s) => s.exportData);
  const importData = useOrderStore((s) => s.importData);
  const initialized = useOrderStore((s) => s.initialized);
  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user: authUser } = useAuth();
  useEffect(() => { setMounted(true); if (!initialized) fetchOrders(); }, [fetchOrders, initialized]);

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
    a.download = `orderflow-backup-${new Date().toISOString().split('T')[0]}.json`;
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

  const stats = useMemo(() => getStats(), [orders, getStats]);

  // Calculate platform distribution
  const platformData = useMemo(() => {
    const platMap: Record<string, number> = {};
    orders.forEach((o) => {
      const name = o.platform.charAt(0).toUpperCase() + o.platform.slice(1);
      platMap[name] = (platMap[name] || 0) + 1;
    });
    return Object.entries(platMap)
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  // Calculate monthly trend data
  const monthlyData = useMemo(() => {
    const monthMap: Record<string, number> = {};
    orders.forEach((o) => {
      const d = new Date(o.orderDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = (monthMap[key] || 0) + 1;
    });
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => {
        const [year, month] = key.split('-');
        const monthName = new Date(Number(year), Number(month) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        return { month: monthName, count };
      });
  }, [orders]);

  // Calculate platform-wise amount breakdown
  const platformAmountData = useMemo(() => {
    const platAmountMap: Record<string, number> = {};
    orders.forEach((o) => {
      const name = o.platform.charAt(0).toUpperCase() + o.platform.slice(1);
      platAmountMap[name] = (platAmountMap[name] || 0) + o.totalAmount;
    });
    return Object.entries(platAmountMap)
      .map(([platform, amount]) => ({ platform, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [orders]);

  // Refund success rate (payment_received / total orders)
  const refundSuccessRate = useMemo(() => {
    if (orders.length === 0) return 0;
    const paidCount = orders.filter((o) => o.status === 'payment_received').length;
    return parseFloat(((paidCount / orders.length) * 100).toFixed(1));
  }, [orders]);

  // Tier calculation
  const tier = useMemo(() => {
    const total = stats.totalAmount;
    if (total >= 100000) return { name: 'Platinum', color: 'text-blue-400', bg: 'bg-blue-500/20', progress: 100, next: 'Platinum' };
    if (total >= 50000) return { name: 'Gold', color: 'text-yellow-400', bg: 'bg-yellow-500/20', progress: Math.round((total / 100000) * 100), next: 'Platinum' };
    if (total >= 25000) return { name: 'Silver', color: 'text-gray-300', bg: 'bg-gray-400/20', progress: Math.round((total / 50000) * 100), next: 'Gold' };
    return { name: 'Bronze', color: 'text-orange-400', bg: 'bg-orange-500/20', progress: Math.round((total / 25000) * 100), next: 'Silver' };
  }, [stats.totalAmount]);

  // First order date
  const firstOrderDate = useMemo(() => {
    if (orders.length === 0) return 'N/A';
    const sorted = [...orders].sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
    return new Date(sorted[0].orderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [orders]);

  // Customer age in days
  const customerAge = useMemo(() => {
    if (orders.length === 0) return 0;
    const sorted = [...orders].sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
    return Math.floor((Date.now() - new Date(sorted[0].orderDate).getTime()) / (1000 * 60 * 60 * 24));
  }, [orders]);

  // Recency (days since last order)
  const recency = useMemo(() => {
    if (orders.length === 0) return 0;
    const sorted = [...orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    return Math.floor((Date.now() - new Date(sorted[0].orderDate).getTime()) / (1000 * 60 * 60 * 24));
  }, [orders]);

  // Frequency
  const frequency = useMemo(() => {
    if (orders.length === 0 || customerAge === 0) return 0;
    return parseFloat((orders.length / (customerAge / 30)).toFixed(2));
  }, [orders, customerAge]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading...</div>
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

      <div className="px-6 py-5 space-y-6">
        {/* Welcome banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600/20 via-sky-500/10 to-transparent border border-blue-500/20">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                My Order Analytics
                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  Insights
                </span>
              </h1>
              <p className="text-sm text-text-secondary mt-1">
                {authUser?.displayName || 'User'} &middot; {authUser?.email || ''}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${tier.bg} ${tier.color}`}>
                Tier: {tier.name}
              </span>
            </div>
          </div>
        </div>

        {/* Main KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="kpi-card p-5 rounded-xl bg-dashboard-card border border-dashboard-border">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">Total Order Amount (Valid)</p>
              <span className="text-lg text-text-muted">&#8377;</span>
            </div>
            <p className="text-2xl font-bold text-green-400 mt-1">
              &#8377;{stats.totalAmount.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {stats.totalOrders} orders
            </p>
          </div>
          <div className="kpi-card p-5 rounded-xl bg-dashboard-card border border-dashboard-border">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">Archived (Paid) Orders</p>
              <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-blue-400 mt-1">
              {stats.archivedOrders}
            </p>
            <p className="text-xs text-text-muted mt-1">Payment received</p>
          </div>
          <div className="kpi-card p-5 rounded-xl bg-dashboard-card border border-dashboard-border">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">Total Orders (Valid)</p>
              <span className="text-lg text-text-muted">#</span>
            </div>
            <p className="text-2xl font-bold text-purple-400 mt-1">
              {stats.totalOrders}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {frequency}/mo
            </p>
          </div>
          <div className="kpi-card p-5 rounded-xl bg-dashboard-card border border-dashboard-border">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">Avg Order Value (AOV)</p>
              <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-yellow-400 mt-1">
              &#8377;{stats.totalOrders > 0 ? Math.round(stats.totalAmount / stats.totalOrders).toLocaleString('en-IN') : 0}
            </p>
            <p className="text-xs text-text-muted mt-1">Per order</p>
          </div>
        </div>

        {/* More KPIs */}
        <div>
          <h3 className="text-sm font-semibold text-text-secondary mb-3">More KPIs</h3>
          <div className="kpi-scroll flex gap-3">
            {[
              { label: 'Refund Forms', value: stats.refundFormFilled.toString(), sub: 'Forms filled', icon: '📝' },
              { label: 'Refund Pending', value: stats.refundFormPending.toString(), sub: 'Pending', icon: '⏳' },
              { label: 'Archived', value: stats.archivedOrders.toString(), sub: 'Paid', icon: '✅' },
              { label: 'Refund Success Rate', value: `${refundSuccessRate}%`, sub: `${stats.archivedOrders}/${orders.length} paid`, icon: '💰' },
              { label: 'Internal Orders', value: stats.totalOrders.toString(), sub: 'Internal', icon: '👤' },
              { label: 'Last Order', value: orders.length > 0 ? new Date(orders[0].orderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A', sub: `${recency} days ago`, icon: '⏰' },
            ].map((kpi, i) => (
              <div key={i} className="kpi-card flex-shrink-0 min-w-[160px] p-4 rounded-xl bg-dashboard-card border border-dashboard-border">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-muted">{kpi.label}</p>
                  <span className="text-lg">{kpi.icon}</span>
                </div>
                <p className="text-xl font-bold text-text-primary mt-1">{kpi.value}</p>
                <p className="text-xs text-text-muted">{kpi.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Trend + Platform Amount */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trend Chart */}
          <div className="p-5 rounded-xl bg-dashboard-card border border-dashboard-border">
            <h3 className="text-base font-semibold text-text-primary mb-4">Orders Per Month</h3>
            <div className="h-64">
              {monthlyData.length > 0 ? (
                <MonthlyTrendChart data={monthlyData} />
              ) : (
                <div className="flex items-center justify-center h-full text-text-muted text-sm">No order data</div>
              )}
            </div>
          </div>

          {/* Platform-wise Amount Breakdown */}
          <div className="p-5 rounded-xl bg-dashboard-card border border-dashboard-border">
            <h3 className="text-base font-semibold text-text-primary mb-4">Platform-wise Amount</h3>
            {platformAmountData.length > 0 ? (
              <div className="space-y-3">
                {platformAmountData.map((p) => {
                  const maxAmount = platformAmountData[0]?.amount || 1;
                  const widthPct = Math.max((p.amount / maxAmount) * 100, 8);
                  return (
                    <div key={p.platform}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-text-secondary font-medium">{p.platform}</span>
                        <span className="text-sm font-bold text-text-primary">&#8377;{p.amount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="w-full bg-gray-700/40 rounded-full h-2.5">
                        <div
                          className="h-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-text-muted text-sm">No order data</div>
            )}
          </div>
        </div>

        {/* Bottom sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Segments / Tier */}
          <div className="p-5 rounded-xl bg-dashboard-card border border-dashboard-border">
            <h3 className="text-base font-semibold text-text-primary mb-1">Customer Segments</h3>
            <p className="text-xs text-text-secondary mb-4">
              Quick summary of your buying behavior
            </p>

            {/* Tier badge */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">🏅</span>
              <div>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${tier.bg} ${tier.color}`}>
                  Tier: {tier.name}
                </span>
                <p className="text-xs text-text-muted mt-1">Early purchase activity</p>
              </div>
            </div>

            {/* Tier grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {['Bronze', 'Silver', 'Gold', 'Platinum'].map((t) => (
                <div
                  key={t}
                  className={`p-2 rounded-lg border text-sm ${
                    tier.name === t
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400 font-bold'
                      : 'bg-dashboard-bg border-dashboard-border text-text-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>🏅</span>
                    <div>
                      <p className="text-xs font-medium">{t}</p>
                      <p className="text-[10px] text-text-muted">
                        {t === 'Bronze' ? 'Starter' : t === 'Silver' ? 'Growing' : t === 'Gold' ? 'Loyal' : 'VIP'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                  style={{ width: `${Math.min(tier.progress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-text-muted">Progress</span>
                <span className="text-xs text-text-primary font-medium">{tier.progress}%</span>
              </div>
              <p className="text-xs text-text-muted">Towards {tier.next}</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 rounded-lg bg-dashboard-bg">
                <p className="text-[10px] text-text-muted">First Order Date</p>
                <p className="text-sm font-bold text-text-primary">{firstOrderDate}</p>
              </div>
              <div className="p-3 rounded-lg bg-dashboard-bg">
                <p className="text-[10px] text-text-muted">Customer Age</p>
                <p className="text-sm font-bold text-text-primary">{customerAge} days</p>
              </div>
              <div className="p-3 rounded-lg bg-dashboard-bg">
                <p className="text-[10px] text-text-muted">Recency</p>
                <p className="text-sm font-bold text-text-primary">{recency} days</p>
              </div>
              <div className="p-3 rounded-lg bg-dashboard-bg">
                <p className="text-[10px] text-text-muted">Frequency (orders/month)</p>
                <p className="text-sm font-bold text-text-primary">{frequency}</p>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="p-5 rounded-xl bg-dashboard-card border border-dashboard-border">
            <h3 className="text-base font-semibold text-text-primary mb-3">Quick Links</h3>
            <div className="space-y-2">
              <Link href="/dashboard" className="flex items-center gap-3 p-3 rounded-lg bg-dashboard-bg hover:bg-dashboard-card-hover transition">
                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                  <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-text-primary">Orders Dashboard</p>
                  <p className="text-xs text-text-muted">Order list & status</p>
                </div>
              </Link>
              <Link href="/order-form" className="flex items-center gap-3 p-3 rounded-lg bg-dashboard-bg hover:bg-dashboard-card-hover transition">
                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-text-primary">New Order</p>
                  <p className="text-xs text-text-muted">Submit new order form</p>
                </div>
              </Link>
              <Link href="/archive" className="flex items-center gap-3 p-3 rounded-lg bg-dashboard-bg hover:bg-dashboard-card-hover transition">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                  <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-text-primary">Archive</p>
                  <p className="text-xs text-text-muted">Paid orders history</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
