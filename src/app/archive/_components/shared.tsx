'use client';

import type { Order } from '@/types/order';
import { archiveDateOf, daysToPay, isPaid, plannedRefundOf, receivedOf } from '@/lib/archive';
import { platformTitle, rupees } from '@/lib/followUpBoard';
import { PlatformBadge } from '@/app/follow-ups/_components/FollowUpCard';

export { PlatformBadge, platformTitle, rupees };

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "22 Nov" in the current year, "22 Nov 2025" otherwise. */
export function shortDate(d: string | undefined | null, today: string): string {
  if (!d || d.length < 10) return '-';
  const [y, m, dd] = d.slice(0, 10).split('-');
  const base = `${dd} ${MONTHS_SHORT[Number(m) - 1] || ''}`;
  return y === today.slice(0, 4) ? base : `${base} ${y}`;
}

/** Wraps the first match of `query` in a highlight. Plain text when there is no match. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q || !text) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-accent-yellow/30 text-inherit rounded-sm">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/** One line under the card: when it was paid or cancelled, and how. */
export function archiveLine(o: Order, today: string): string {
  const date = shortDate(archiveDateOf(o), today);
  if (!isPaid(o)) return `Cancelled ${date} · was ${rupees(plannedRefundOf(o))}`;
  const parts = [`Paid ${date}`];
  if (o.paymentBank) parts.push(o.paymentBank);
  const d = daysToPay(o);
  if (d != null) parts.push(`${d} day${d === 1 ? '' : 's'} after form`);
  return parts.join(' · ');
}

export function StatusPill({ order }: { order: Pick<Order, 'status'> }) {
  return isPaid(order) ? (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-green/15 text-accent-green whitespace-nowrap">Paid</span>
  ) : (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-red/15 text-accent-red whitespace-nowrap">Cancelled</span>
  );
}

export function Amount({ order }: { order: Order }) {
  return isPaid(order) ? (
    <span className="text-sm font-bold text-accent-green tabular-nums whitespace-nowrap">{rupees(receivedOf(order))}</span>
  ) : (
    <span className="text-sm font-bold text-text-muted tabular-nums whitespace-nowrap">₹0</span>
  );
}

export const chipBase = 'flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-semibold transition whitespace-nowrap';
export const chipOn = `${chipBase} bg-accent-blue/15 border-accent-blue text-accent-blue`;
export const chipOff = `${chipBase} bg-dashboard-card border-dashboard-border text-text-secondary hover:text-text-primary hover:border-accent-blue/40`;
