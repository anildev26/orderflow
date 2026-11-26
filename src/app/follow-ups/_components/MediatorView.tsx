'use client';

import { useState } from 'react';
import type { Order } from '@/types/order';
import { workingDaysLabel } from '@/lib/workingDays';
import { NO_MEDIATOR_KEY, refundOf, rupees, type MediatorGroup, type MediatorScore } from '@/lib/followUpBoard';
import { overdueBadge } from './FollowUpCard';
import { btnPrimary } from './ui';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function scoreText(score: MediatorScore | null, key: string): string {
  if (key === NO_MEDIATOR_KEY) return 'Orders saved without a mediator';
  if (!score) return 'Not enough paid orders yet to show a payment pattern';
  return `Usually pays in ${workingDaysLabel(score.typicalDays)} · ${score.onTimeCount} of ${score.paidCount} paid on time`;
}

export function MediatorCard({
  group,
  today,
  score,
  onMessage,
  onOpenOrder,
}: {
  group: MediatorGroup<Order>;
  today: string;
  score: MediatorScore | null;
  onMessage: (group: MediatorGroup<Order>) => void;
  onOpenOrder: (order: Order) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? group.orders : group.orders.slice(0, 4);
  const hidden = group.orders.length - shown.length;
  return (
    <article className="bg-dashboard-card border border-dashboard-border rounded-xl p-3 sm:p-3.5 flex flex-col gap-2.5 min-w-0">
      <div className="flex items-start gap-2.5">
        <span className="w-9 h-9 rounded-full bg-violet-500/15 text-violet-500 grid place-items-center text-xs font-bold flex-shrink-0">{initials(group.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary break-words">{group.name}</p>
          <p className="text-[11px] text-text-muted break-words">{scoreText(score, group.key)}</p>
        </div>
        <span
          className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
            group.dueCount ? 'bg-accent-red/15 text-accent-red' : 'bg-dashboard-bg text-text-muted border border-dashboard-border'
          }`}
        >
          {group.dueCount ? `${group.dueCount} due` : 'nothing due'}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-text-muted">{group.orders.length} {group.orders.length === 1 ? 'order' : 'orders'} waiting</span>
        <span className="text-base font-bold text-accent-green tabular-nums">{rupees(group.totalAmount)}</span>
      </div>

      <ul className="border-t border-dashed border-dashboard-border pt-2 space-y-1">
        {shown.map((o) => {
          const b = overdueBadge(o.nextReminderDate, today);
          return (
            <li key={o.id}>
              <button type="button" onClick={() => onOpenOrder(o)} className="w-full flex items-center justify-between gap-2 text-left text-[11.5px] py-0.5 hover:text-accent-blue">
                <span className="font-mono text-text-secondary min-w-0 break-all">{o.orderId}</span>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="tabular-nums text-text-secondary">{rupees(refundOf(o))}</span>
                  <span className={`text-[10px] px-1.5 py-px rounded-full ${b.cls}`}>{b.tone === 'upcoming' ? b.text : b.tone === 'due' ? 'today' : 'late'}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {(hidden > 0 || expanded) && group.orders.length > 4 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="self-start text-xs text-accent-blue">
          {expanded ? 'Show fewer' : `Show all ${group.orders.length}`}
        </button>
      )}

      <button type="button" onClick={() => onMessage(group)} className={`${btnPrimary} w-full py-2.5`}>
        Choose orders and message {group.key === NO_MEDIATOR_KEY ? '' : group.name.split(' ')[0]}
      </button>
    </article>
  );
}

