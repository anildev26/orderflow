import type { Order } from '@/types/order';
import { addDays } from './followup';
import { getReturnWindow } from './returnWindow';

/** Days after delivery when an early rating/review reminder can fire. */
export const REVIEW_AFTER_DAY_OPTIONS = [1, 3, 7] as const;

export type ReviewAfterDays = (typeof REVIEW_AFTER_DAY_OPTIONS)[number];

export function isReviewAfterDays(value: number | null | undefined): value is ReviewAfterDays {
  return value === 1 || value === 3 || value === 7;
}

/** Local calendar date the reminder begins, or null for "after the return period". */
export function reviewDueDate(
  order: Pick<Order, 'deliveredDate' | 'reviewAfterDays'>
): string | null {
  if (!order.deliveredDate || !isReviewAfterDays(order.reviewAfterDays)) return null;
  return addDays(order.deliveredDate, order.reviewAfterDays);
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
