-- Per-user mediator contacts and an optional WhatsApp number on each order.
-- orders.user_id is uuid (same type the app writes from auth.uid(), matching
-- feature_requests.user_id). mediator_name stays text and is not backfilled.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.mediators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name text NOT NULL,
  name_key text NOT NULL,
  phone_display text,
  phone_normalized text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mediators_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  CONSTRAINT mediators_phone_digits CHECK (phone_normalized = '' OR phone_normalized ~ '^91[0-9]{10}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS mediators_user_name_phone_key
  ON public.mediators (user_id, name_key, phone_normalized);

CREATE UNIQUE INDEX IF NOT EXISTS mediators_user_phone_key
  ON public.mediators (user_id, phone_normalized)
  WHERE phone_normalized <> '';

ALTER TABLE public.mediators ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mediators' AND policyname = 'mediators_own'
  ) THEN
    CREATE POLICY mediators_own
      ON public.mediators
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_mediators_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mediators_set_updated_at ON public.mediators;
CREATE TRIGGER mediators_set_updated_at
  BEFORE UPDATE ON public.mediators
  FOR EACH ROW
  EXECUTE FUNCTION public.set_mediators_updated_at();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS mediator_id uuid REFERENCES public.mediators(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS mediator_phone text;
