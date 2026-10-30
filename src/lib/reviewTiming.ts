import type { Order } from '@/types/order';
import { addDays } from './followup';
import { getReturnWindow } from './returnWindow';

/** Days after delivery when an early rating/review reminder can fire. */
export const REVIEW_AFTER_DAY_OPTIONS = [1, 3, 7] as const;

export type ReviewAfterDays = (typeof REVIEW_AFTER_DAY_OPTIONS)[number];

export function isReviewAfterDays(value: number | null | undefined): value is ReviewAfterDays {
  return value === 1 || value === 3 || value === 7;
}

/**
 * Local calendar date the reminder begins, or null for "after the return period".
 * The N days after delivery are not themselves the due day: those days pass
 * first, and the reminder is the next calendar day (delivered + N + 1).
 * Delivered 26 Oct with 3 days → 27, 28 and 29 pass → due 30 Oct.
 */
export function reviewDueDate(
  order: Pick<Order, 'deliveredDate' | 'reviewAfterDays'>
): string | null {
  if (!order.deliveredDate || !isReviewAfterDays(order.reviewAfterDays)) return null;
  return addDays(order.deliveredDate, order.reviewAfterDays + 1);
}

/**
 * True while a Delivered order's early review reminder has arrived and the
 * return window is still open. The refund-pending transition is separate and
 * still owns what happens once that window closes.
 */
export function isReviewRatingDue(
  order: Pick<Order, 'status' | 'deliveredDate' | 'returnPeriodDays' | 'reviewAfterDays'>,
  today: string
): boolean {
  if (order.status !== 'delivered') return false;
  const due = reviewDueDate(order);
  if (!due || today < due) return false;
  const window = getReturnWindow(order, today);
  return window !== null && window.daysLeft > 0;
}

export function reviewTimingLabel(days: number | null | undefined): string {
  if (days === 1) return 'After 1 day of delivery';
  if (isReviewAfterDays(days)) return `After ${days} days of delivery`;
  return 'After the return period';
}
