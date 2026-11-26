-- Feature Requests v2: statuses, Me too, discussion, private reasons, developer messages,
-- admin triage (merge / already exists / priority) and board settings.
--
-- Run AFTER every other file in supabase/migrations (this name sorts last, after
-- z_security_feature_requests_and_definer.sql, whose is_platform_admin() and
-- user_email_masked it relies on). Idempotent: safe to run more than once.
--
-- Existing data is kept:
--   * completed = true            -> status 'shipped'
--   * admin_comment (not done)    -> status 'under_review' with that comment as the public note
--   * likes                       -> Me too votes (unchanged rows)
--   * dislikes                    -> removed (Me too has no opposite)
--
-- Every rule the UI shows is also enforced here: users cannot set a status, counts, or
-- another person's email on insert; only the admin can change status, merge, set
-- priority, or read requester emails; posting, voting, comments and messages are
-- rate limited.

-- ───────────────────────── Helpers ─────────────────────────

CREATE OR REPLACE FUNCTION public.fr_mask_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_email IS NULL OR p_email = '' THEN 'user'
    WHEN strpos(p_email, '@') = 0 THEN left(p_email, 2) || '***'
    ELSE left(split_part(p_email, '@', 1), 2) || '***@' || split_part(p_email, '@', 2)
  END;
$$;

