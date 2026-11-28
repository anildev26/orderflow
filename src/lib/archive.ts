// Pure helpers for the Archive page: which date an archived order belongs to,
// refund totals (cancelled orders always count ₹0), search, filters, name
// suggestions, monthly grouping, and what "Reopen" puts back.
// No React, no Supabase, no '@/' imports, so it is unit tested with node --test.

import { expectedRefund, type Order, type OrderStatus, type ReminderStatus } from '../types/order.ts';
import { mediatorNameKey } from './mediators.ts';

export type ArchiveStatusFilter = 'all' | 'paid' | 'cancelled';
export type ArchiveRange = 'any' | 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'custom';
export type ArchiveSort = 'newest' | 'oldest' | 'highest' | 'slowest';

export interface ArchiveFilters {
  status: ArchiveStatusFilter;
  range: ArchiveRange;
  from: string; // YYYY-MM-DD, used when range is 'custom'
  to: string;
  platforms: string[];
  mediator: string; // name key, '' = any
  reviewer: string; // name key, '' = any
  banks: string[]; // bank keys; NO_BANK_KEY = orders with no bank saved
  sort: ArchiveSort;
}

export const DEFAULT_FILTERS: ArchiveFilters = {
  status: 'all',
  range: 'any',
  from: '',
  to: '',
  platforms: [],
  mediator: '',
  reviewer: '',
  banks: [],
  sort: 'newest',
};

export const NO_BANK_KEY = '__none__';
export const PAGE_SIZE = 30;

/** Statuses an order can go back to when reopened (everything before archive). */
export const REOPENABLE_STATUSES: OrderStatus[] = [
  'ordered',
  'delivered',
  'review_rating_submitted',
  'refund_form_pending',
  'refund_form_filled',
  'informed_mediator',
];

type A = Pick<
  Order,
  | 'id'
  | 'orderId'
  | 'status'
  | 'platform'
  | 'productName'
  | 'brandName'
  | 'mediatorName'
  | 'reviewerName'
  | 'paymentBank'
  | 'replacementOrderId'
  | 'totalAmount'
  | 'sellerLess'
  | 'commissionAmount'
  | 'orderDate'
  | 'paymentReceivedDate'
  | 'refundFormFilledDate'
  | 'archivedAt'
  | 'updatedAt'
>;

export function isArchived(o: Pick<Order, 'status'>): boolean {
  return o.status === 'payment_received' || o.status === 'order_cancelled';
}

export function isPaid(o: Pick<Order, 'status'>): boolean {
  return o.status === 'payment_received';
}

/** Refund this order brought in. Cancelled orders bring in nothing. */
export function receivedOf(o: Pick<Order, 'status' | 'totalAmount' | 'sellerLess' | 'commissionAmount'>): number {
  if (!isPaid(o)) return 0;
  return expectedRefund(o.totalAmount || 0, o.sellerLess || 0, o.commissionAmount);
}

/** Refund the order would have brought in (shown as "was ₹…" on cancelled cards). */
export function plannedRefundOf(o: Pick<Order, 'totalAmount' | 'sellerLess' | 'commissionAmount'>): number {
  return expectedRefund(o.totalAmount || 0, o.sellerLess || 0, o.commissionAmount);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function day(s: string | null | undefined): string {
  if (!s) return '';
  const d = s.slice(0, 10);
  return DATE_RE.test(d) ? d : '';
}

/**
 * The date the order belongs to in Archive: the day it was paid, or the day it
 * was cancelled. Older orders without a saved archive date fall back to the
 * last time the order changed.
 */
export function archiveDateOf(o: Pick<Order, 'status' | 'paymentReceivedDate' | 'archivedAt' | 'updatedAt' | 'orderDate'>): string {
  if (isPaid(o)) return day(o.paymentReceivedDate) || day(o.archivedAt) || day(o.updatedAt) || day(o.orderDate);
  return day(o.archivedAt) || day(o.updatedAt) || day(o.orderDate);
}

function dayNumber(d: string): number {
  const [y, m, dd] = d.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, dd) / 86400000);
}

