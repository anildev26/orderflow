-- Add admin fields to feature_requests
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS admin_comment text;

-- Allow admin (service role or via RLS bypass) to update completed + admin_comment
-- We handle admin auth in the app layer (checking email), so just allow authenticated users to
-- update these fields — the app restricts who can call the RPC.

-- RPC: admin mark as completed
CREATE OR REPLACE FUNCTION public.admin_mark_completed(p_request_id uuid, p_completed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.feature_requests SET completed = p_completed WHERE id = p_request_id;
END;
$$;

-- RPC: admin set comment
CREATE OR REPLACE FUNCTION public.admin_set_comment(p_request_id uuid, p_comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.feature_requests SET admin_comment = p_comment WHERE id = p_request_id;
END;
$$;

-- Allow authenticated users to update completed and admin_comment (app enforces admin-only)
CREATE POLICY IF NOT EXISTS "update feature_requests admin fields" ON public.feature_requests
  FOR UPDATE USING (auth.role() = 'authenticated');
