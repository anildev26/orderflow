-- Commission deals: the mediator pays the product amount back plus a flat INR
-- commission. NULL means a seller's less deal (the default, including a full
-- refund where seller_less = 0). A number means a commission deal.
-- The check keeps the two mutually exclusive. Safe to run more than once.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS commission_amount numeric;

DO $$ BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_commission_exclusive_check
    CHECK (
      commission_amount IS NULL
      OR (commission_amount >= 0 AND seller_less = 0 AND seller_less_percent IS NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