/** Days from filling the refund form to getting paid. null when either date is missing. */
export function daysToPay(o: Pick<Order, 'status' | 'refundFormFilledDate' | 'paymentReceivedDate'>): number | null {
  if (!isPaid(o)) return null;
  const from = day(o.refundFormFilledDate);
  const to = day(o.paymentReceivedDate);
  if (!from || !to) return null;
  const n = dayNumber(to) - dayNumber(from);
  return n >= 0 ? n : null;
}

// ───────── Search ─────────

function compact(s: string): string {
  return s.toLowerCase().replace(/[\s\-_/]+/g, '');
}

/** One box: order ID (spaces and dashes ignored), product, brand, mediator, reviewer, bank. */
export function matchesArchiveSearch(o: A, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const qc = compact(q);
  const ids = [o.orderId, o.replacementOrderId || ''];
  if (qc && ids.some((id) => compact(id).includes(qc))) return true;
  const fields = [o.productName, o.brandName, o.mediatorName, o.reviewerName, o.paymentBank || ''];
  return fields.some((f) => (f || '').toLowerCase().includes(q));
}

// ───────── Names, banks, platforms ─────────

export function reviewerKey(name: string): string {
  return (name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function bankKey(bank: string | undefined | null): string {
  const k = (bank || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return k || NO_BANK_KEY;
}

export interface NameOption {
  key: string;
  name: string;
  count: number;
}

/** Distinct names on these orders, most used first; the most common spelling is shown. */
export function nameOptions(orders: A[], field: 'mediator' | 'reviewer'): NameOption[] {
  const map = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const o of orders) {
    const raw = (field === 'mediator' ? o.mediatorName : o.reviewerName) || '';
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const key = field === 'mediator' ? mediatorNameKey(name) : reviewerKey(name);
    if (!key) continue;
    const e = map.get(key) ?? { count: 0, spellings: new Map() };
    e.count++;
    e.spellings.set(name, (e.spellings.get(name) || 0) + 1);
    map.set(key, e);
  }
  return [...map.entries()]
    .map(([key, e]) => {
      const name = [...e.spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
      return { key, name, count: e.count };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Suggestions for the type-to-pick boxes: names that start with the text first, then names that contain it. */
export function suggestNames(options: NameOption[], text: string, limit = 6): NameOption[] {
  const q = text.trim().toLowerCase();
  if (!q) return options.slice(0, limit);
  const starts: NameOption[] = [];
  const contains: NameOption[] = [];
  for (const o of options) {
    const n = o.name.toLowerCase();
    if (n.startsWith(q) || n.split(' ').some((w) => w.startsWith(q))) starts.push(o);
    else if (n.includes(q)) contains.push(o);
  }
  return [...starts, ...contains].slice(0, limit);
}

export interface BankOption {
  key: string;
  name: string;
  count: number;
}

export function bankOptions(orders: A[]): BankOption[] {
  const map = new Map<string, BankOption>();
  for (const o of orders) {
    if (!isPaid(o)) continue;
    const key = bankKey(o.paymentBank);
    const e = map.get(key);
    if (e) e.count++;
    else map.set(key, { key, name: key === NO_BANK_KEY ? 'No bank saved' : (o.paymentBank || '').trim(), count: 1 });
  }
  return [...map.values()].sort((a, b) => {
    if (a.key === NO_BANK_KEY) return 1;
    if (b.key === NO_BANK_KEY) return -1;
    return b.count - a.count || a.name.localeCompare(b.name);
  });
}

export function platformOptions(orders: A[]): string[] {
  const counts = new Map<string, number>();
  for (const o of orders) counts.set(o.platform, (counts.get(o.platform) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p]) => p);
}

// ───────── Filters ─────────

function monthStart(today: string, back: number): string {
  const [y, m] = today.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - back, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function monthEnd(today: string, back: number): string {
  const [y, m] = today.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - back, 0));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Inclusive date bounds for a range; empty strings mean open-ended. */
export function rangeBounds(f: Pick<ArchiveFilters, 'range' | 'from' | 'to'>, today: string): { from: string; to: string } {
  switch (f.range) {
    case 'this_month':
      return { from: monthStart(today, 0), to: monthEnd(today, 0) };
    case 'last_month':
      return { from: monthStart(today, 1), to: monthEnd(today, 1) };
    case 'last_3_months':
      return { from: monthStart(today, 2), to: monthEnd(today, 0) };
    case 'this_year':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case 'custom': {
      const from = day(f.from);
      const to = day(f.to);
      return from && to && from > to ? { from: to, to: from } : { from, to };
    }
    default:
      return { from: '', to: '' };
  }
}

/** Every filter except status, so the status chips can show counts. */
export function matchesArchiveFilters(o: A, f: ArchiveFilters, today: string): boolean {
  const { from, to } = rangeBounds(f, today);
  if (from || to) {
    const d = archiveDateOf(o);
    if (from && d < from) return false;
    if (to && d > to) return false;
  }
  if (f.platforms.length && !f.platforms.includes(o.platform)) return false;
  if (f.mediator && mediatorNameKey(o.mediatorName || '') !== f.mediator) return false;
  if (f.reviewer && reviewerKey(o.reviewerName || '') !== f.reviewer) return false;
  if (f.banks.length) {
    if (!isPaid(o)) return false;
    if (!f.banks.includes(bankKey(o.paymentBank))) return false;
  }
  return true;
}

export function matchesStatus(o: Pick<Order, 'status'>, s: ArchiveStatusFilter): boolean {
  if (s === 'paid') return o.status === 'payment_received';
  if (s === 'cancelled') return o.status === 'order_cancelled';
  return isArchived(o);
}

/** How many filters in the sheet are set (status and sort are not counted). */
export function activeFilterCount(f: ArchiveFilters): number {
  let n = 0;
  if (f.range !== 'any' && (f.range !== 'custom' || f.from || f.to)) n++;
  if (f.platforms.length) n++;
  if (f.mediator) n++;
  if (f.reviewer) n++;
  if (f.banks.length) n++;
  return n;
}

export function sortArchived<T extends A>(orders: T[], sort: ArchiveSort): T[] {
  const withDate = orders.map((o) => ({ o, d: archiveDateOf(o) }));
  const newest = (a: { o: T; d: string }, b: { o: T; d: string }) =>
    a.d < b.d ? 1 : a.d > b.d ? -1 : a.o.orderDate < b.o.orderDate ? 1 : a.o.orderDate > b.o.orderDate ? -1 : a.o.id.localeCompare(b.o.id);
  if (sort === 'oldest') withDate.sort((a, b) => -newest(a, b));
  else if (sort === 'highest') withDate.sort((a, b) => receivedOf(b.o) - receivedOf(a.o) || newest(a, b));
  else if (sort === 'slowest') {
    withDate.sort((a, b) => {
      const da = daysToPay(a.o);
      const db = daysToPay(b.o);
      if (da == null && db == null) return newest(a, b);
      if (da == null) return 1;
      if (db == null) return -1;
      return db - da || newest(a, b);
    });
  } else withDate.sort(newest);
  return withDate.map((x) => x.o);
}

export interface ArchiveTotals {
  received: number;
  paid: number;
  cancelled: number;
}

export function totalsOf(orders: A[]): ArchiveTotals {
  let received = 0;
  let paid = 0;
  let cancelled = 0;
  for (const o of orders) {
    if (o.status === 'payment_received') {
      paid++;
      received += receivedOf(o);
    } else if (o.status === 'order_cancelled') cancelled++;
  }
  return { received, paid, cancelled };
}

// ───────── Monthly ─────────

export interface BankShare {
  key: string;
  name: string;
  total: number;
}

export interface MonthGroup<T> {
  key: string; // YYYY-MM
  total: number;
  count: number;
  avgDays: number | null;
  byBank: BankShare[];
  orders: T[]; // newest paid first
}

/** Paid orders grouped by the month they were paid, newest month first. Cancelled orders are left out. */
export function groupByMonth<T extends A>(orders: T[]): MonthGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const o of orders) {
    if (!isPaid(o)) continue;
    const d = archiveDateOf(o);
    if (!d) continue;
    const key = d.slice(0, 7);
    const list = map.get(key);
    if (list) list.push(o);
    else map.set(key, [o]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => {
      let total = 0;
      let daysSum = 0;
      let daysN = 0;
      const banks = new Map<string, BankShare>();
      for (const o of list) {
        const amt = receivedOf(o);
        total += amt;
        const dd = daysToPay(o);
        if (dd != null) {
          daysSum += dd;
          daysN++;
        }
        const bk = bankKey(o.paymentBank);
        const b = banks.get(bk);
        if (b) b.total += amt;
        else banks.set(bk, { key: bk, name: bk === NO_BANK_KEY ? 'No bank saved' : (o.paymentBank || '').trim(), total: amt });
      }
      const byBank = [...banks.values()].sort((a, b) => {
        if (a.key === NO_BANK_KEY) return 1;
        if (b.key === NO_BANK_KEY) return -1;
        return b.total - a.total || a.name.localeCompare(b.name);
      });
      return {
        key,
        total,
        count: list.length,
        avgDays: daysN ? Math.round(daysSum / daysN) : null,
        byBank,
        orders: sortArchived(list, 'newest'),
      };
    });
}

export interface YearSummary {
  year: string;
  total: number;
  count: number;
  avgDays: number | null;
  months: { key: string; total: number; count: number }[]; // always 12, January first
}

export function yearsOf(groups: MonthGroup<unknown>[]): string[] {
  return [...new Set(groups.map((g) => g.key.slice(0, 4)))].sort().reverse();
}

export function yearSummary<T extends A>(groups: MonthGroup<T>[], year: string): YearSummary {
  const months = Array.from({ length: 12 }, (_, i) => ({ key: `${year}-${String(i + 1).padStart(2, '0')}`, total: 0, count: 0 }));
  let total = 0;
  let count = 0;
  let daysSum = 0;
  let daysN = 0;
  for (const g of groups) {
    if (!g.key.startsWith(year + '-')) continue;
    const m = months[Number(g.key.slice(5, 7)) - 1];
    if (!m) continue;
    m.total = g.total;
    m.count = g.count;
    total += g.total;
    count += g.count;
    for (const o of g.orders) {
      const dd = daysToPay(o);
      if (dd != null) {
        daysSum += dd;
        daysN++;
      }
    }
  }
  return { year, total, count, avgDays: daysN ? Math.round(daysSum / daysN) : null, months };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function monthLabel(key: string, withYear = true): string {
  const name = MONTHS[Number(key.slice(5, 7)) - 1] || key;
  return withYear ? `${name} ${key.slice(0, 4)}` : name;
}

// ───────── Reopen ─────────

/**
 * The status to put the order back to. Uses the status saved when it was
 * archived; for orders archived before that was saved, the furthest step its
 * dates show.
 */
export function previousStatusOf(
  o: Pick<Order, 'archivedFromStatus' | 'informedMediatorDate' | 'refundFormFilledDate' | 'reviewRatingDate' | 'deliveredDate'>,
): OrderStatus {
  if (o.archivedFromStatus && REOPENABLE_STATUSES.includes(o.archivedFromStatus)) return o.archivedFromStatus;
  if (o.informedMediatorDate) return 'informed_mediator';
  if (o.refundFormFilledDate) return 'refund_form_filled';
  if (o.reviewRatingDate) return 'review_rating_submitted';
  if (o.deliveredDate) return 'delivered';
  return 'ordered';
}

export const PAID_STOP_NOTE = 'Payment received';

/**
 * Reminder fields after reopening: if archiving stopped the reminder, bring it
 * back as it was (the stop entry Got paid adds is removed). A reminder the user
 * stopped by hand before archiving stays stopped.
 */
export function reopenedReminder(
  o: Pick<Order, 'reminderStatus' | 'reminderHistory' | 'nextReminderDate'>,
): { reminderStatus?: ReminderStatus; reminderHistory?: Order['reminderHistory'] } {
  if (o.reminderStatus !== 'stopped' || !o.nextReminderDate) return {};
  const history = [...(o.reminderHistory || [])];
  const last = history[history.length - 1];
  let changedHistory = false;
  if (last && last.action === 'stopped' && last.note === PAID_STOP_NOTE) {
    history.pop();
    changedHistory = true;
  }
  const before = history[history.length - 1];
  if (before && before.action === 'stopped') return changedHistory ? { reminderHistory: history } : {};
  const status: ReminderStatus = before?.action === 'snoozed' ? 'snoozed' : before?.action === 'contacted' ? 'contacted' : 'scheduled';
  return changedHistory ? { reminderStatus: status, reminderHistory: history } : { reminderStatus: status };
}
