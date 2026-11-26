// Pure helpers for the Follow-ups page: money totals, filters that only list what is
// on screen, grouping by mediator (names merged ignoring case and spaces), the
// mediator scorecard, and the combined WhatsApp message.
// No React, no Supabase, no '@/' imports, so it is unit tested with node --test.
// Working-day maths is passed in, so this file stays independent of the calendar code.

import { expectedRefund, type Order } from '../types/order.ts';
import { mediatorNameKey } from './mediators.ts';

export type FollowUpView = 'due' | 'upcoming' | 'all';
export type FollowUpSort = 'overdue' | 'amount' | 'mediator';
export type MessageTone = 'friendly' | 'reminder' | 'firm';

export const NO_MEDIATOR_KEY = '__none__';
export const MAX_ORDERS_PER_MESSAGE = 10;
/** Scorecard is shown only once a mediator has this many paid orders with both dates. */
export const SCORE_MIN_PAID = 3;
/** Default refund timeline in working days, same as DEFAULT_REFUND_TIMELINE_DAYS. */
export const DEFAULT_TIMELINE_DAYS = 60;

type FU = Pick<Order, 'id' | 'orderId' | 'platform' | 'productName' | 'mediatorName' | 'reviewerName' | 'totalAmount' | 'sellerLess' | 'commissionAmount' | 'nextReminderDate' | 'refundFormFilledDate' | 'reminderCount'>;

export const PLATFORM_TITLE: Record<string, string> = {
  flipkart: 'Flipkart', amazon: 'Amazon', meesho: 'Meesho', myntra: 'Myntra',
  jio: 'Jio', blinkit: 'Blinkit', ajio: 'Ajio', shopsy: 'Shopsy', nykaa: 'Nykaa', other: 'Other',
};

