-- Security fix: admin_mark_completed / admin_set_comment had no server-side
-- caller check (SECURITY DEFINER functions trusted the app layer only), and
-- the accompanying RLS policy allowed ANY authenticated user to UPDATE
-- feature_requests, not just the admin. Reuse the existing is_platform_admin()
-- helper (already used correctly for global_platforms/demo_orders) to close
-- both gaps at the database layer.

CREATE OR REPLACE FUNCTION public.admin_mark_completed(p_request_id uuid, p_completed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.feature_requests SET completed = p_completed WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_comment(p_request_id uuid, p_comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.feature_requests SET admin_comment = p_comment WHERE id = p_request_id;
END;
$$;

DROP POLICY IF EXISTS "update feature_requests admin fields" ON public.feature_requests;
CREATE POLICY "update feature_requests admin fields" ON public.feature_requests
  FOR UPDATE USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
