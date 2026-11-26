'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase';
import { useOrderStore } from '@/store/useOrderStore';
import { useMediatorStore } from '@/store/useMediatorStore';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import type { Order } from '@/types/order';
import { fmtDate, todayStr } from '@/lib/followup';
import { followUpMediatorPhone } from '@/lib/mediators';
import { addWorkingDays, countWorkingDays, workingDaysLabel } from '@/lib/workingDays';
import {
  groupByMediator,
  inView,
  matchesFollowUpSearch,
  mediatorChips,
  mediatorKeyOf,
  mediatorScore,
  platformChips,
  rupees,
  sortFollowUps,
  summarize,
  type FollowUpSort,
  type FollowUpView,
  type MediatorGroup,
} from '@/lib/followUpBoard';
import FollowUpCard from './_components/FollowUpCard';
import { GotPaidSheet, MoreSheet } from './_components/OrderSheets';
import { CombinedMessageSheet, MediatorCard } from './_components/MediatorView';
import { errorMessage, toastWithUndo } from './_components/ui';

const UpdateOrderModal = dynamic(() => import('@/components/UpdateOrderModal'), { ssr: false });

const CONTACT_GAP_WORKING_DAYS = 3;
type GroupBy = 'order' | 'mediator';

export default function FollowUpsPage() {
  const router = useRouter();
  const orders = useOrderStore((s) => s.orders);
  const getFollowUps = useOrderStore((s) => s.getFollowUps);
  const fetchOrders = useOrderStore((s) => s.fetchOrders);
  const initialized = useOrderStore((s) => s.initialized);
  const markContacted = useOrderStore((s) => s.markContacted);
  const snoozeReminder = useOrderStore((s) => s.snoozeReminder);
  const stopReminders = useOrderStore((s) => s.stopReminders);
  const markPaid = useOrderStore((s) => s.markPaid);
  const restoreFollowUp = useOrderStore((s) => s.restoreFollowUp);
  const mediators = useMediatorStore((s) => s.mediators);
  const ensureMediators = useMediatorStore((s) => s.ensureLoaded);
  const { user: authUser } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [view, setView] = useState<FollowUpView>('due');
  const [groupBy, setGroupBy] = useState<GroupBy>('order');
  const [search, setSearch] = useState('');
  const [mediatorFilter, setMediatorFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [sort, setSort] = useState<FollowUpSort>('overdue');
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [moreId, setMoreId] = useState<string | null>(null);
  const [paidId, setPaidId] = useState<string | null>(null);
  const [updateId, setUpdateId] = useState<string | null>(null);
  const [messageKey, setMessageKey] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!initialized) fetchOrders();
    void ensureMediators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const today = todayStr();
  // getFollowUps reads the store's orders internally; recompute when orders change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const followUps = useMemo(() => getFollowUps(), [orders]);
  const waitDays = useCallback(
    (o: Pick<Order, 'refundFormFilledDate'>) => (o.refundFormFilledDate ? countWorkingDays(o.refundFormFilledDate, today) : null),
    [today],
  );
  const summary = useMemo(() => summarize(followUps, today, waitDays), [followUps, today, waitDays]);

  // What is on screen: view + search. Filters are built from this, so they only list what exists.
  const inScope = useMemo(
    () => inView(followUps, view, today).filter((o) => matchesFollowUpSearch(o, search)),
    [followUps, view, today, search],
  );
  const medChips = useMemo(
    () => mediatorChips(platformFilter === 'all' ? inScope : inScope.filter((o) => o.platform === platformFilter)),
    [inScope, platformFilter],
  );
  const platChips = useMemo(
    () => platformChips(mediatorFilter === 'all' ? inScope : inScope.filter((o) => mediatorKeyOf(o) === mediatorFilter)),
    [inScope, mediatorFilter],
  );
  // A chosen filter that no longer matches anything on screen quietly falls back to All.
  const activeMediator = mediatorFilter !== 'all' && medChips.some((c) => c.key === mediatorFilter) ? mediatorFilter : 'all';
  const activePlatform = platformFilter !== 'all' && platChips.some((c) => c.key === platformFilter) ? platformFilter : 'all';

  const visible = useMemo(() => {
    let l = inScope;
    if (activeMediator !== 'all') l = l.filter((o) => mediatorKeyOf(o) === activeMediator);
    if (activePlatform !== 'all') l = l.filter((o) => o.platform === activePlatform);
    return sortFollowUps(l, sort);
  }, [inScope, activeMediator, activePlatform, sort]);

  const groups = useMemo(() => groupByMediator(visible, today), [visible, today]);
  // The message sheet always lists everything still waiting with that mediator, due or not.
  const allGroups = useMemo(() => groupByMediator(followUps, today), [followUps, today]);
  const scores = useMemo(() => {
    const m = new Map<string, ReturnType<typeof mediatorScore>>();
    for (const g of allGroups) m.set(g.key, mediatorScore(orders, g.key, countWorkingDays));
    return m;
  }, [allGroups, orders]);

  const phoneFor = useCallback((o: Order) => followUpMediatorPhone(o, mediators), [mediators]);
  const groupPhone = (g: MediatorGroup<Order>) => {
    for (const o of g.orders) {
      const p = phoneFor(o);
      if (p) return p;
    }
    return null;
  };

  const findOrder = (id: string | null) => (id ? orders.find((o) => o.id === id) : undefined);
  const moreOrder = findOrder(moreId);
  const paidOrder = findOrder(paidId);
  const updateOrder = findOrder(updateId);
  const messageGroup = messageKey ? allGroups.find((g) => g.key === messageKey) : undefined;

  const setBusy = (ids: string[], on: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const undoAll = (snapshots: Order[]) => async () => {
    for (const s of snapshots) await restoreFollowUp(s);
  };

  /** Mark one or more orders contacted; next reminder in 3 working days. Returns true if all saved. */
  const contacted = async (list: Order[]): Promise<boolean> => {
    const ids = list.map((o) => o.id);
    if (ids.some((id) => busyIds.has(id))) return false;
    setBusy(ids, true);
    const next = addWorkingDays(today, CONTACT_GAP_WORKING_DAYS);
    const done: Order[] = [];
    let failure: unknown = null;
    for (const o of list) {
      const snapshot = { ...o, reminderHistory: [...(o.reminderHistory || [])] };
      try {
        await markContacted(o.id, next);
        done.push(snapshot);
      } catch (err) {
        failure = err;
      }
    }
    setBusy(ids, false);
    if (done.length) {
      toastWithUndo(
        done.length === 1
          ? `Marked contacted. Next reminder ${fmtDate(next)}.`
          : `${done.length} orders marked contacted. Next reminder ${fmtDate(next)}.`,
        undoAll(done),
      );
    }
    if (failure) {
      toast.error(errorMessage(failure, `Could not save ${list.length - done.length} of ${list.length}`));
      return false;
    }
    return true;
  };

  const snooze = async (o: Order, date: string, note: string): Promise<boolean> => {
    const snapshot = { ...o, reminderHistory: [...(o.reminderHistory || [])] };
    setBusy([o.id], true);
    try {
      await snoozeReminder(o.id, date, note);
      toastWithUndo(`Next reminder ${fmtDate(date)}.`, undoAll([snapshot]));
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the reminder'));
      return false;
    } finally {
      setBusy([o.id], false);
    }
  };

  const stop = async (o: Order, note: string): Promise<boolean> => {
    const snapshot = { ...o, reminderHistory: [...(o.reminderHistory || [])] };
    setBusy([o.id], true);
    try {
      await stopReminders(o.id, note);
      toastWithUndo('Reminders stopped for this order.', undoAll([snapshot]));
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'Could not stop reminders'));
      return false;
    } finally {
      setBusy([o.id], false);
    }
  };

  const paid = async (o: Order, date: string, bank: string): Promise<boolean> => {
    const snapshot = { ...o, reminderHistory: [...(o.reminderHistory || [])] };
    setBusy([o.id], true);
    try {
      await markPaid(o.id, date, bank);
      toastWithUndo(`Paid on ${fmtDate(date)}. Moved to Archive.`, undoAll([snapshot]));
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'Could not mark as paid'));
      return false;
    } finally {
      setBusy([o.id], false);
    }
  };

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

  const viewTabs: { id: FollowUpView; label: string; count: number }[] = [
    { id: 'due', label: 'Due', count: summary.dueCount },
    { id: 'upcoming', label: 'Upcoming', count: summary.upcomingCount },
    { id: 'all', label: 'All', count: summary.totalCount },
  ];

  const chipCls = (on: boolean) =>
    `px-3 py-1.5 rounded-full text-xs border whitespace-nowrap transition flex-shrink-0 ${
      on ? 'border-accent-blue/50 bg-accent-blue/10 text-accent-blue font-semibold' : 'border-dashboard-border bg-dashboard-card text-text-secondary hover:text-text-primary'
    }`;

  return (
    <div className="min-h-screen min-w-0">
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
                  <button type="button" onClick={() => { setProfileOpen(false); router.push('/account-settings'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-dashboard-bg hover:text-text-primary transition">
                    Account Settings
                  </button>
                  <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition">
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-5 pb-16 space-y-4 min-w-0">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Follow-ups</h1>
          <p className="text-sm text-text-muted mt-0.5">Refund reminders and mediator follow-ups</p>
        </div>

        {/* Money summary */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div className={`rounded-xl border p-3 sm:p-4 bg-dashboard-card ${summary.dueCount ? 'border-accent-red/40' : 'border-dashboard-border'}`}>
            <p className="text-[11px] sm:text-xs text-text-muted">Due now</p>
            <p className={`text-lg sm:text-2xl font-bold tabular-nums mt-0.5 ${summary.dueCount ? 'text-accent-red' : 'text-text-muted'}`}>{rupees(summary.dueAmount)}</p>
            <p className="text-[10.5px] sm:text-xs text-text-muted">{summary.dueCount ? `${summary.dueCount} ${summary.dueCount === 1 ? 'order needs' : 'orders need'} a follow-up` : 'All caught up'}</p>
          </div>
          <div className="rounded-xl border border-dashboard-border p-3 sm:p-4 bg-dashboard-card">
            <p className="text-[11px] sm:text-xs text-text-muted">Waiting in total</p>
            <p className="text-lg sm:text-2xl font-bold tabular-nums mt-0.5 text-accent-green">{rupees(summary.totalAmount)}</p>
            <p className="text-[10.5px] sm:text-xs text-text-muted">{summary.totalCount} {summary.totalCount === 1 ? 'refund' : 'refunds'} pending</p>
          </div>
          <div className="col-span-2 lg:col-span-1 rounded-xl border border-dashboard-border p-3 sm:p-4 bg-dashboard-card flex lg:block items-center justify-between gap-2">
            <p className="text-[11px] sm:text-xs text-text-muted">Longest wait</p>
            <p className="text-sm lg:text-2xl font-bold text-text-primary mt-0.5">{summary.oldestWait != null ? workingDaysLabel(summary.oldestWait) : '—'}</p>
            <p className="hidden lg:block text-xs text-text-muted">since the refund form was filled</p>
          </div>
        </div>

        {/* View + grouping */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-dashboard-card border border-dashboard-border sm:flex-1" role="tablist" aria-label="Which follow-ups">
            {viewTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={view === t.id}
                onClick={() => setView(t.id)}
                className={`py-2 rounded-lg text-sm transition ${view === t.id ? 'bg-accent-blue text-white font-semibold' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {t.label} <span className={`tabular-nums ${view === t.id ? 'text-white/80' : 'text-text-muted'}`}>{t.count}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-dashboard-card border border-dashboard-border sm:w-72" role="tablist" aria-label="Show as">
            {(['order', 'mediator'] as GroupBy[]).map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={groupBy === g}
                onClick={() => setGroupBy(g)}
                className={`py-2 rounded-lg text-sm transition ${groupBy === g ? 'bg-dashboard-bg text-text-primary font-semibold shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {g === 'order' ? 'By order' : 'By mediator'}
              </button>
            ))}
          </div>
        </div>

        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order ID, product, mediator, reviewer…"
            aria-label="Search follow-ups"
            className="w-full min-w-0 sm:flex-1 bg-dashboard-card border border-dashboard-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent-blue outline-none"
          />
          {groupBy === 'order' && (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as FollowUpSort)}
              aria-label="Sort"
              className="w-full sm:w-48 bg-dashboard-card border border-dashboard-border rounded-lg px-3 py-2.5 text-sm text-text-secondary focus:ring-2 focus:ring-accent-blue outline-none"
            >
              <option value="overdue">Most overdue first</option>
              <option value="amount">Biggest refund first</option>
              <option value="mediator">By mediator name</option>
            </select>
          )}
        </div>

        {/* Filters: only what is on screen, with counts */}
        {inScope.length > 0 && (
          <div className="space-y-2 min-w-0">
            {medChips.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:thin]" aria-label="Filter by mediator">
                <button type="button" aria-pressed={activeMediator === 'all'} onClick={() => setMediatorFilter('all')} className={chipCls(activeMediator === 'all')}>All mediators</button>
                {medChips.map((c) => (
                  <button key={c.key} type="button" aria-pressed={activeMediator === c.key} onClick={() => setMediatorFilter(c.key)} className={chipCls(activeMediator === c.key)}>
                    <span className="inline-block max-w-[180px] truncate align-bottom">{c.label}</span> <span className="opacity-70 tabular-nums">{c.count}</span>
                  </button>
                ))}
              </div>
            )}
            {platChips.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:thin]" aria-label="Filter by platform">
                <button type="button" aria-pressed={activePlatform === 'all'} onClick={() => setPlatformFilter('all')} className={chipCls(activePlatform === 'all')}>All platforms</button>
                {platChips.map((c) => (
                  <button key={c.key} type="button" aria-pressed={activePlatform === c.key} onClick={() => setPlatformFilter(c.key)} className={chipCls(activePlatform === c.key)}>
                    {c.label} <span className="opacity-70 tabular-nums">{c.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-text-muted">
          {groupBy === 'order'
            ? `${visible.length} ${visible.length === 1 ? 'follow-up' : 'follow-ups'}`
            : `${groups.length} ${groups.length === 1 ? 'mediator' : 'mediators'} · ${visible.length} ${visible.length === 1 ? 'order' : 'orders'}`}
        </p>

        {visible.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-text-muted text-lg">{search ? 'No follow-ups match your search' : view === 'due' ? 'No follow-ups due' : 'No follow-ups found'}</p>
            <p className="text-text-muted text-sm mt-1">
              {search
                ? 'Try another order ID, product or name.'
                : view === 'due'
                  ? 'You are all caught up. Reminders appear here on their due date.'
                  : 'Reminders are scheduled when an order reaches a refund stage.'}
            </p>
          </div>
        ) : groupBy === 'order' ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {visible.map((o) => (
              <FollowUpCard
                key={o.id}
                order={o}
                today={today}
                phone={phoneFor(o)}
                waitDays={waitDays(o)}
                busy={busyIds.has(o.id)}
                onContacted={(order) => void contacted([order])}
                onMore={(order) => setMoreId(order.id)}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {groups.map((g) => (
              <MediatorCard
                key={g.key}
                group={g}
                today={today}
                score={scores.get(g.key) ?? null}
                onMessage={(grp) => setMessageKey(grp.key)}
                onOpenOrder={(o) => setMoreId(o.id)}
              />
            ))}
          </div>
        )}
      </div>

      {moreOrder && !paidOrder && (
        <MoreSheet
          key={moreOrder.id}
          order={moreOrder}
          today={today}
          onClose={() => setMoreId(null)}
          onSnooze={snooze}
          onStop={stop}
          onGotPaid={(o) => setPaidId(o.id)}
          onUpdateOrder={(o) => {
            setMoreId(null);
            setUpdateId(o.id);
          }}
        />
      )}
      {paidOrder && paidOrder.status !== 'payment_received' && (
        <GotPaidSheet
          key={paidOrder.id}
          order={paidOrder}
          today={today}
          onClose={() => setPaidId(null)}
          onConfirm={async (o, date, bank) => {
            const ok = await paid(o, date, bank);
            if (ok) setMoreId(null);
            return ok;
          }}
        />
      )}
      {messageGroup && (
        <CombinedMessageSheet
          key={messageGroup.key}
          group={messageGroup}
          today={today}
          phone={groupPhone(messageGroup)}
          waitDays={waitDays}
          onClose={() => setMessageKey(null)}
          onMarkContacted={contacted}
        />
      )}
      {updateOrder && <UpdateOrderModal order={updateOrder} onClose={() => setUpdateId(null)} />}
    </div>
  );
}
