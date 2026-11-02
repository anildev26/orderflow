-- Feature-request email leak, SECURITY DEFINER search_path, and admin authz.
-- Idempotent. Run after every other file in supabase/migrations (this name sorts last).
-- Safe to re-run. Re-applies feature_requests_admin_authz_fix.sql so production is
-- admin-only even if that fix was never applied. Does not weaken any policy.
--
-- Signed-in users keep a shortened address (jo***@gmail.com) via user_email_masked.
-- user_email stays for the table owner and service_role (SQL editor). The Data API
-- roles anon and authenticated cannot SELECT it. Table-level SELECT would still
-- cover that column, so this revokes table SELECT and grants the safe columns back.

ALTER TABLE public.feature_requests
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;

ALTER TABLE public.feature_requests
  ADD COLUMN IF NOT EXISTS admin_comment text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'feature_requests'
      AND column_name = 'user_email_masked'
  ) THEN
    ALTER TABLE public.feature_requests
      ADD COLUMN user_email_masked text
      GENERATED ALWAYS AS (
        CASE
          WHEN user_email IS NULL OR strpos(user_email, '@') = 0 THEN user_email
          ELSE left(split_part(user_email, '@', 1), 2) || '***@' || split_part(user_email, '@', 2)
        END
      ) STORED;
  END IF;
END $$;

REVOKE SELECT ON TABLE public.feature_requests FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  id,
  user_id,
  content,
  likes,
  dislikes,
  created_at,
  completed,
  admin_comment,
  user_email_masked
) ON TABLE public.feature_requests TO authenticated;

-- Pin search_path on every SECURITY DEFINER function the API or RLS can reach.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '') = 'anilsahu2672000@gmail.com';
$$;

CREATE OR REPLACE FUNCTION public.update_vote_counts(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.feature_requests
  SET
    likes = (SELECT count(*) FROM public.feature_votes WHERE request_id = p_request_id AND vote = 'like'),
    dislikes = (SELECT count(*) FROM public.feature_votes WHERE request_id = p_request_id AND vote = 'dislike')
  WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_completed(p_request_id uuid, p_completed boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.feature_requests SET completed = p_completed WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_comment(p_request_id uuid, p_comment text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.feature_requests SET admin_comment = p_comment WHERE id = p_request_id;
END;
$$;

-- Recount from the vote row. The client must not call update_vote_counts:
-- a non-admin cannot UPDATE feature_requests, and that function is SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.feature_votes_recount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.update_vote_counts(OLD.request_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.request_id IS DISTINCT FROM NEW.request_id THEN
    PERFORM public.update_vote_counts(OLD.request_id);
  END IF;

  PERFORM public.update_vote_counts(NEW.request_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_votes_recount_trg ON public.feature_votes;
CREATE TRIGGER feature_votes_recount_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.feature_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.feature_votes_recount();

-- Trigger functions only. anon/authenticated must not call them over the Data API.
REVOKE ALL ON FUNCTION public.update_vote_counts(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.feature_votes_recount() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_vote_counts(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_mark_completed(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_comment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_completed(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_comment(uuid, text) TO authenticated, service_role;

-- Same policy as feature_requests_admin_authz_fix.sql.
DROP POLICY IF EXISTS "update feature_requests admin fields" ON public.feature_requests;
CREATE POLICY "update feature_requests admin fields"
  ON public.feature_requests
  FOR UPDATE
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

NOTIFY pgrst, 'reload schema';
