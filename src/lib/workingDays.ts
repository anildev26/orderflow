import { addDays } from './followup';

/**
 * Public holidays as local YYYY-MM-DD dates. Empty on purpose: weekends are
 * the only non-working days today. Add dates here later and every caller of
 * countWorkingDays picks them up without a holiday calendar of its own.
 */
export const PUBLIC_HOLIDAYS: readonly string[] = [];

/** Saturday or Sunday in local time. `isoDate` is YYYY-MM-DD. */
export function isWeekend(isoDate: string): boolean {
  const day = new Date(`${isoDate}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

/** Monday–Friday, and not listed in `holidays` (defaults to PUBLIC_HOLIDAYS). */
export function isWorkingDay(isoDate: string, holidays: readonly string[] = PUBLIC_HOLIDAYS): boolean {
  return !isWeekend(isoDate) && !holidays.includes(isoDate);
}

/**
 * Working days strictly after `from` through `to` (inclusive).
 * The start date itself is not counted, matching the next-day rule used for
 * review reminders. Weekends are skipped. Returns 0 when `to` is on or before `from`.
 */
export function countWorkingDays(from: string, to: string, holidays: readonly string[] = PUBLIC_HOLIDAYS): number {
  if (!from || !to || to <= from) return 0;
  let count = 0;
  let cursor = addDays(from, 1);
  // A hard cap so a malformed date cannot loop. Ten years of days is enough.
  for (let i = 0; i < 3660 && cursor <= to; i++) {
    if (isWorkingDay(cursor, holidays)) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

export function workingDaysLabel(count: number): string {
  return `${count} working day${count === 1 ? '' : 's'}`;
}

/**
 * The date `n` working days after `from`. `from` itself is not counted:
 * counting starts the next day, and the result is always a working day.
 * `n` < 1 returns `from` unchanged.
 */
export function addWorkingDays(from: string, n: number, holidays: readonly string[] = PUBLIC_HOLIDAYS): string {
  if (!from || n < 1) return from;
  let cursor = from;
  let left = Math.floor(n);
  for (let i = 0; i < 3660 && left > 0; i++) {
    cursor = addDays(cursor, 1);
    if (isWorkingDay(cursor, holidays)) left -= 1;
  }
  return cursor;
}

/** Move a weekend (or later, a holiday) forward to the next working day. */
export function ensureWorkingDay(isoDate: string, holidays: readonly string[] = PUBLIC_HOLIDAYS): string {
  if (!isoDate || isWorkingDay(isoDate, holidays)) return isoDate;
  let cursor = isoDate;
  for (let i = 0; i < 7 && !isWorkingDay(cursor, holidays); i++) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

/**
 * Working days from `today` to `target`.
 * Positive = target is still ahead ("in N working days").
 * Negative = target has passed ("N working days overdue").
 * 0 = target is today, or no working day falls strictly between the two dates.
 */
export function workingDaysOffset(target: string, today: string): number {
  if (!target || target === today) return 0;
  if (target > today) return countWorkingDays(today, target);
  return -countWorkingDays(target, today);
}
