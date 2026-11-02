-- Per-user reviewer names. orders.reviewer_name stays the text stored on
-- each order. This migration only copies distinct names into the list.
-- It does not update, delete, or rewrite order rows.
-- Safe to run more than once: new names are inserted, existing list rows stay.

CREATE TABLE IF NOT EXISTS public.reviewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name text NOT NULL,
  name_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviewers_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS reviewers_user_name_key
  ON public.reviewers (user_id, name_key);

ALTER TABLE public.reviewers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reviewers' AND policyname = 'reviewers_own'
  ) THEN
    CREATE POLICY reviewers_own
      ON public.reviewers
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_reviewers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviewers_set_updated_at ON public.reviewers;
CREATE TRIGGER reviewers_set_updated_at
  BEFORE UPDATE ON public.reviewers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_reviewers_updated_at();

-- Seed each account from reviewer names already stored on that account's orders.
-- Same person with different spacing or letter case becomes one list row.
-- The display name is the spelling on the newest order. Orders are not changed.
INSERT INTO public.reviewers (user_id, name, name_key)
SELECT DISTINCT ON (o.user_id, lower(regexp_replace(btrim(o.reviewer_name), '\s+', ' ', 'g')))
  o.user_id,
  regexp_replace(btrim(o.reviewer_name), '\s+', ' ', 'g'),
  lower(regexp_replace(btrim(o.reviewer_name), '\s+', ' ', 'g'))
FROM public.orders o
WHERE o.user_id IS NOT NULL
  AND char_length(regexp_replace(btrim(o.reviewer_name), '\s+', ' ', 'g')) BETWEEN 1 AND 100
ORDER BY
  o.user_id,
  lower(regexp_replace(btrim(o.reviewer_name), '\s+', ' ', 'g')),
  o.created_at DESC NULLS LAST
ON CONFLICT (user_id, name_key) DO NOTHING;
