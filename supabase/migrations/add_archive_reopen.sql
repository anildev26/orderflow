-- Archive: remember the status an order had before it was marked paid or
-- cancelled, so "Reopen" puts it back exactly where it was, plus the date it
-- was archived (cancelled orders have no other date for that).
-- Both are NULL for orders archived before this migration; the app then works
-- the previous status out from the order's saved dates. Nothing is backfilled.
-- Safe to run more than once.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS archived_from_status text,
  ADD COLUMN IF NOT EXISTS archived_at date;

DO $$ BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_archived_from_status_check
    CHECK (archived_from_status IS NULL OR archived_from_status IN (
      'ordered', 'delivered', 'review_rating_submitted', 'refund_form_pending',
      'refund_form_filled', 'informed_mediator'
    ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
