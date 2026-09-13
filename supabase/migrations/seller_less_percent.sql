-- Let Seller Less be entered as a % of the order amount, in addition to a flat ₹ amount.
-- seller_less stays the source of truth (₹) everywhere it's already consumed;
-- seller_less_percent is only set when the amount was derived from a %, so the
-- app can redisplay it as "50% (₹649)" instead of losing the percent basis.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_less_percent numeric NULL;