-- First line of the request, collapsed to single spaces, at most 120 characters.
-- Mirrored by makeTitle() in src/lib/featureRequests.ts.
CREATE OR REPLACE FUNCTION public.fr_make_title(p_content text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  t text;
BEGIN
  t := btrim(regexp_replace(split_part(coalesce(p_content, ''), E'\n', 1), '\s+', ' ', 'g'));
  IF char_length(t) < 3 THEN
    t := btrim(regexp_replace(coalesce(p_content, ''), '\s+', ' ', 'g'));
  END IF;
  IF char_length(t) > 120 THEN
    t := left(t, 117);
    IF strpos(t, ' ') > 0 THEN
      t := regexp_replace(t, '\s+\S*$', '');
    END IF;
    t := t || '…';
  END IF;
  RETURN t;
END;
$$;

REVOKE ALL ON FUNCTION public.fr_mask_email(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fr_make_title(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fr_mask_email(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fr_make_title(text) TO authenticated, service_role;

-- ───────────────────────── feature_requests: new columns ─────────────────────────

ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS area text;
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS status_note text;
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS shipped_version text;
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS exists_feature text;
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS merged_into uuid;
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS contact_ok boolean NOT NULL DEFAULT true;
ALTER TABLE public.feature_requests ADD COLUMN IF NOT EXISTS last_update_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fr_merged_into_fk') THEN
    ALTER TABLE public.feature_requests
      ADD CONSTRAINT fr_merged_into_fk FOREIGN KEY (merged_into)
      REFERENCES public.feature_requests(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fr_status_check') THEN
    ALTER TABLE public.feature_requests ADD CONSTRAINT fr_status_check CHECK (
      status IN ('new', 'under_review', 'planned', 'in_progress', 'shipped', 'already_exists', 'not_planned')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fr_area_check') THEN
    ALTER TABLE public.feature_requests ADD CONSTRAINT fr_area_check CHECK (
      area IS NULL OR area IN ('orders', 'follow_ups', 'refunds', 'archive', 'analytics', 'settings', 'other')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fr_title_len') THEN
    ALTER TABLE public.feature_requests ADD CONSTRAINT fr_title_len CHECK (
      title IS NULL OR char_length(title) BETWEEN 1 AND 140
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fr_details_len') THEN
    ALTER TABLE public.feature_requests ADD CONSTRAINT fr_details_len CHECK (
      details IS NULL OR char_length(details) <= 1000
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fr_note_len') THEN
    ALTER TABLE public.feature_requests ADD CONSTRAINT fr_note_len CHECK (
      status_note IS NULL OR char_length(status_note) <= 1000
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fr_version_len') THEN
    ALTER TABLE public.feature_requests ADD CONSTRAINT fr_version_len CHECK (
      shipped_version IS NULL OR char_length(shipped_version) <= 24
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fr_exists_len') THEN
    ALTER TABLE public.feature_requests ADD CONSTRAINT fr_exists_len CHECK (
      exists_feature IS NULL OR char_length(exists_feature) <= 60
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fr_not_self_merged') THEN
    ALTER TABLE public.feature_requests ADD CONSTRAINT fr_not_self_merged CHECK (
      merged_into IS NULL OR merged_into <> id
    );
  END IF;
END $$;

-- The original inline check required 10–500 characters. Short asks like "Dark mode"
-- are fine, so the minimum is now 6 (after trimming, enforced by the trigger below).
ALTER TABLE public.feature_requests DROP CONSTRAINT IF EXISTS feature_requests_content_check;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fr_content_len') THEN
    ALTER TABLE public.feature_requests ADD CONSTRAINT fr_content_len CHECK (
      char_length(content) BETWEEN 6 AND 500
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS fr_requests_status_idx ON public.feature_requests (status);
CREATE INDEX IF NOT EXISTS fr_requests_user_idx ON public.feature_requests (user_id);
CREATE INDEX IF NOT EXISTS fr_votes_request_idx ON public.feature_votes (request_id);

-- Backfill from the old done/comment fields. Only touches rows still at the default.
UPDATE public.feature_requests
SET status = 'shipped',
    status_note = COALESCE(status_note, NULLIF(btrim(admin_comment), ''))
WHERE completed = true AND status = 'new';

UPDATE public.feature_requests
SET status = 'under_review',
    status_note = NULLIF(btrim(admin_comment), '')
WHERE completed = false
  AND status = 'new'
  AND status_note IS NULL
  AND NULLIF(btrim(admin_comment), '') IS NOT NULL;

UPDATE public.feature_requests
SET title = public.fr_make_title(content)
WHERE title IS NULL;

-- ───────────────────────── Votes become "Me too" ─────────────────────────

DELETE FROM public.feature_votes WHERE vote = 'dislike';
ALTER TABLE public.feature_votes DROP CONSTRAINT IF EXISTS feature_votes_vote_check;
ALTER TABLE public.feature_votes ALTER COLUMN vote SET DEFAULT 'like';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fv_vote_like') THEN
    ALTER TABLE public.feature_votes ADD CONSTRAINT fv_vote_like CHECK (vote = 'like');
  END IF;
END $$;

-- ───────────────────────── New tables ─────────────────────────

-- Public discussion on a request. is_admin and author_label are set by the server.
CREATE TABLE IF NOT EXISTS public.feature_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_label text NOT NULL DEFAULT '',
  is_admin     boolean NOT NULL DEFAULT false,
  body         text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fr_comments_request_idx ON public.feature_comments (request_id, created_at);

-- Status history, written only by fr_admin_set_status / fr_admin_merge.
CREATE TABLE IF NOT EXISTS public.feature_status_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  status      text NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fr_events_request_idx ON public.feature_status_events (request_id, created_at);

-- "Why do you need it?" from people who said Me too. Only that person and the admin can read it.
CREATE TABLE IF NOT EXISTS public.feature_request_reasons (
  request_id  uuid NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, user_id)
);

-- When a user last opened a request, for the "updates" dot on Mine.
CREATE TABLE IF NOT EXISTS public.feature_seen (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id  uuid NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  seen_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);

-- Private admin priority. Never readable by users.
CREATE TABLE IF NOT EXISTS public.feature_admin_meta (
  request_id  uuid PRIMARY KEY REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  priority    text CHECK (priority IS NULL OR priority IN ('nice', 'important', 'must')),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One private conversation per user with the developer ("Leave a message here").
CREATE TABLE IF NOT EXISTS public.feature_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_admin      boolean NOT NULL DEFAULT false,
  thread_label    text NOT NULL DEFAULT '',
  body            text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  page            text CHECK (page IS NULL OR char_length(page) <= 200),
  request_id      uuid REFERENCES public.feature_requests(id) ON DELETE SET NULL,
  read_by_admin   boolean NOT NULL DEFAULT false,
  read_by_user    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fr_messages_thread_idx ON public.feature_messages (thread_user_id, created_at);

-- Single row: what the "Talk to the developer" button shows.
CREATE TABLE IF NOT EXISTS public.feature_board_settings (
  id                smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  availability      text NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'busy', 'away')),
  away_note         text CHECK (away_note IS NULL OR char_length(away_note) <= 120),
  whatsapp_enabled  boolean NOT NULL DEFAULT true,
  telegram_enabled  boolean NOT NULL DEFAULT true,
  inapp_enabled     boolean NOT NULL DEFAULT true,
  call_url          text CHECK (call_url IS NULL OR (call_url ~ '^https://[^\s<>"]+$' AND char_length(call_url) <= 300)),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.feature_board_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ───────────────────────── Triggers ─────────────────────────

-- New request: the server decides email, title, status and counts. Rate limited.
CREATE OR REPLACE FUNCTION public.fr_requests_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text := auth.jwt() ->> 'email';
  v_recent int;
BEGIN
  IF NOT public.is_platform_admin() THEN
    SELECT count(*) INTO v_recent
    FROM public.feature_requests
    WHERE user_id = NEW.user_id AND created_at > now() - interval '24 hours';
    IF v_recent >= 10 THEN
      RAISE EXCEPTION 'fr_rate_limited: You can post up to 10 requests a day. Please try again tomorrow.';
    END IF;
  END IF;

  -- Drop invisible control characters (keeps newlines and tabs), then trim.
  NEW.content := btrim(regexp_replace(coalesce(NEW.content, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));
  IF char_length(NEW.content) < 6 THEN
    RAISE EXCEPTION 'fr_invalid: Please describe the feature in a few more words.';
  END IF;
  IF char_length(NEW.content) > 500 THEN
    RAISE EXCEPTION 'fr_invalid: Please keep the request under 500 characters.';
  END IF;

  NEW.title := public.fr_make_title(NEW.content);
  NEW.details := NULLIF(btrim(coalesce(NEW.details, '')), '');
  IF NEW.details IS NOT NULL AND char_length(NEW.details) > 1000 THEN
    RAISE EXCEPTION 'fr_invalid: Please keep the details under 1000 characters.';
  END IF;
  IF v_email IS NOT NULL AND v_email <> '' THEN
    NEW.user_email := v_email;
  END IF;

  NEW.status := 'new';
  NEW.status_note := NULL;
  NEW.shipped_version := NULL;
  NEW.exists_feature := NULL;
  NEW.merged_into := NULL;
  NEW.likes := 0;
  NEW.dislikes := 0;
  NEW.completed := false;
  NEW.admin_comment := NULL;
  NEW.last_update_at := NULL;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

-- The person who posts a request automatically follows it (counts as their Me too).
CREATE OR REPLACE FUNCTION public.fr_requests_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.feature_votes (user_id, request_id, vote)
  VALUES (NEW.user_id, NEW.id, 'like')
  ON CONFLICT (user_id, request_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fr_requests_before_insert_trg ON public.feature_requests;
CREATE TRIGGER fr_requests_before_insert_trg
  BEFORE INSERT ON public.feature_requests
  FOR EACH ROW EXECUTE FUNCTION public.fr_requests_before_insert();

DROP TRIGGER IF EXISTS fr_requests_after_insert_trg ON public.feature_requests;
CREATE TRIGGER fr_requests_after_insert_trg
  AFTER INSERT ON public.feature_requests
  FOR EACH ROW EXECUTE FUNCTION public.fr_requests_after_insert();

-- Me too: only on open requests, rate limited, always a 'like'.
CREATE OR REPLACE FUNCTION public.fr_votes_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_merged uuid;
  v_recent int;
BEGIN
  NEW.vote := 'like';
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  END IF;

  IF (TG_OP = 'INSERT' OR NEW.request_id IS DISTINCT FROM OLD.request_id)
     AND NOT public.is_platform_admin() THEN
    SELECT status, merged_into INTO v_status, v_merged
    FROM public.feature_requests WHERE id = NEW.request_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'fr_not_found: This request no longer exists.';
    END IF;
    IF v_merged IS NOT NULL OR v_status NOT IN ('new', 'under_review', 'planned', 'in_progress') THEN
      RAISE EXCEPTION 'fr_closed: This request is closed, so it no longer takes Me too votes.';
    END IF;
    SELECT count(*) INTO v_recent
    FROM public.feature_votes
    WHERE user_id = NEW.user_id AND created_at > now() - interval '1 hour';
    IF v_recent >= 120 THEN
      RAISE EXCEPTION 'fr_rate_limited: Too many votes in a short time. Please wait a few minutes.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fr_votes_before_write_trg ON public.feature_votes;
CREATE TRIGGER fr_votes_before_write_trg
  BEFORE INSERT OR UPDATE ON public.feature_votes
  FOR EACH ROW EXECUTE FUNCTION public.fr_votes_before_write();

-- Comments: the server sets who wrote it and whether it is the developer.
CREATE OR REPLACE FUNCTION public.fr_comments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recent int;
  v_merged uuid;
BEGIN
  NEW.body := btrim(coalesce(NEW.body, ''));
  IF char_length(NEW.body) < 1 THEN
    RAISE EXCEPTION 'fr_invalid: Write a comment first.';
  END IF;
  SELECT merged_into INTO v_merged FROM public.feature_requests WHERE id = NEW.request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fr_not_found: This request no longer exists.';
  END IF;
  IF v_merged IS NOT NULL THEN
    RAISE EXCEPTION 'fr_closed: This request was combined with another one. Comment there instead.';
  END IF;

  NEW.is_admin := public.is_platform_admin();
  NEW.author_label := CASE WHEN NEW.is_admin THEN 'Developer' ELSE public.fr_mask_email(auth.jwt() ->> 'email') END;
  NEW.created_at := now();

  IF NOT NEW.is_admin THEN
    SELECT count(*) INTO v_recent
    FROM public.feature_comments
    WHERE user_id = NEW.user_id AND created_at > now() - interval '10 minutes';
    IF v_recent >= 15 THEN
      RAISE EXCEPTION 'fr_rate_limited: You are commenting very quickly. Please wait a few minutes.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fr_comments_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_admin THEN
    UPDATE public.feature_requests SET last_update_at = now() WHERE id = NEW.request_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fr_comments_before_insert_trg ON public.feature_comments;
CREATE TRIGGER fr_comments_before_insert_trg
  BEFORE INSERT ON public.feature_comments
  FOR EACH ROW EXECUTE FUNCTION public.fr_comments_before_insert();

DROP TRIGGER IF EXISTS fr_comments_after_insert_trg ON public.feature_comments;
CREATE TRIGGER fr_comments_after_insert_trg
  AFTER INSERT ON public.feature_comments
  FOR EACH ROW EXECUTE FUNCTION public.fr_comments_after_insert();

-- Private messages: a user can only write into their own conversation; the admin can
-- write into any. Sender, labels and read flags are set by the server.
CREATE OR REPLACE FUNCTION public.fr_messages_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recent int;
  v_email text;
BEGIN
  NEW.body := btrim(coalesce(NEW.body, ''));
  IF char_length(NEW.body) < 1 THEN
    RAISE EXCEPTION 'fr_invalid: Write a message first.';
  END IF;
  IF char_length(NEW.body) > 4000 THEN
    RAISE EXCEPTION 'fr_invalid: Please keep the message under 4000 characters.';
  END IF;

  NEW.sender_id := auth.uid();
  NEW.from_admin := public.is_platform_admin();
  IF NOT NEW.from_admin THEN
    NEW.thread_user_id := auth.uid();
    NEW.thread_label := public.fr_mask_email(auth.jwt() ->> 'email');
    SELECT count(*) INTO v_recent
    FROM public.feature_messages
    WHERE sender_id = NEW.sender_id AND created_at > now() - interval '10 minutes';
    IF v_recent >= 15 THEN
      RAISE EXCEPTION 'fr_rate_limited: You have sent a lot of messages in a short time. Please wait a few minutes.';
    END IF;
  ELSE
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.thread_user_id;
    NEW.thread_label := public.fr_mask_email(v_email);
  END IF;
  NEW.page := NULLIF(left(btrim(coalesce(NEW.page, '')), 200), '');
  NEW.read_by_admin := NEW.from_admin;
  NEW.read_by_user := NOT NEW.from_admin;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fr_messages_before_insert_trg ON public.feature_messages;
CREATE TRIGGER fr_messages_before_insert_trg
  BEFORE INSERT ON public.feature_messages
  FOR EACH ROW EXECUTE FUNCTION public.fr_messages_before_insert();

-- Reasons are trimmed and capped server-side too.
CREATE OR REPLACE FUNCTION public.fr_reasons_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.reason := btrim(coalesce(NEW.reason, ''));
  IF char_length(NEW.reason) < 1 THEN
    RAISE EXCEPTION 'fr_invalid: Write a reason first.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fr_reasons_before_write_trg ON public.feature_request_reasons;
CREATE TRIGGER fr_reasons_before_write_trg
  BEFORE INSERT OR UPDATE ON public.feature_request_reasons
  FOR EACH ROW EXECUTE FUNCTION public.fr_reasons_before_write();

REVOKE ALL ON FUNCTION public.fr_requests_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fr_requests_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fr_votes_before_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fr_comments_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fr_comments_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fr_messages_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fr_reasons_before_write() FROM PUBLIC, anon, authenticated;

-- ───────────────────────── Row level security ─────────────────────────

ALTER TABLE public.feature_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_request_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_seen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_admin_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_board_settings ENABLE ROW LEVEL SECURITY;

-- A user can delete their own request only while nobody has acted on it.
-- The admin can delete any request.
DROP POLICY IF EXISTS "delete own feature_requests" ON public.feature_requests;
DROP POLICY IF EXISTS "fr delete own new or admin" ON public.feature_requests;
CREATE POLICY "fr delete own new or admin" ON public.feature_requests
  FOR DELETE USING (
    (auth.uid() = user_id AND status = 'new' AND merged_into IS NULL)
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "fr comments read" ON public.feature_comments;
CREATE POLICY "fr comments read" ON public.feature_comments
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "fr comments insert own" ON public.feature_comments;
CREATE POLICY "fr comments insert own" ON public.feature_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fr comments delete own or admin" ON public.feature_comments;
CREATE POLICY "fr comments delete own or admin" ON public.feature_comments
  FOR DELETE USING (auth.uid() = user_id OR public.is_platform_admin());

DROP POLICY IF EXISTS "fr events read" ON public.feature_status_events;
CREATE POLICY "fr events read" ON public.feature_status_events
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "fr reasons read own or admin" ON public.feature_request_reasons;
CREATE POLICY "fr reasons read own or admin" ON public.feature_request_reasons
  FOR SELECT USING (auth.uid() = user_id OR public.is_platform_admin());
DROP POLICY IF EXISTS "fr reasons insert own" ON public.feature_request_reasons;
CREATE POLICY "fr reasons insert own" ON public.feature_request_reasons
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fr reasons update own" ON public.feature_request_reasons;
CREATE POLICY "fr reasons update own" ON public.feature_request_reasons
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fr reasons delete own or admin" ON public.feature_request_reasons;
CREATE POLICY "fr reasons delete own or admin" ON public.feature_request_reasons
  FOR DELETE USING (auth.uid() = user_id OR public.is_platform_admin());

DROP POLICY IF EXISTS "fr seen own" ON public.feature_seen;
CREATE POLICY "fr seen own" ON public.feature_seen
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "fr admin meta admin only" ON public.feature_admin_meta;
CREATE POLICY "fr admin meta admin only" ON public.feature_admin_meta
  FOR ALL USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "fr messages read own or admin" ON public.feature_messages;
CREATE POLICY "fr messages read own or admin" ON public.feature_messages
  FOR SELECT USING (auth.uid() = thread_user_id OR public.is_platform_admin());
DROP POLICY IF EXISTS "fr messages insert own thread or admin" ON public.feature_messages;
CREATE POLICY "fr messages insert own thread or admin" ON public.feature_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND (auth.uid() = thread_user_id OR public.is_platform_admin())
  );

DROP POLICY IF EXISTS "fr settings read" ON public.feature_board_settings;
CREATE POLICY "fr settings read" ON public.feature_board_settings
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "fr settings admin update" ON public.feature_board_settings;
CREATE POLICY "fr settings admin update" ON public.feature_board_settings
  FOR UPDATE USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- ───────────────────────── Grants ─────────────────────────

GRANT SELECT (
  title, details, area, status, status_note, shipped_version, exists_feature, merged_into, last_update_at
) ON TABLE public.feature_requests TO authenticated;

REVOKE ALL ON TABLE public.feature_comments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.feature_comments TO authenticated;

REVOKE ALL ON TABLE public.feature_status_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.feature_status_events TO authenticated;

REVOKE ALL ON TABLE public.feature_request_reasons FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feature_request_reasons TO authenticated;

REVOKE ALL ON TABLE public.feature_seen FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feature_seen TO authenticated;

REVOKE ALL ON TABLE public.feature_admin_meta FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feature_admin_meta TO authenticated;

REVOKE ALL ON TABLE public.feature_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.feature_messages TO authenticated;

REVOKE ALL ON TABLE public.feature_board_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.feature_board_settings TO authenticated;

-- ───────────────────────── RPCs ─────────────────────────

-- Admin: change status with a public note. Validates what each status needs.
CREATE OR REPLACE FUNCTION public.fr_admin_set_status(
  p_request_id uuid,
  p_status text,
  p_note text DEFAULT NULL,
  p_version text DEFAULT NULL,
  p_feature text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_note text := NULLIF(btrim(coalesce(p_note, '')), '');
  v_version text := NULLIF(btrim(coalesce(p_version, '')), '');
  v_feature text := NULLIF(btrim(coalesce(p_feature, '')), '');
  v_merged uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'fr_forbidden: Only the developer can change a status.';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('new', 'under_review', 'planned', 'in_progress', 'shipped', 'already_exists', 'not_planned') THEN
    RAISE EXCEPTION 'fr_invalid: Unknown status.';
  END IF;
  SELECT merged_into INTO v_merged FROM public.feature_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fr_not_found: This request no longer exists.';
  END IF;
  IF v_merged IS NOT NULL THEN
    RAISE EXCEPTION 'fr_closed: This request was combined with another one.';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 1000 THEN
    RAISE EXCEPTION 'fr_invalid: Keep the note under 1000 characters.';
  END IF;
  IF p_status = 'not_planned' AND v_note IS NULL THEN
    RAISE EXCEPTION 'fr_invalid: Add a short reason for Not planned.';
  END IF;
  IF p_status = 'shipped' THEN
    IF v_version IS NULL OR v_version !~ '^v?[0-9]+(\.[0-9]+){0,3}$' THEN
      RAISE EXCEPTION 'fr_invalid: Add the version it shipped in, like v1.2.0.';
    END IF;
    IF left(v_version, 1) <> 'v' THEN
      v_version := 'v' || v_version;
    END IF;
  END IF;
  IF p_status = 'already_exists' AND v_feature IS NULL AND v_note IS NULL THEN
    RAISE EXCEPTION 'fr_invalid: Pick the existing feature or explain where to find it.';
  END IF;
  IF v_feature IS NOT NULL AND char_length(v_feature) > 60 THEN
    RAISE EXCEPTION 'fr_invalid: Unknown feature.';
  END IF;

  UPDATE public.feature_requests
  SET status = p_status,
      status_note = v_note,
      shipped_version = CASE WHEN p_status = 'shipped' THEN v_version ELSE NULL END,
      exists_feature = CASE WHEN p_status = 'already_exists' THEN v_feature ELSE NULL END,
      completed = (p_status = 'shipped'),
      last_update_at = CASE WHEN p_status = 'new' THEN last_update_at ELSE now() END
  WHERE id = p_request_id;

  INSERT INTO public.feature_status_events (request_id, status, note)
  VALUES (
    p_request_id,
    p_status,
    CASE WHEN p_status = 'shipped' THEN concat_ws(' · ', v_version, v_note) ELSE v_note END
  );
END;
$$;

-- Admin: combine a duplicate into another request. Followers, reasons, comments and
-- messages move to the target; the duplicate is hidden and points at the target.
CREATE OR REPLACE FUNCTION public.fr_admin_merge(p_source uuid, p_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source public.feature_requests%ROWTYPE;
  v_target public.feature_requests%ROWTYPE;
  v_moved int;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'fr_forbidden: Only the developer can merge requests.';
  END IF;
  IF p_source IS NULL OR p_target IS NULL OR p_source = p_target THEN
    RAISE EXCEPTION 'fr_invalid: Pick a different request to merge into.';
  END IF;
  SELECT * INTO v_source FROM public.feature_requests WHERE id = p_source FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fr_not_found: The request to merge no longer exists.';
  END IF;
  SELECT * INTO v_target FROM public.feature_requests WHERE id = p_target FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'fr_not_found: The target request no longer exists.';
  END IF;
  IF v_source.merged_into IS NOT NULL OR v_target.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'fr_closed: One of these requests was already combined with another.';
  END IF;

  INSERT INTO public.feature_votes (user_id, request_id, vote, created_at)
  SELECT user_id, p_target, 'like', created_at FROM public.feature_votes WHERE request_id = p_source
  ON CONFLICT (user_id, request_id) DO NOTHING;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  INSERT INTO public.feature_votes (user_id, request_id, vote)
  VALUES (v_source.user_id, p_target, 'like')
  ON CONFLICT (user_id, request_id) DO NOTHING;

  DELETE FROM public.feature_votes WHERE request_id = p_source;

  INSERT INTO public.feature_request_reasons (request_id, user_id, reason, updated_at)
  SELECT p_target, user_id, reason, updated_at FROM public.feature_request_reasons WHERE request_id = p_source
  ON CONFLICT (request_id, user_id) DO NOTHING;
  DELETE FROM public.feature_request_reasons WHERE request_id = p_source;

  -- Keep the duplicate's own description as a private reason when the poster gave one.
  IF v_source.details IS NOT NULL THEN
    INSERT INTO public.feature_request_reasons (request_id, user_id, reason)
    VALUES (p_target, v_source.user_id, left(v_source.details, 500))
    ON CONFLICT (request_id, user_id) DO NOTHING;
  END IF;

  UPDATE public.feature_comments SET request_id = p_target WHERE request_id = p_source;
  UPDATE public.feature_messages SET request_id = p_target WHERE request_id = p_source;
  UPDATE public.feature_requests SET merged_into = p_target WHERE merged_into = p_source;

  UPDATE public.feature_requests
  SET merged_into = p_target, last_update_at = now()
  WHERE id = p_source;

  INSERT INTO public.feature_status_events (request_id, status, note)
  VALUES (p_target, v_target.status, 'Combined "' || v_source.title || '" into this request.');
  INSERT INTO public.feature_status_events (request_id, status, note)
  VALUES (p_source, v_source.status, 'Combined into "' || v_target.title || '".');
END;
$$;

-- Admin: who asked for this, their reasons, and whether they use OrderFlow actively.
-- Full email only for the person who posted it and allowed contact.
CREATE OR REPLACE FUNCTION public.fr_admin_request_people(p_request_id uuid)
RETURNS TABLE (
  user_id uuid,
  label text,
  email text,
  role text,
  reason text,
  active boolean,
  joined_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_has_orders boolean := to_regclass('public.orders') IS NOT NULL;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'fr_forbidden: Only the developer can see who asked.';
  END IF;

  RETURN QUERY
  WITH people AS (
    SELECT r.user_id AS uid, 'requester'::text AS prole, r.created_at AS at,
           r.user_email AS remail, r.contact_ok AS rcontact
    FROM public.feature_requests r WHERE r.id = p_request_id
    UNION ALL
    SELECT v.user_id, 'me_too', v.created_at, NULL::text, false
    FROM public.feature_votes v
    WHERE v.request_id = p_request_id
      AND v.user_id <> (SELECT r2.user_id FROM public.feature_requests r2 WHERE r2.id = p_request_id)
  )
  SELECT
    p.uid,
    public.fr_mask_email(COALESCE(p.remail, u.email::text)),
    CASE WHEN p.prole = 'requester' AND p.rcontact THEN COALESCE(p.remail, u.email::text) ELSE NULL END,
    p.prole,
    rs.reason,
    CASE WHEN v_has_orders THEN public.fr_user_is_active(p.uid) ELSE false END,
    p.at
  FROM people p
  LEFT JOIN auth.users u ON u.id = p.uid
  LEFT JOIN public.feature_request_reasons rs ON rs.request_id = p_request_id AND rs.user_id = p.uid
  ORDER BY (p.prole = 'requester') DESC, (rs.reason IS NOT NULL) DESC, p.at ASC
  LIMIT 200;
END;
$$;

-- Active = created an order in the last 30 days. Separate so the query above never
-- references public.orders on projects that do not have it.
CREATE OR REPLACE FUNCTION public.fr_user_is_active(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v boolean := false;
BEGIN
  IF to_regclass('public.orders') IS NULL THEN
    RETURN false;
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.orders WHERE user_id = $1 AND created_at > now() - interval ''30 days'')'
    INTO v USING p_user;
  RETURN COALESCE(v, false);
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

-- Admin: list of conversations, newest first, with unread counts.
CREATE OR REPLACE FUNCTION public.fr_admin_threads()
RETURNS TABLE (
  thread_user_id uuid,
  label text,
  email text,
  last_body text,
  last_at timestamptz,
  last_from_admin boolean,
  unread int,
  total int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'fr_forbidden: Only the developer can see conversations.';
  END IF;
  RETURN QUERY
  SELECT
    m.thread_user_id,
    public.fr_mask_email(u.email),
    u.email::text,
    (SELECT m2.body FROM public.feature_messages m2 WHERE m2.thread_user_id = m.thread_user_id ORDER BY m2.created_at DESC LIMIT 1),
    max(m.created_at),
    (SELECT m3.from_admin FROM public.feature_messages m3 WHERE m3.thread_user_id = m.thread_user_id ORDER BY m3.created_at DESC LIMIT 1),
    count(*) FILTER (WHERE NOT m.read_by_admin)::int,
    count(*)::int
  FROM public.feature_messages m
  LEFT JOIN auth.users u ON u.id = m.thread_user_id
  GROUP BY m.thread_user_id, u.email
  ORDER BY max(m.created_at) DESC
  LIMIT 300;
END;
$$;

-- Mark a conversation as read. Users can only mark their own; the admin marks any.
CREATE OR REPLACE FUNCTION public.fr_mark_messages_read(p_thread_user uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'fr_forbidden: Sign in first.';
  END IF;
  IF public.is_platform_admin() AND p_thread_user IS NOT NULL AND p_thread_user <> auth.uid() THEN
    UPDATE public.feature_messages SET read_by_admin = true
    WHERE thread_user_id = p_thread_user AND NOT read_by_admin;
  ELSE
    UPDATE public.feature_messages SET read_by_user = true
    WHERE thread_user_id = auth.uid() AND from_admin AND NOT read_by_user;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fr_admin_set_status(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fr_admin_merge(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fr_admin_request_people(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fr_user_is_active(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fr_admin_threads() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fr_mark_messages_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fr_admin_set_status(uuid, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fr_admin_merge(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fr_admin_request_people(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fr_user_is_active(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fr_admin_threads() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fr_mark_messages_read(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