export function platformTitle(p: string): string {
  return PLATFORM_TITLE[p] || (p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Other');
}

export function refundOf(o: Pick<Order, 'totalAmount' | 'sellerLess' | 'commissionAmount'>): number {
  return expectedRefund(o.totalAmount || 0, o.sellerLess || 0, o.commissionAmount);
}

export function isDue(o: Pick<Order, 'nextReminderDate'>, today: string): boolean {
  return !!o.nextReminderDate && o.nextReminderDate <= today;
}

export function inView<T extends Pick<Order, 'nextReminderDate'>>(list: readonly T[], view: FollowUpView, today: string): T[] {
  if (view === 'due') return list.filter((o) => isDue(o, today));
  if (view === 'upcoming') return list.filter((o) => !isDue(o, today));
  return [...list];
}

export function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// ───────── Mediator names ─────────

export function mediatorKeyOf(o: Pick<Order, 'mediatorName'>): string {
  return mediatorNameKey(o.mediatorName || '') || NO_MEDIATOR_KEY;
}

function tidyName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/** The spelling used most often for a mediator (ties: the first seen). */
export function preferredName(names: readonly string[]): string {
  const counts = new Map<string, number>();
  let best = '';
  let bestCount = 0;
  for (const raw of names) {
    const n = tidyName(raw || '');
    if (!n) continue;
    const c = (counts.get(n) ?? 0) + 1;
    counts.set(n, c);
    if (c > bestCount) {
      best = n;
      bestCount = c;
    }
  }
  return best || 'No mediator';
}

// ───────── Filters that only list what is on screen ─────────

export interface Chip {
  key: string;
  label: string;
  count: number;
}

export function mediatorChips(list: readonly Pick<Order, 'mediatorName'>[]): Chip[] {
  const groups = new Map<string, string[]>();
  for (const o of list) {
    const k = mediatorKeyOf(o);
    const arr = groups.get(k) ?? [];
    arr.push(o.mediatorName || '');
    groups.set(k, arr);
  }
  return [...groups.entries()]
    .map(([key, names]) => ({ key, label: key === NO_MEDIATOR_KEY ? 'No mediator' : preferredName(names), count: names.length }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function platformChips(list: readonly Pick<Order, 'platform'>[]): Chip[] {
  const counts = new Map<string, number>();
  for (const o of list) counts.set(o.platform || 'other', (counts.get(o.platform || 'other') ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: platformTitle(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function matchesFollowUpSearch(o: Pick<Order, 'orderId' | 'productName' | 'mediatorName' | 'reviewerName'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [o.orderId, o.productName, o.mediatorName, o.reviewerName].some((v) => (v || '').toLowerCase().includes(q));
}

export function sortFollowUps<T extends FU>(list: readonly T[], sort: FollowUpSort): T[] {
  const byDate = (a: T, b: T) => (a.nextReminderDate || '').localeCompare(b.nextReminderDate || '');
  const copy = [...list];
  if (sort === 'amount') return copy.sort((a, b) => refundOf(b) - refundOf(a) || byDate(a, b));
  if (sort === 'mediator') {
    return copy.sort((a, b) => {
      const ka = mediatorKeyOf(a);
      const kb = mediatorKeyOf(b);
      if (ka === kb) return byDate(a, b);
      if (ka === NO_MEDIATOR_KEY) return 1;
      if (kb === NO_MEDIATOR_KEY) return -1;
      return ka.localeCompare(kb);
    });
  }
  return copy.sort(byDate);
}

// ───────── Money summary ─────────

export interface FollowUpSummary {
  dueCount: number;
  dueAmount: number;
  upcomingCount: number;
  totalCount: number;
  totalAmount: number;
  /** Longest wait since the refund form was filled, in working days. */
  oldestWait: number | null;
}

export function summarize(list: readonly FU[], today: string, waitDays: (o: FU) => number | null): FollowUpSummary {
  let dueCount = 0;
  let dueAmount = 0;
  let totalAmount = 0;
  let oldestWait: number | null = null;
  for (const o of list) {
    const amt = refundOf(o);
    totalAmount += amt;
    if (isDue(o, today)) {
      dueCount += 1;
      dueAmount += amt;
    }
    const w = waitDays(o);
    if (w != null && (oldestWait == null || w > oldestWait)) oldestWait = w;
  }
  return { dueCount, dueAmount, upcomingCount: list.length - dueCount, totalCount: list.length, totalAmount, oldestWait };
}

// ───────── Group by mediator ─────────

export interface MediatorGroup<T extends FU = FU> {
  key: string;
  name: string;
  orders: T[];
  dueCount: number;
  dueAmount: number;
  totalAmount: number;
}

export function groupByMediator<T extends FU>(list: readonly T[], today: string): MediatorGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const o of list) {
    const k = mediatorKeyOf(o);
    const arr = map.get(k) ?? [];
    arr.push(o);
    map.set(k, arr);
  }
  const groups: MediatorGroup<T>[] = [];
  for (const [key, orders] of map) {
    const sorted = sortFollowUps(orders, 'overdue');
    let dueCount = 0;
    let dueAmount = 0;
    let totalAmount = 0;
    for (const o of sorted) {
      const amt = refundOf(o);
      totalAmount += amt;
      if (isDue(o, today)) {
        dueCount += 1;
        dueAmount += amt;
      }
    }
    groups.push({
      key,
      name: key === NO_MEDIATOR_KEY ? 'No mediator' : preferredName(sorted.map((o) => o.mediatorName || '')),
      orders: sorted,
      dueCount,
      dueAmount,
      totalAmount,
    });
  }
  return groups.sort((a, b) => {
    if (a.key === NO_MEDIATOR_KEY) return 1;
    if (b.key === NO_MEDIATOR_KEY) return -1;
    return b.dueAmount - a.dueAmount || b.totalAmount - a.totalAmount || a.name.localeCompare(b.name);
  });
}

// ───────── Mediator scorecard ─────────

export interface MediatorScore {
  paidCount: number;
  /** Median working days from refund form filled to payment received. */
  typicalDays: number;
  /** Paid within the order's refund timeline. */
  onTimeCount: number;
}

export function mediatorScore(
  allOrders: readonly Pick<Order, 'status' | 'mediatorName' | 'refundFormFilledDate' | 'paymentReceivedDate' | 'refundTimelineDays'>[],
  key: string,
  workingDaysBetween: (from: string, to: string) => number,
): MediatorScore | null {
  if (key === NO_MEDIATOR_KEY) return null;
  const days: number[] = [];
  let onTime = 0;
  for (const o of allOrders) {
    if (o.status !== 'payment_received' || mediatorKeyOf(o) !== key) continue;
    const from = o.refundFormFilledDate;
    const to = o.paymentReceivedDate;
    if (!from || !to || to < from) continue;
    const d = Math.max(0, workingDaysBetween(from, to));
    days.push(d);
    const limit = o.refundTimelineDays && o.refundTimelineDays > 0 ? o.refundTimelineDays : DEFAULT_TIMELINE_DAYS;
    if (d <= limit) onTime += 1;
  }
  if (days.length < SCORE_MIN_PAID) return null;
  days.sort((a, b) => a - b);
  const mid = Math.floor(days.length / 2);
  const median = days.length % 2 ? days[mid] : Math.round((days[mid - 1] + days[mid]) / 2);
  return { paidCount: days.length, typicalDays: median, onTimeCount: onTime };
}

// ───────── Combined WhatsApp message ─────────

/** Tone follows how many times these orders were already chased. */
export function toneFor(orders: readonly Pick<Order, 'reminderCount'>[]): MessageTone {
  const most = orders.reduce((m, o) => Math.max(m, o.reminderCount || 0), 0);
  if (most >= 2) return 'firm';
  if (most === 1) return 'reminder';
  return 'friendly';
}

export const TONE_LABEL: Record<MessageTone, string> = { friendly: 'Friendly', reminder: 'Reminder', firm: 'Firm' };

export function buildMediatorMessage(
  mediatorName: string,
  orders: readonly FU[],
  tone: MessageTone,
  ctx: { fmtDate: (iso: string) => string; waitDays: (o: FU) => number | null; daysLabel: (n: number) => string },
): string {
  const list = orders.slice(0, MAX_ORDERS_PER_MESSAGE);
  const n = list.length;
  const one = n === 1;
  const hello = mediatorName && mediatorName !== 'No mediator' ? `Hello ${mediatorName},` : 'Hello,';
  const header =
    tone === 'firm' ? '⚠️ *Refund pending: action needed*' : tone === 'reminder' ? '🔔 *Refund reminder*' : '🙏 *Refund follow-up*';
  const intro =
    tone === 'firm'
      ? one
        ? 'This refund is now overdue. I have followed up before and have not received it yet:'
        : `These ${n} refunds are now overdue. I have followed up before and have not received them yet:`
      : tone === 'reminder'
        ? one
          ? 'Following up again on this refund, which is still pending:'
          : `Following up again on these ${n} refunds, which are still pending:`
        : one
          ? 'Requesting an update on the refund for this order:'
          : `Requesting an update on these ${n} refunds:`;
  const closing =
    tone === 'firm'
      ? 'Please confirm when the payment will be made. Thank you.'
      : tone === 'reminder'
        ? 'Please share an update when you can. Thank you 🙏'
        : 'Could you please share the status? Thank you 🙏';

  const lines: string[] = [header, '', hello, intro, ''];
  let total = 0;
  list.forEach((o, i) => {
    const amt = refundOf(o);
    total += amt;
    const prefix = one ? '' : `${i + 1}. `;
    const indent = one ? '' : '   ';
    lines.push(`${prefix}${platformTitle(o.platform)} · ${o.orderId}`);
    const parts = [rupees(amt)];
    if (o.productName) parts.unshift(o.productName);
    if (o.refundFormFilledDate) {
      const w = ctx.waitDays(o);
      parts.push(`form filled ${ctx.fmtDate(o.refundFormFilledDate)}${w != null && w > 0 ? ` (${ctx.daysLabel(w)})` : ''}`);
    }
    lines.push(`${indent}${parts.join(' · ')}`);
  });
  lines.push('', one ? `💰 *Refund amount: ${rupees(total)}*` : `💰 *Total pending: ${rupees(total)}*`, closing);
  return lines.join('\n');
}
