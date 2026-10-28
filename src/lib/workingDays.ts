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
