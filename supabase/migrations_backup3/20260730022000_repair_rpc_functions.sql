-- ============================================================================
-- Migration: repair_rpc_functions
-- Creates missing RPC functions referenced by the frontend
-- Applied: 2026-07-30
-- ============================================================================

-- record_replay_view: Track replay views for replay page and recording
CREATE OR REPLACE FUNCTION public.record_replay_view(
  p_creator_user_id UUID,
  p_stream_id UUID,
  p_viewer_user_id UUID,
  p_minutes_watched NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_replay RECORD;
  v_view_count INTEGER;
BEGIN
  -- Update view count on broadcast_replays
  UPDATE public.broadcast_replays
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE stream_id = p_stream_id;

  -- Get updated view count
  SELECT view_count INTO v_view_count
  FROM public.broadcast_replays
  WHERE stream_id = p_stream_id;

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'view_count', v_view_count
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_replay_view(UUID, UUID, UUID, NUMERIC) TO authenticated;

-- can_user_record: Check if user can record a stream
CREATE OR REPLACE FUNCTION public.can_user_record(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_record BOOLEAN := true;
  v_reason TEXT := '';
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id;

  IF v_user IS NULL THEN
    v_can_record := false;
    v_reason := 'User profile not found';
  ELSIF v_user.is_banned THEN
    v_can_record := false;
    v_reason := 'User is banned';
  ELSIF v_user.ban_expires_at > NOW() THEN
    v_can_record := false;
    v_reason := 'User ban is still active';
  END IF;

  RETURN jsonb_build_object(
    'can_record', v_can_record,
    'reason', v_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_user_record(UUID) TO authenticated;

-- grant_xp: Grant XP to a user
CREATE OR REPLACE FUNCTION public.grant_xp(
  p_user_id UUID,
  p_amount INTEGER,
  p_source_type TEXT DEFAULT 'manual',
  p_source_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_new_xp BIGINT;
  v_new_level INT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing user_id');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be positive');
  END IF;

  SELECT * INTO v_user FROM public.user_profiles WHERE id = p_user_id;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  -- Update user_stats
  UPDATE public.user_stats
  SET xp_total = xp_total + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Check for level up
  SELECT xp_total, level INTO v_new_xp, v_new_level
  FROM public.user_stats
  WHERE user_id = p_user_id;

  -- Insert XP log
  INSERT INTO public.xp_log (user_id, amount, source_type, source_id, metadata, created_at)
  VALUES (p_user_id, p_amount, p_source_type, p_source_id, p_metadata, NOW());

  RETURN jsonb_build_object(
    'success', true,
    'new_xp', v_new_xp,
    'new_level', v_new_level
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_xp(UUID, INTEGER, TEXT, UUID, JSONB) TO authenticated;

-- end_stream: End a live stream
CREATE OR REPLACE FUNCTION public.end_stream(p_stream_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream RECORD;
BEGIN
  IF p_stream_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing stream_id');
  END IF;

  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
  IF v_stream IS NULL THEN
    RETURN jsonb_build_object('error', 'Stream not found');
  END IF;

  IF v_stream.status = 'ended' THEN
    RETURN jsonb_build_object('error', 'Stream already ended');
  END IF;

  UPDATE public.streams
  SET status = 'ended',
      ended_at = NOW(),
      updated_at = NOW()
  WHERE id = p_stream_id;

  RETURN jsonb_build_object(
    'success', true,
    'stream_id', p_stream_id,
    'status', 'ended'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_stream(UUID) TO authenticated;

-- Remove overloaded stream join/leave variants so Supabase can resolve a single canonical signature.
DROP FUNCTION IF EXISTS public.join_stream_as_viewer(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.join_stream_as_viewer(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.leave_stream_as_viewer(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.leave_stream_as_viewer(uuid, uuid, text);

-- join_stream_as_viewer: Allow a user to join a stream as a viewer.
-- Canonical guest_id argument is TEXT to match the app's nullable guest identity calls.
CREATE OR REPLACE FUNCTION public.join_stream_as_viewer(
  p_stream_id UUID,
  p_user_id UUID,
  p_guest_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream RECORD;
  v_viewer RECORD;
BEGIN
  IF p_stream_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing stream_id');
  END IF;

  IF p_user_id IS NULL AND (p_guest_id IS NULL OR trim(p_guest_id) = '') THEN
    RETURN jsonb_build_object('error', 'Missing user_id or guest_id');
  END IF;

  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
  IF v_stream IS NULL THEN
    RETURN jsonb_build_object('error', 'Stream not found');
  END IF;

  IF v_stream.status IS DISTINCT FROM 'live' THEN
    RETURN jsonb_build_object('error', 'Stream is not live');
  END IF;

  SELECT * INTO v_viewer FROM public.stream_viewers
  WHERE stream_id = p_stream_id
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_guest_id IS NOT NULL AND guest_id = p_guest_id)
    );

  IF v_viewer IS NOT NULL THEN
    UPDATE public.stream_viewers
    SET last_seen = NOW()
    WHERE id = v_viewer.id;
  ELSE
    INSERT INTO public.stream_viewers (stream_id, user_id, guest_id, joined_at, last_seen)
    VALUES (p_stream_id, p_user_id, NULLIF(p_guest_id, ''), NOW(), NOW());
  END IF;

  UPDATE public.streams
  SET current_viewers = (SELECT COUNT(*) FROM public.stream_viewers WHERE stream_id = p_stream_id),
      updated_at = NOW()
  WHERE id = p_stream_id;

  RETURN jsonb_build_object(
    'success', true,
    'stream_id', p_stream_id,
    'user_id', p_user_id,
    'guest_id', p_guest_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_stream_as_viewer(UUID, UUID, TEXT) TO authenticated, anon, service_role;

-- leave_stream_as_viewer: Allow a user to leave a stream.
CREATE OR REPLACE FUNCTION public.leave_stream_as_viewer(
  p_stream_id UUID,
  p_user_id UUID,
  p_guest_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_stream_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Missing stream_id');
  END IF;

  DELETE FROM public.stream_viewers
  WHERE stream_id = p_stream_id
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id)
      OR (p_guest_id IS NOT NULL AND guest_id = p_guest_id)
    );

  UPDATE public.streams
  SET current_viewers = GREATEST(0, (SELECT COUNT(*) FROM public.stream_viewers WHERE stream_id = p_stream_id)),
      updated_at = NOW()
  WHERE id = p_stream_id;

  RETURN jsonb_build_object(
    'success', true,
    'stream_id', p_stream_id,
    'user_id', p_user_id,
    'guest_id', p_guest_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_stream_as_viewer(UUID, UUID, TEXT) TO authenticated, anon, service_role;

-- Compatibility RPCs used by the officer and court pages.
CREATE OR REPLACE FUNCTION public.manual_clock_in(p_officer_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_session_id uuid;
BEGIN
  IF p_officer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Missing officer id');
  END IF;

  SELECT id INTO v_active_session_id
  FROM public.officer_work_sessions
  WHERE officer_id = p_officer_id AND clock_out IS NULL
  LIMIT 1;

  IF v_active_session_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Officer already has an active session');
  END IF;

  INSERT INTO public.officer_work_sessions (officer_id, clock_in, status)
  VALUES (p_officer_id, NOW(), 'active');

  UPDATE public.user_profiles
  SET is_officer_active = true,
      last_activity_at = NOW()
  WHERE id = p_officer_id;

  RETURN jsonb_build_object('success', true, 'message', 'Clocked in successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.manual_clock_in(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.manual_clock_out(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.officer_work_sessions%ROWTYPE;
  v_now timestamptz := NOW();
  v_hours numeric;
BEGIN
  SELECT * INTO v_session
  FROM public.officer_work_sessions
  WHERE id = p_session_id;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Session not found');
  END IF;

  v_hours := EXTRACT(EPOCH FROM (v_now - v_session.clock_in)) / 3600;
  IF v_hours < 0 THEN v_hours := 0; END IF;

  UPDATE public.officer_work_sessions
  SET clock_out = v_now,
      status = 'completed',
      hours_worked = COALESCE(hours_worked, 0) + v_hours,
      updated_at = NOW()
  WHERE id = p_session_id;

  UPDATE public.user_profiles
  SET is_officer_active = false,
      last_activity_at = v_now
  WHERE id = v_session.officer_id;

  RETURN jsonb_build_object('success', true, 'message', 'Clocked out successfully', 'hours', v_hours);
END;
$$;

GRANT EXECUTE ON FUNCTION public.manual_clock_out(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.join_court_session(
  p_court_session_id uuid,
  p_role text DEFAULT 'observer'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.court_participants%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_existing
  FROM public.court_participants
  WHERE court_session_id = p_court_session_id AND user_id = v_user_id
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.court_participants
    SET role = p_role,
        updated_at = NOW()
    WHERE id = v_existing.id;

    RETURN jsonb_build_object('success', true, 'message', 'Updated participant role', 'role', p_role);
  END IF;

  INSERT INTO public.court_participants (court_session_id, user_id, role, joined_at, updated_at)
  VALUES (p_court_session_id, v_user_id, p_role, NOW(), NOW());

  RETURN jsonb_build_object('success', true, 'message', 'Joined court session', 'role', p_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_court_session(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_court_case(
  p_case_type text,
  p_court_session_id uuid,
  p_defendant_id uuid,
  p_plaintiff_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_id uuid;
BEGIN
  INSERT INTO public.court_cases (
    case_type,
    defendant_id,
    plaintiff_id,
    status,
    created_at
  )
  VALUES (
    COALESCE(p_case_type, 'general'),
    p_defendant_id,
    COALESCE(p_plaintiff_id, auth.uid()),
    'pending',
    NOW()
  )
  RETURNING id INTO v_case_id;

  RETURN jsonb_build_object('success', true, 'case_id', v_case_id, 'status', 'pending');
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_court_case(text, uuid, uuid, uuid) TO authenticated, service_role;

-- update_stream_viewer_count: Update viewer count directly
CREATE OR REPLACE FUNCTION public.update_stream_viewer_count(
  p_count INTEGER,
  p_stream_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.streams
  SET current_viewers = p_count,
      viewer_count = p_count,
      updated_at = NOW()
  WHERE id = p_stream_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_stream_viewer_count(INTEGER, UUID) TO authenticated;

-- Grant all new RPCs to authenticated users
GRANT EXECUTE ON FUNCTION public.record_replay_view(UUID, UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_record(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_xp(UUID, INTEGER, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_stream(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_stream_as_viewer(UUID, UUID, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.leave_stream_as_viewer(UUID, UUID, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.update_stream_viewer_count(INTEGER, UUID) TO authenticated;