'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useOrderStore } from '@/store/useOrderStore';
import ThemeToggle from '@/components/ThemeToggle';
import FollowUpRow from '@/components/FollowUpRow';
import { useAuth } from '@/hooks/useAuth';
import { todayStr } from '@/lib/followup';

type View = 'due' | 'upcoming' | 'all';

export default function FollowUpsPage() {
  const router = useRouter();
  const orders = useOrderStore((s) => s.orders);
  const getFollowUps = useOrderStore((s) => s.getFollowUps);
  const fetchOrders = useOrderStore((s) => s.fetchOrders);
  const initialized = useOrderStore((s) => s.initialized);
  const { user: authUser } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [view, setView] = useState<View>('due');
  const [search, setSearch] = useState('');
  const [mediator, setMediator] = useState('all');

  useEffect(() => {
    setMounted(true);
    if (!initialized) fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // getFollowUps reads the store's orders internally; recompute when orders change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const followUps = useMemo(() => getFollowUps(), [orders]);
  const today = todayStr();

  const dueCount = useMemo(() => followUps.filter((o) => o.nextReminderDate! <= today).length, [followUps, today]);
  const upcomingCount = followUps.length - dueCount;

  const mediators = useMemo(() => {
    const set = new Set<string>();
    followUps.forEach((o) => { if (o.mediatorName) set.add(o.mediatorName); });
    return Array.from(set).sort();
  }, [followUps]);

  const visible = useMemo(() => {
    let list = followUps;
    if (view === 'due') list = list.filter((o) => o.nextReminderDate! <= today);
    else if (view === 'upcoming') list = list.filter((o) => o.nextReminderDate! > today);
    if (mediator !== 'all') list = list.filter((o) => o.mediatorName === mediator);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((o) =>
        o.orderId.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q) ||
        o.mediatorName.toLowerCase().includes(q) ||
        o.reviewerName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [followUps, view, mediator, search, today]);

  if (!mounted || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dashboard-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <div className="text-text-muted text-sm">Loading follow-ups...</div>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Page header */}
      <div className="px-6 pt-5">
        <h1 className="text-2xl font-bold text-text-primary mb-1">Follow-ups</h1>
        <p className="text-sm text-text-muted mb-4">Refund reminders and mediator follow-ups</p>

        {/* KPI cards — clickable, same style as the dashboard; they drive the view filter */}
        <div className="grid grid-cols-3 gap-3 pb-4">
          {([
            {
              key: 'due' as View,
              label: 'Due / Overdue',
              value: dueCount,
              sub: dueCount > 0 ? 'Needs your action' : 'All caught up',
              color: dueCount > 0 ? 'text-red-400' : 'text-text-muted',
              urgent: dueCount > 0,
            },
            {
              key: 'upcoming' as View,
              label: 'Upcoming',
              value: upcomingCount,
              sub: 'Scheduled for later',
              color: 'text-yellow-400',
              urgent: false,
            },
            {
              key: 'all' as View,
              label: 'Total Active',
              value: followUps.length,
              sub: 'Tap to view all',
              color: 'text-green-400',
              urgent: false,
            },
          ]).map((kpi) => (
            <button
              key={kpi.key}
              onClick={() => setView(kpi.key)}
              aria-pressed={view === kpi.key}
              className={`text-left p-4 rounded-xl bg-dashboard-card border hover:bg-dashboard-card-hover transition cursor-pointer ${
                view === kpi.key ? 'ring-2 ring-accent-blue border-accent-blue' : 'border-dashboard-border'
              } ${kpi.urgent ? 'border-red-500/40' : ''}`}
            >
              <p className="text-xs text-text-muted">{kpi.label}</p>
              <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
              <p className="text-[10px] text-text-muted mt-0.5">{kpi.sub}</p>
            </button>
          ))}
        </div>

        {/* Search + mediator filter */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order ID, product, mediator, reviewer..."
            className="flex-1 bg-dashboard-card border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none"
          />
          <select
            value={mediator}
            onChange={(e) => setMediator(e.target.value)}
            aria-label="Filter by mediator"
            className="bg-dashboard-card border border-dashboard-border rounded-lg px-3 py-2.5 text-sm text-text-secondary focus:ring-2 focus:ring-accent-blue outline-none"
          >
            <option value="all">All Mediators</option>
            {mediators.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-text-muted mb-3">
          {visible.length} follow-up{visible.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* List */}
      <div className="px-6 pb-8 space-y-3">
        {visible.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-text-muted text-lg">
              {view === 'due' ? 'No follow-ups due' : 'No follow-ups found'}
            </p>
            <p className="text-text-muted text-sm mt-1">
              {view === 'due'
                ? 'You are all caught up. Reminders appear here on their due date.'
                : 'Reminders are scheduled when an order reaches a refund stage.'}
            </p>
          </div>
        ) : (
          visible.map((order) => <FollowUpRow key={order.id} order={order} />)
        )}
      </div>
    </div>
  );
}
