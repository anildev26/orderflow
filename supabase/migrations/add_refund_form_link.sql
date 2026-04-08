-- Add refund_form_link column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_form_link text;
