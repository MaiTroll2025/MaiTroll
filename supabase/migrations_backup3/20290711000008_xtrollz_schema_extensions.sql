-- ============================================================
-- XTROLLZ SCHEMA EXTENSIONS
-- Adds missing stream fields, user profile XTrollz fields,
-- rules acceptance table, and core RPCs.
-- ============================================================

BEGIN;

-- xtrollz_streams: add missing fields for LiveKit integration and discovery
ALTER TABLE public.xtrollz_streams
  ADD COLUMN IF NOT EXISTS livekit_room_name text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS streamer_display_name text,
  ADD COLUMN IF NOT EXISTS profile_image_url text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'offline';

CREATE INDEX IF NOT EXISTS idx_xtrollz_streams_livekit_room_name
  ON public.xtrollz_streams(livekit_room_name);

CREATE INDEX IF NOT EXISTS idx_xtrollz_streams_status
  ON public.xtrollz_streams(status);

-- user_profiles: add XTrollz-specific fields
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS xtrollz_access_status text DEFAULT 'none'
    CHECK (xtrollz_access_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text, 'denied'::text, 'suspended'::text, 'banned'::text])),
  ADD COLUMN IF NOT EXISTS xtrollz_broadcaster_status text DEFAULT 'none'
    CHECK (xtrollz_broadcaster_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text, 'denied'::text, 'revoked'::text])),
  ADD COLUMN IF NOT EXISTS age_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_profiles_xtrollz_access_status
  ON public.user_profiles(xtrollz_access_status);

-- xtrollz_favorites: track user favorites
CREATE TABLE IF NOT EXISTS public.xtrollz_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streamer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, streamer_id)
);

CREATE INDEX IF NOT EXISTS idx_xtrollz_favorites_user_id
  ON public.xtrollz_favorites(user_id);

CREATE INDEX IF NOT EXISTS idx_xtrollz_favorites_streamer_id
  ON public.xtrollz_favorites(streamer_id);

ALTER TABLE public.xtrollz_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own XTrollz favorites"
ON public.xtrollz_favorites;

CREATE POLICY "Users can view own XTrollz favorites"
ON public.xtrollz_favorites
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own XTrollz favorites"
ON public.xtrollz_favorites;

CREATE POLICY "Users can insert own XTrollz favorites"
ON public.xtrollz_favorites
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own XTrollz favorites"
ON public.xtrollz_favorites;

CREATE POLICY "Users can delete own XTrollz favorites"
ON public.xtrollz_favorites
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.xtrollz_favorites TO authenticated;
GRANT ALL ON public.xtrollz_favorites TO service_role;

-- xtrollz_rules_acceptance table
CREATE TABLE IF NOT EXISTS public.xtrollz_rules_acceptance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rules_version text NOT NULL DEFAULT '1.0',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_xtrollz_rules_acceptance_user_id
  ON public.xtrollz_rules_acceptance(user_id);

ALTER TABLE public.xtrollz_rules_acceptance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own XTrollz rules acceptance"
ON public.xtrollz_rules_acceptance;

CREATE POLICY "Users can view own XTrollz rules acceptance"
ON public.xtrollz_rules_acceptance
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own XTrollz rules acceptance"
ON public.xtrollz_rules_acceptance;

CREATE POLICY "Users can insert own XTrollz rules acceptance"
ON public.xtrollz_rules_acceptance
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON public.xtrollz_rules_acceptance TO authenticated;
GRANT ALL ON public.xtrollz_rules_acceptance TO service_role;

