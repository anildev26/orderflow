'use client';

import { useMemo, useState } from 'react';
import type { Order } from '@/types/order';
import { groupByMonth, monthLabel, receivedOf, yearSummary, yearsOf } from '@/lib/archive';
import { rupees, shortDate } from './shared';

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const ORDERS_PREVIEW = 8;

export default function MonthlyView({
  orders,
  today,
  filtered,
  onOpenOrder,
  onClearFilters,
}: {
  /** Archived orders after search and filters. Cancelled orders are dropped here. */
  orders: Order[];
  today: string;
  filtered: boolean;
  onOpenOrder: (o: Order) => void;
  onClearFilters: () => void;
}) {
  const groups = useMemo(() => groupByMonth(orders), [orders]);
  const years = useMemo(() => yearsOf(groups), [groups]);
  const [year, setYear] = useState(() => today.slice(0, 4));
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<Set<string>>(new Set());

  // Search and filters can leave the chosen year empty; show the newest year that has orders.
  const activeYear = years.includes(year) ? year : years[0] ?? today.slice(0, 4);

  const summary = useMemo(() => yearSummary(groups, activeYear), [groups, activeYear]);
  const monthGroups = useMemo(() => groups.filter((g) => g.key.startsWith(activeYear + '-')), [groups, activeYear]);
  const max = Math.max(1, ...summary.months.map((m) => m.total));
  const yi = years.indexOf(activeYear);
  const older = yi >= 0 && yi < years.length - 1 ? years[yi + 1] : null;
  const newer = yi > 0 ? years[yi - 1] : null;

  const openMonth = (key: string) => {
    setOpenKey((k) => (k === key ? null : key));
    window.setTimeout(() => document.getElementById(`month-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
  };

  if (groups.length === 0) {
    return (
      <div className="text-center py-14 px-4">
        <p className="text-text-primary font-semibold">{filtered ? 'No paid orders match' : 'No paid orders yet'}</p>
        <p className="text-sm text-text-muted mt-1">
          {filtered ? 'Try a different search or clear the filters.' : 'When you mark an order as paid, its refund is counted here under the month you got paid.'}
        </p>
        {filtered && (
          <button type="button" onClick={onClearFilters} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-accent-blue text-white">
            Clear search and filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filtered && <p className="text-xs text-accent-blue">Showing only orders that match your search and filters.</p>}

      <div className="flex items-center justify-between gap-2 rounded-xl border border-dashboard-border bg-dashboard-card px-2 py-1.5">
        <button
          type="button"
          onClick={() => older && setYear(older)}
          disabled={!older}
          aria-label="Previous year"
          className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-text-secondary hover:bg-dashboard-bg disabled:opacity-30"
        >
          ‹
        </button>
        <span className="text-base font-bold text-text-primary tabular-nums">{activeYear}</span>
        <button
          type="button"
          onClick={() => newer && setYear(newer)}
          disabled={!newer}
          aria-label="Next year"
          className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-text-secondary hover:bg-dashboard-bg disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="rounded-xl border border-dashboard-border bg-dashboard-card p-3.5 space-y-3">
        <div className="min-w-0">
          <p className="text-xs text-text-muted">Refund received in {activeYear}</p>
          <p className="text-2xl font-bold text-accent-green tabular-nums">{rupees(summary.total)}</p>
          <p className="text-xs text-text-secondary mt-0.5">
            {summary.count} order{summary.count === 1 ? '' : 's'} paid
            {summary.avgDays != null && ` · avg ${summary.avgDays} days after the form`}
          </p>
        </div>
        <div className="grid grid-cols-12 gap-1 items-end h-14" aria-hidden="true">
          {summary.months.map((m) => (
            <button
              key={m.key}
              type="button"
              tabIndex={-1}
              disabled={m.count === 0}
              onClick={() => openMonth(m.key)}
              title={`${monthLabel(m.key)}: ${rupees(m.total)}`}
              className={`rounded-t ${m.count === 0 ? 'bg-dashboard-border/50' : openKey === m.key ? 'bg-accent-green' : 'bg-accent-green/50 hover:bg-accent-green/80'}`}
              style={{ height: m.count === 0 ? 3 : `${Math.max(8, Math.round((m.total / max) * 100))}%` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-1 text-[10px] text-text-muted text-center -mt-1" aria-hidden="true">
          {MONTH_LETTERS.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      </div>

      {monthGroups.map((g) => {
        const open = openKey === g.key;
        const all = showAll.has(g.key);
        const list = all ? g.orders : g.orders.slice(0, ORDERS_PREVIEW);
        return (
          <section key={g.key} id={`month-${g.key}`} className={`rounded-xl border bg-dashboard-card transition ${open ? 'border-accent-blue' : 'border-dashboard-border'}`}>
            <button
              type="button"
              onClick={() => openMonth(g.key)}
              aria-expanded={open}
              className="w-full text-left p-3.5 flex flex-col gap-1.5"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-bold text-text-primary">{monthLabel(g.key, false)}</span>
                <span className="text-sm font-bold text-accent-green tabular-nums">{rupees(g.total)}</span>
              </span>
              <span className="flex items-center justify-between gap-3 text-xs text-text-muted">
                <span>
                  {g.count} order{g.count === 1 ? '' : 's'} paid
                  {g.avgDays != null && ` · avg ${g.avgDays} days`}
                </span>
                <span aria-hidden="true">{open ? '▴' : '▾'}</span>
              </span>
              <span className="block h-1.5 rounded bg-dashboard-bg overflow-hidden" aria-hidden="true">
                <span className="block h-full bg-accent-green" style={{ width: `${Math.round((g.total / max) * 100)}%` }} />
              </span>
            </button>

            {open && (
              <div className="px-3.5 pb-3.5 space-y-3 border-t border-dashboard-border pt-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1.5">By bank</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.byBank.map((b) => (
                      <span key={b.key} className="text-xs px-2 py-1 rounded-md bg-dashboard-bg text-text-secondary break-words max-w-full">
                        {b.name} <span className="font-semibold text-text-primary tabular-nums">{rupees(b.total)}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mb-1">Orders</p>
                  <ul className="divide-y divide-dashboard-border">
                    {list.map((o) => (
                      <li key={o.id}>
                        <button type="button" onClick={() => onOpenOrder(o)} className="w-full text-left py-2 flex items-start justify-between gap-3 hover:bg-dashboard-card-hover rounded">
                          <span className="min-w-0 flex flex-col">
                            <span className="font-mono text-xs font-semibold text-text-primary break-all">{o.orderId}</span>
                            <span className="text-xs text-text-muted break-words">
                              {o.productName ? `${o.productName} · ` : ''}
                              {shortDate(o.paymentReceivedDate, today)}
                            </span>
                          </span>
                          <span className="text-sm font-bold text-accent-green tabular-nums whitespace-nowrap">{rupees(receivedOf(o))}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {g.orders.length > ORDERS_PREVIEW && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowAll((s) => {
                          const next = new Set(s);
                          if (all) next.delete(g.key);
                          else next.add(g.key);
                          return next;
                        })
                      }
                      className="w-full mt-1 py-2 text-xs font-semibold text-accent-blue"
                    >
                      {all ? 'Show fewer' : `Show all ${g.orders.length} orders`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
