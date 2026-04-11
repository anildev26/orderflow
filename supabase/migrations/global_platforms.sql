-- Global platforms table — admin-controlled, syncs to all users
CREATE TABLE IF NOT EXISTS public.global_platforms (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  value       text        UNIQUE NOT NULL,
  label       text        NOT NULL,
  active      boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.global_platforms ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user the platform admin?
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '') = 'anilsahu2672000@gmail.com'
$$;

-- SELECT: authenticated users see active platforms; admin sees all
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'global_platforms' AND policyname = 'read_platforms'
  ) THEN
    CREATE POLICY "read_platforms"
      ON public.global_platforms FOR SELECT
      TO authenticated
      USING (active = true OR public.is_platform_admin());
  END IF;
END $$;

-- INSERT: admin only
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'global_platforms' AND policyname = 'admin_insert_platform'
  ) THEN
    CREATE POLICY "admin_insert_platform"
      ON public.global_platforms FOR INSERT
      TO authenticated
      WITH CHECK (public.is_platform_admin());
  END IF;
END $$;

-- UPDATE: admin only
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'global_platforms' AND policyname = 'admin_update_platform'
  ) THEN
    CREATE POLICY "admin_update_platform"
      ON public.global_platforms FOR UPDATE
      TO authenticated
      USING (public.is_platform_admin())
      WITH CHECK (public.is_platform_admin());
  END IF;
END $$;

-- DELETE: admin only
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'global_platforms' AND policyname = 'admin_delete_platform'
  ) THEN
    CREATE POLICY "admin_delete_platform"
      ON public.global_platforms FOR DELETE
      TO authenticated
      USING (public.is_platform_admin());
  END IF;
END $$;

-- Seed initial platforms
INSERT INTO public.global_platforms (value, label, sort_order) VALUES
  ('flipkart', 'Flipkart', 1),
  ('amazon',   'Amazon',   2),
  ('myntra',   'Myntra',   3),
  ('meesho',   'Meesho',   4),
  ('ajio',     'Ajio',     5),
  ('blinkit',  'Blinkit',  6),
  ('shopsy',   'Shopsy',   7),
  ('nykaa',    'Nykaa',    8),
  ('jio',      'Jio',      9),
  ('other',    'Other',    10)
ON CONFLICT (value) DO NOTHING;