-- ============================================================
-- RPC: xtrollz_dob_gate_get_status
-- Returns coarse access status for the XTrollz home page.
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_dob_gate_get_status(
  p_user_id uuid
)
RETURNS TABLE(
  result text,
  application_status text,
  access_status text,
  is_age_verified boolean,
  is_identity_verified boolean,
  rules_accepted boolean,
  can_access boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    result := 'not_authenticated';
    application_status := NULL;
    access_status := NULL;
    is_age_verified := false;
    is_identity_verified := false;
    rules_accepted := false;
    can_access := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT
    a.status,
    up.xtrollz_access_status,
    up.age_verified,
    up.identity_verified,
    EXISTS (
      SELECT 1 FROM public.xtrollz_rules_acceptance ra
      WHERE ra.user_id = p_user_id
    )
  INTO
    application_status,
    access_status,
    is_age_verified,
    is_identity_verified,
    rules_accepted
  FROM public.xtrollz_applications a
  JOIN public.user_profiles up ON up.id = p_user_id
  WHERE a.user_id = p_user_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF application_status IS NULL THEN
    result := 'missing_application';
    can_access := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF application_status IN ('denied', 'revoked', 'expired') THEN
    result := 'application_denied';
    can_access := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF application_status IN ('draft', 'payment_pending', 'payment_failed') THEN
    result := 'pending_application';
    can_access := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF application_status IN ('submitted', 'under_review', 'more_information_required') THEN
    result := 'pending_application';
    can_access := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF application_status = 'approved' THEN
    IF NOT is_age_verified THEN
      result := 'dob_required';
      can_access := false;
      RETURN NEXT;
      RETURN;
    END IF;
    IF NOT is_identity_verified THEN
      result := 'restricted';
      can_access := false;
      RETURN NEXT;
      RETURN;
    END IF;
    IF NOT rules_accepted THEN
      result := 'rules_acceptance_required';
      can_access := false;
      RETURN NEXT;
      RETURN;
    END IF;
    IF access_status IN ('suspended', 'banned') THEN
      result := access_status;
      can_access := false;
      RETURN NEXT;
      RETURN;
    END IF;
    result := 'approved';
    can_access := true;
    RETURN NEXT;
    RETURN;
  END IF;

  result := 'restricted';
  can_access := false;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_dob_gate_get_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_dob_gate_get_status(uuid) TO service_role;

-- ============================================================
-- RPC: xtrollz_verify_dob
-- Validates DOB and marks age_verified if 21+.
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_verify_dob(
  p_user_id uuid,
  p_entered_dob text
)
RETURNS TABLE(
  result text,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app_dob date;
  v_entered_dob date;
  v_age integer;
  v_application_status text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    result := 'not_authenticated';
    message := 'Not authenticated';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT date_of_birth, status
  INTO v_app_dob, v_application_status
  FROM public.xtrollz_applications
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_application_status IS NULL OR v_application_status != 'approved' THEN
    result := 'restricted';
    message := 'Application not approved';
    RETURN NEXT;
    RETURN;
  END IF;

  BEGIN
    v_entered_dob := p_entered_dob::date;
  EXCEPTION WHEN OTHERS THEN
    result := 'dob_mismatch';
    message := 'Invalid date format';
    RETURN NEXT;
  END;

  IF v_entered_dob != v_app_dob THEN
    result := 'dob_mismatch';
    message := 'Date of birth does not match';
    RETURN NEXT;
    RETURN;
  END IF;

  v_age := DATE_PART('year', AGE(CURRENT_DATE, v_entered_dob));

  IF v_age < 21 THEN
    result := 'underage';
    message := 'Must be 21 or older';
    UPDATE public.user_profiles
    SET age_verified = false, updated_at = now()
    WHERE id = p_user_id;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.user_profiles
  SET age_verified = true, updated_at = now()
  WHERE id = p_user_id;

  IF EXISTS (
    SELECT 1 FROM public.xtrollz_rules_acceptance ra
    WHERE ra.user_id = p_user_id
  ) THEN
    UPDATE public.user_profiles
    SET identity_verified = true, updated_at = now()
    WHERE id = p_user_id;
  END IF;

  result := 'approved';
  message := 'Access granted';
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_verify_dob(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_verify_dob(uuid, text) TO service_role;

-- ============================================================
-- RPC: xtrollz_get_live_streams
-- Returns metadata for all currently live XTrollz streams.
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_get_live_streams()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  title text,
  description text,
  category text,
  is_private boolean,
  viewer_count integer,
  started_at timestamptz,
  cover_image_url text,
  thumbnail_url text,
  streamer_display_name text,
  profile_image_url text,
  tags text[],
  status text,
  livekit_room_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.user_id, s.title, s.description, s.category,
    s.is_private, s.viewer_count, s.started_at,
    s.cover_image_url, s.thumbnail_url, s.streamer_display_name,
    s.profile_image_url, s.tags, s.status, s.livekit_room_name,
    s.created_at, s.updated_at
  FROM public.xtrollz_streams s
  WHERE s.status = 'live'
  ORDER BY s.viewer_count DESC, s.started_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_get_live_streams() TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_get_live_streams() TO service_role;

-- ============================================================
-- RPC: xtrollz_get_favorites
-- Returns favorite streamers for the current user.
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_get_favorites(
  p_user_id uuid
)
RETURNS TABLE(
  streamer_id uuid,
  display_name text,
  avatar_url text,
  is_live boolean,
  title text,
  category text,
  viewer_count integer,
  last_live_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    f.streamer_id,
    COALESCE(up.display_name, up.username, 'Unknown') as display_name,
    up.avatar_url,
    EXISTS (
      SELECT 1 FROM public.xtrollz_streams s
      WHERE s.user_id = f.streamer_id AND s.status = 'live'
    ) as is_live,
    (
      SELECT s.title FROM public.xtrollz_streams s
      WHERE s.user_id = f.streamer_id AND s.status = 'live'
      ORDER BY s.started_at DESC LIMIT 1
    ) as title,
    (
      SELECT s.category FROM public.xtrollz_streams s
      WHERE s.user_id = f.streamer_id AND s.status = 'live'
      ORDER BY s.started_at DESC LIMIT 1
    ) as category,
    (
      SELECT s.viewer_count FROM public.xtrollz_streams s
      WHERE s.user_id = f.streamer_id AND s.status = 'live'
      ORDER BY s.started_at DESC LIMIT 1
    ) as viewer_count,
    (
      SELECT MAX(s.started_at) FROM public.xtrollz_streams s
      WHERE s.user_id = f.streamer_id
    ) as last_live_at,
    f.created_at
  FROM public.xtrollz_favorites f
  JOIN public.user_profiles up ON up.id = f.streamer_id
  WHERE f.user_id = p_user_id
  ORDER BY f.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_get_favorites(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_get_favorites(uuid) TO service_role;

-- ============================================================
-- RPC: xtrollz_toggle_favorite
-- Adds or removes a streamer from favorites.
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_toggle_favorite(
  p_user_id uuid,
  p_streamer_id uuid
)
RETURNS TABLE(
  is_favorited boolean,
  streamer_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    is_favorited := false;
    streamer_id := p_streamer_id;
    RETURN NEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.xtrollz_favorites f
    WHERE f.user_id = p_user_id AND f.streamer_id = p_streamer_id
  ) THEN
    DELETE FROM public.xtrollz_favorites
    WHERE user_id = p_user_id AND streamer_id = p_streamer_id;
    is_favorited := false;
  ELSE
    INSERT INTO public.xtrollz_favorites (user_id, streamer_id)
    VALUES (p_user_id, p_streamer_id);
    is_favorited := true;
  END IF;

  streamer_id := p_streamer_id;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_toggle_favorite(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_toggle_favorite(uuid, uuid) TO service_role;

-- ============================================================
-- RPC: xtrollz_check_viewer_access
-- Validates all viewer access conditions before joining a stream.
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_check_viewer_access(
  p_stream_id uuid,
  p_user_id uuid
)
RETURNS TABLE(
  allowed boolean,
  reason text,
  stream_status text,
  streamer_id uuid,
  is_live boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream record;
  v_profile record;
  v_blocked boolean;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    allowed := false;
    reason := 'not_authenticated';
    stream_status := NULL;
    streamer_id := NULL;
    is_live := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF v_profile.xtrollz_access_status IN ('suspended', 'banned')
     OR v_profile.is_banned = true
     OR v_profile.account_state IN ('banned', 'jailed') THEN
    allowed := false;
    reason := 'account_suspended_or_banned';
    stream_status := NULL;
    streamer_id := NULL;
    is_live := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_profile.age_verified = false OR v_profile.identity_verified = false THEN
    allowed := false;
    reason := 'not_verified';
    stream_status := NULL;
    streamer_id := NULL;
    is_live := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_stream
  FROM public.xtrollz_streams
  WHERE id = p_stream_id;

  IF v_stream.id IS NULL THEN
    allowed := false;
    reason := 'stream_not_found';
    stream_status := NULL;
    streamer_id := NULL;
    is_live := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_stream.status != 'live' THEN
    allowed := false;
    reason := 'stream_not_active';
    stream_status := v_stream.status;
    streamer_id := v_stream.user_id;
    is_live := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.utromail_blocked_users bu
    WHERE (bu.user_id = p_user_id AND bu.blocked_user_id = v_stream.user_id)
       OR (bu.user_id = v_stream.user_id AND bu.blocked_user_id = p_user_id)
  ) INTO v_blocked;

  IF v_blocked THEN
    allowed := false;
    reason := 'blocked';
    stream_status := v_stream.status;
    streamer_id := v_stream.user_id;
    is_live := true;
    RETURN NEXT;
    RETURN;
  END IF;

  allowed := true;
  reason := 'ok';
  stream_status := v_stream.status;
  streamer_id := v_stream.user_id;
  is_live := true;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_check_viewer_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_check_viewer_access(uuid, uuid) TO service_role;

-- ============================================================
-- RPC: xtrollz_start_broadcast
-- Validates broadcaster preconditions and creates a live stream.
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_start_broadcast(
  p_user_id uuid,
  p_title text,
  p_category text,
  p_description text DEFAULT NULL,
  p_is_private boolean DEFAULT false,
  p_tags text[] DEFAULT '{}'
)
RETURNS TABLE(
  stream_id uuid,
  livekit_room_name text,
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_application record;
  v_existing_stream uuid;
  v_room_name text;
  v_stream_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    stream_id := NULL;
    livekit_room_name := NULL;
    success := false;
    message := 'not_authenticated';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF v_profile.xtrollz_access_status != 'approved'
     AND NOT EXISTS (
       SELECT 1 FROM public.xtrollz_applications a
       WHERE a.user_id = p_user_id AND a.status = 'approved'
     ) THEN
    success := false;
    message := 'application_not_approved';
    stream_id := NULL;
    livekit_room_name := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_profile.age_verified = false OR v_profile.identity_verified = false THEN
    success := false;
    message := 'not_verified';
    stream_id := NULL;
    livekit_room_name := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_profile.xtrollz_access_status IN ('suspended', 'banned')
     OR v_profile.is_banned = true
     OR v_profile.account_state IN ('banned', 'jailed') THEN
    success := false;
    message := 'account_suspended_or_banned';
    stream_id := NULL;
    livekit_room_name := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_application
  FROM public.xtrollz_applications
  WHERE user_id = p_user_id AND status = 'approved'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_application.xtrollz_role != 'streamer' THEN
    success := false;
    message := 'not_a_streamer';
    stream_id := NULL;
    livekit_room_name := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT id INTO v_existing_stream
  FROM public.xtrollz_streams
  WHERE user_id = p_user_id AND status IN ('live', 'starting')
  LIMIT 1;

  IF v_existing_stream IS NOT NULL THEN
    success := false;
    message := 'already_broadcasting';
    stream_id := v_existing_stream;
    livekit_room_name := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  v_room_name := 'xtrollz-' || p_user_id::text || '-' || gen_random_uuid()::text;

  INSERT INTO public.xtrollz_streams (
    user_id, title, description, category, is_private,
    status, livekit_room_name, tags, started_at
  )
  VALUES (
    p_user_id, p_title, p_description, p_category, p_is_private,
    'starting', v_room_name, p_tags, now()
  )
  RETURNING id INTO v_stream_id;

  success := true;
  message := 'ok';
  stream_id := v_stream_id;
  livekit_room_name := v_room_name;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_start_broadcast(uuid, text, text, text, boolean, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_start_broadcast(uuid, text, text, text, boolean, text[]) TO service_role;

-- ============================================================
-- RPC: xtrollz_end_broadcast
-- Ends an active broadcast.
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_end_broadcast(
  p_stream_id uuid,
  p_user_id uuid
)
RETURNS TABLE(
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream record;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    success := false;
    message := 'not_authenticated';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_stream
  FROM public.xtrollz_streams
  WHERE id = p_stream_id AND user_id = p_user_id;

  IF v_stream.id IS NULL THEN
    success := false;
    message := 'stream_not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_stream.status NOT IN ('live', 'starting') THEN
    success := false;
    message := 'stream_not_active';
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.xtrollz_streams
  SET status = 'ended', ended_at = now(), updated_at = now()
  WHERE id = p_stream_id;

  success := true;
  message := 'ok';
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_end_broadcast(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_end_broadcast(uuid, uuid) TO service_role;

-- ============================================================
-- RPC: xtrollz_update_stream_status
-- Updates stream status (e.g., starting -> live).
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_update_stream_status(
  p_stream_id uuid,
  p_user_id uuid,
  p_status text
)
RETURNS TABLE(
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream record;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    success := false;
    message := 'not_authenticated';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_status NOT IN ('live', 'offline', 'ended') THEN
    success := false;
    message := 'invalid_status';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_stream
  FROM public.xtrollz_streams
  WHERE id = p_stream_id AND user_id = p_user_id;

  IF v_stream.id IS NULL THEN
    success := false;
    message := 'stream_not_found';
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.xtrollz_streams
  SET status = p_status,
      started_at = CASE WHEN p_status = 'live' AND started_at IS NULL THEN now() ELSE started_at END,
      ended_at = CASE WHEN p_status = 'ended' THEN now() ELSE ended_at END,
      updated_at = now()
  WHERE id = p_stream_id;

  success := true;
  message := 'ok';
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_update_stream_status(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_update_stream_status(uuid, uuid, text) TO service_role;

-- ============================================================
-- RPC: xtrollz_search_streamers
-- Search streamers by display name or username.
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_search_streamers(
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  is_live boolean,
  title text,
  category text,
  viewer_count integer,
  livekit_room_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id as user_id,
    COALESCE(up.display_name, up.username, 'Unknown') as display_name,
    up.avatar_url,
    EXISTS (
      SELECT 1 FROM public.xtrollz_streams s
      WHERE s.user_id = up.id AND s.status = 'live'
    ) as is_live,
    (
      SELECT s.title FROM public.xtrollz_streams s
      WHERE s.user_id = up.id AND s.status = 'live'
      ORDER BY s.started_at DESC LIMIT 1
    ) as title,
    (
      SELECT s.category FROM public.xtrollz_streams s
      WHERE s.user_id = up.id AND s.status = 'live'
      ORDER BY s.started_at DESC LIMIT 1
    ) as category,
    (
      SELECT s.viewer_count FROM public.xtrollz_streams s
      WHERE s.user_id = up.id AND s.status = 'live'
      ORDER BY s.started_at DESC LIMIT 1
    ) as viewer_count,
    (
      SELECT s.livekit_room_name FROM public.xtrollz_streams s
      WHERE s.user_id = up.id AND s.status = 'live'
      ORDER BY s.started_at DESC LIMIT 1
    ) as livekit_room_name
  FROM public.user_profiles up
  JOIN public.xtrollz_applications a ON a.user_id = up.id AND a.status = 'approved'
  WHERE
    (up.display_name ILIKE '%' || p_query || '%'
     OR up.username ILIKE '%' || p_query || '%')
  ORDER BY is_live DESC, display_name ASC
  LIMIT LEAST(p_limit, 50);
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_search_streamers(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_search_streamers(text, integer) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
