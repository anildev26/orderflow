-- ─────────────────────────────────────────────────────────────
-- Refund follow-up / reminder system
-- Adds timeline-driven reminder fields to the orders table.
-- Safe to run multiple times (IF NOT EXISTS guards).
-- ─────────────────────────────────────────────────────────────

-- Per-order expected refund timeline (in days). NULL → fall back to the
-- app default (DEFAULT_REFUND_TIMELINE_DAYS = 60).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_timeline_days integer;

-- The next date this order should surface as a follow-up. NULL → no reminder.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS next_reminder_date date;

-- Reminder lifecycle: 'scheduled' | 'snoozed' | 'contacted' | 'stopped'.
-- ('due' is derived at read time from next_reminder_date <= today.)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reminder_status text;

-- Last time the mediator was actually contacted about this refund.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_contacted_date date;

-- How many follow-up contacts have been logged for this order.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;

-- Append-only follow-up history: array of { date, action, note?, nextReminderDate?, fromStatus? }.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reminder_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Index the due-date so the follow-ups query stays fast as orders grow.
CREATE INDEX IF NOT EXISTS orders_next_reminder_date_idx
  ON public.orders (next_reminder_date)
  WHERE next_reminder_date IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- Backfill: existing orders that are waiting on a refund but were never
-- given a reminder. Anchor on the most relevant status date + 60 days.
-- Orders whose form was filled 100-200 days ago will immediately show as
-- overdue on the Follow-ups page — which is the whole point.
-- ─────────────────────────────────────────────────────────────
-- Note: the status date columns are stored as text (YYYY-MM-DD), so cast to
-- date explicitly. NULLIF guards against empty-string values.
UPDATE public.orders
SET
  next_reminder_date =
    COALESCE(
      NULLIF(refund_form_filled_date, ''),
      NULLIF(informed_mediator_date, ''),
      NULLIF(review_rating_date, '')
    )::date + 60,
  reminder_status = 'scheduled'
WHERE status IN ('refund_form_filled', 'informed_mediator', 'review_rating_submitted')
  AND next_reminder_date IS NULL
  AND COALESCE(
        NULLIF(refund_form_filled_date, ''),
        NULLIF(informed_mediator_date, ''),
        NULLIF(review_rating_date, '')
      ) IS NOT NULL;
