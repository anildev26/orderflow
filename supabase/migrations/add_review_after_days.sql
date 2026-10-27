-- Opt-in early rating/review reminder, chosen when an order is marked Delivered.
-- NULL means "after the return period" (today's behaviour) and is the default
-- for every existing order — nothing is backfilled onto the new card.
-- 1, 3, or 7 means remind that many local calendar days after delivered_date.
-- Safe to run more than once.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS review_after_days integer;

DO $$ BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_review_after_days_check
    CHECK (review_after_days IS NULL OR review_after_days IN (1, 3, 7));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
