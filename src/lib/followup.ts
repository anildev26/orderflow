import { expectedRefund, DEFAULT_REFUND_TIMELINE_DAYS, type Order } from '@/types/order';
import { addWorkingDays, countWorkingDays, ensureWorkingDay, workingDaysLabel } from './workingDays';

// ─── Date helpers (all work in local time, return YYYY-MM-DD) ───

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Add `days` to a YYYY-MM-DD string (or today) and return YYYY-MM-DD. */
export function addDays(base: string | undefined, days: number): string {
  const d = base ? new Date(base + 'T00:00:00') : new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Next Monday relative to today (always in the future). */
export function nextMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diff = ((8 - day) % 7) || 7; // days until the upcoming Monday
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole days between two YYYY-MM-DD dates (a - b). Positive = a is later. */
export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.round((da - db) / (1000 * 60 * 60 * 24));
}

/** How many days a reminder is overdue (>=0 when due/overdue, negative = upcoming). */
export function daysOverdue(nextReminderDate: string): number {
  return daysBetween(todayStr(), nextReminderDate);
}

export function fmtDate(d?: string): string {
  if (!d) return '-';
  return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Snooze presets shown on the Follow-ups page ───

export interface SnoozePreset {
  label: string;
  getDate: () => string;
}

export const SNOOZE_PRESETS: SnoozePreset[] = [
  { label: 'Next working day', getDate: () => addWorkingDays(todayStr(), 1) },
  { label: 'In 2 working days', getDate: () => addWorkingDays(todayStr(), 2) },
  { label: 'In 3 working days', getDate: () => addWorkingDays(todayStr(), 3) },
  { label: 'In 5 working days', getDate: () => addWorkingDays(todayStr(), 5) },
  { label: 'Next Monday', getDate: nextMonday },
  { label: 'In 15 working days', getDate: () => addWorkingDays(todayStr(), 15) },
];

/** Anchor the refund-timeline reminder is measured from, for the order's current status. */
export function timelineAnchor(order: Pick<Order, 'status' | 'refundFormFilledDate' | 'informedMediatorDate' | 'reviewRatingDate'>): string | undefined {
  if (order.status === 'refund_form_filled') return order.refundFormFilledDate || undefined;
  if (order.status === 'informed_mediator') return order.informedMediatorDate || undefined;
  if (order.status === 'review_rating_submitted') return order.reviewRatingDate || undefined;
  return undefined;
}

/**
 * Reminder date to show and to judge due/overdue.
 * Timeline schedules (latest history action "scheduled", or none) are
 * recomputed as working days from the anchor so older calendar-day dates
 * line up with the pending count. Snoozed, contacted, and stopped dates
 * are the user's choice and are returned unchanged.
 */
export function effectiveNextReminderDate(order: Order): string | undefined {
  const stored = order.nextReminderDate;
  if (!stored) return stored;
  if (order.reminderStatus === 'snoozed' || order.reminderStatus === 'stopped' || order.reminderStatus === 'contacted') {
    return stored;
  }
  const history = order.reminderHistory || [];
  const last = history[history.length - 1];
  if (last && last.action !== 'scheduled') return stored;
  const anchor = timelineAnchor(order);
  if (!anchor) return stored;
  const n = order.refundTimelineDays && order.refundTimelineDays > 0
    ? order.refundTimelineDays
    : DEFAULT_REFUND_TIMELINE_DAYS;
  return addWorkingDays(anchor, n);
}

/** Next working day on or after `isoDate`, so a picked reminder never stays on Sat/Sun. */
export function snapReminderDate(isoDate: string): string {
  return ensureWorkingDay(isoDate);
}

// ─── WhatsApp follow-up message ───

const PLATFORM_TITLE: Record<string, string> = {
  flipkart: 'Flipkart', amazon: 'Amazon', meesho: 'Meesho', myntra: 'Myntra',
  jio: 'Jio', blinkit: 'Blinkit', ajio: 'Ajio', shopsy: 'Shopsy', nykaa: 'Nykaa', other: 'Other',
};

/**
 * A self-contained refund follow-up message that can be pasted directly to a
 * mediator or customer without any manual editing. Deliberately different from
 * the generic "Copy for WhatsApp" in the Update Order modal — this one is
 * framed as a polite status request.
 */
export function buildFollowUpMessage(order: Order): string {
  const refundAmount = expectedRefund(order.totalAmount, order.sellerLess, order.commissionAmount);
  const platform = PLATFORM_TITLE[order.platform] || order.platform;
  const filled = order.refundFormFilledDate;
  const sinceFilled = filled ? countWorkingDays(filled, todayStr()) : null;

  const lines: string[] = [
    `🙏 *Refund Follow-up*`,
    ``,
    order.mediatorName ? `Hello ${order.mediatorName},` : `Hello,`,
    `Requesting an update on the refund for the order below.`,
    ``,
    `📦 *Order ID:* ${order.orderId}`,
    `🛒 *Platform:* ${platform}`,
  ];

  if (order.productName) lines.push(`🏷️ *Product:* ${order.productName}`);
  if (order.reviewerName) lines.push(`👤 *Reviewer:* ${order.reviewerName}`);
  lines.push(`🧾 *Order Date:* ${fmtDate(order.orderDate)}`);
  if (filled) lines.push(`📝 *Refund Form Filled:* ${fmtDate(filled)}`);
  if (filled && order.refundTimelineDays && order.refundTimelineDays > 0) {
    const expected = addWorkingDays(filled, order.refundTimelineDays);
    lines.push(`📅 *Expected:* ${fmtDate(expected)} (${workingDaysLabel(order.refundTimelineDays)})`);
  }

  lines.push(
    ``,
    `💰 *Order Amount:* ₹${order.totalAmount.toLocaleString('en-IN')}`,
  );
  if (order.commissionAmount != null) {
    lines.push(`➕ *Commission:* ₹${order.commissionAmount.toLocaleString('en-IN')}`);
  }
  lines.push(
    `💸 *Refund Amount:* ₹${refundAmount.toLocaleString('en-IN')}`,
    ``,
  );

  if (sinceFilled !== null && sinceFilled > 0) {
    lines.push(
      `It has been *${workingDaysLabel(sinceFilled)}* since the refund form was submitted. Could you please share the current refund status? Thank you! 🙏`
    );
  } else {
    lines.push(`Could you please share the current refund status? Thank you! 🙏`);
  }

  return lines.join('\n');
}

