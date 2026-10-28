-- Optional. The app already recomputes timeline reminders at read time.
-- Run this if you want next_reminder_date in the database to match.
--
-- Updates only reminders whose latest history action is "scheduled"
-- (or that have no history). Snoozed and contacted dates are left as the
-- user set them, even if that date falls on a weekend.
-- Safe to run more than once: a second run writes the same working-day date.

CREATE OR REPLACE FUNCTION public.add_working_days(start_date date, n integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d date := start_date;
  left_days integer := n;
BEGIN
  IF start_date IS NULL OR n IS NULL OR n < 1 THEN
    RETURN start_date;
  END IF;
  WHILE left_days > 0 LOOP
    d := d + 1;
    -- Postgres DOW: 0 = Sunday, 6 = Saturday. No holiday list.
    IF EXTRACT(DOW FROM d) NOT IN (0, 6) THEN
      left_days := left_days - 1;
    END IF;
  END LOOP;
  RETURN d;
END;
$$;

-- next_reminder_date is date. refund_timeline_days is integer.
-- reminder_status is text. reminder_history is jsonb.
-- The status anchors are text (YYYY-MM-DD); cast them to date. NULLIF skips ''.
UPDATE public.orders AS o
SET next_reminder_date = public.add_working_days(
  CASE o.status
    WHEN 'refund_form_filled' THEN NULLIF(o.refund_form_filled_date, '')::date
    WHEN 'informed_mediator' THEN NULLIF(o.informed_mediator_date, '')::date
    WHEN 'review_rating_submitted' THEN NULLIF(o.review_rating_date, '')::date
  END,
  CASE
    WHEN o.refund_timeline_days IS NOT NULL AND o.refund_timeline_days > 0 THEN o.refund_timeline_days
    ELSE 60
  END
)
WHERE o.reminder_status = 'scheduled'
  AND o.next_reminder_date IS NOT NULL
  AND (
    o.reminder_history IS NULL
    OR jsonb_typeof(o.reminder_history) <> 'array'
    OR jsonb_array_length(o.reminder_history) = 0
    OR o.reminder_history -> (jsonb_array_length(o.reminder_history) - 1) ->> 'action' = 'scheduled'
  )
  AND CASE o.status
    WHEN 'refund_form_filled' THEN NULLIF(o.refund_form_filled_date, '')
    WHEN 'informed_mediator' THEN NULLIF(o.informed_mediator_date, '')
    WHEN 'review_rating_submitted' THEN NULLIF(o.review_rating_date, '')
  END IS NOT NULL;
