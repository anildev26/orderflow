import type { Order } from '@/types/order';
import { addDays, daysBetween, todayStr } from './followup';

/** Return windows stay independent of status changes until the refund form is filled. */
export function getReturnWindow(
  order: Pick<Order, 'status' | 'deliveredDate' | 'returnPeriodDays'>,
  today = todayStr()
) {
  if (!order.deliveredDate || order.status === 'refund_form_filled') return null;

  const endDate = addDays(order.deliveredDate, order.returnPeriodDays || 7);
  // The closing date remains open for the whole local calendar day.
  return { endDate, daysLeft: daysBetween(endDate, today) + 1 };
}
