-- =============================================================================
-- Migration: 2-broadcaster cap, admin bypass, remove signup caps
-- =============================================================================

-- 1. Update start_broadcast_with_capacity_check to exempt admins
CREATE OR REPLACE FUNCTION public.start_broadcast_with_capacity_check(
  p_stream_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream public.streams%ROWTYPE;
  v_active integer;
  v_cap integer;
  v_cap_enabled boolean;
  v_restrictions_disabled boolean;
  v_is_admin boolean;
BEGIN
  IF p_stream_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'missing_stream_id',
      'active_broadcasts', 0, 'start_cap', NULL);
  END IF;

  -- Lock the caller's stream row (also enforces ownership below).
  SELECT *
    INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'stream_not_found',
      'active_broadcasts', 0, 'start_cap', NULL);
  END IF;

  -- Only the owner (or a service role) may start/activate this stream.
  IF v_stream.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_stream_owner',
      'active_broadcasts', 0, 'start_cap', NULL);
  END IF;

  -- Reconnecting to an already-active owned stream: never block.
  IF v_stream.is_live IS NOT DISTINCT FROM true
     AND COALESCE(v_stream.status, '') = 'live' THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'already_live',
      'active_broadcasts', 0, 'start_cap', NULL);
  END IF;

  -- Check if the caller is an admin (admins bypass the start cap)
  SELECT (is_admin = true OR role IN ('admin','superadmin','ceo','lead_troll_officer','troll_officer','secretary','moderator','agency_hr','agency_hr_manager','agency_leader'))
    INTO v_is_admin
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF v_is_admin THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'admin_bypass',
      'active_broadcasts', 0, 'start_cap', NULL);
  END IF;

  -- Read configured restrictions (same settings used by useBroadcastViewerCap).
  v_restrictions_disabled := public._cap_setting_bool('broadcast_all_restrictions_disabled', false);
  v_cap_enabled := public._cap_setting_bool('broadcast_start_cap_enabled', false);
  v_cap := COALESCE(public._cap_setting_numeric('broadcast_start_cap_max', NULL)::integer, NULL);

  -- Count currently active broadcasts under a shared lock so concurrent starts
  -- serialize. Lock an arbitrary but stable settings row (the start cap max)
  -- to obtain a single serialization point without scanning every stream row.
  PERFORM 1
  FROM public.admin_settings
  WHERE setting_key = 'broadcast_start_cap_max'
  FOR UPDATE;

  SELECT COUNT(*)
    INTO v_active
  FROM public.streams s
  WHERE s.is_live IS NOT DISTINCT FROM true
    AND COALESCE(s.status, '') = 'live';

  IF NOT v_restrictions_disabled AND v_cap_enabled AND v_cap IS NOT NULL AND v_active >= v_cap THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'broadcast_start_cap_reached',
      'active_broadcasts', v_active, 'start_cap', v_cap
    );
  END IF;

  -- Atomically transition this stream to live. No hardcoded duration cap.
  UPDATE public.streams
  SET is_live = true,
      status = 'live',
      started_at = COALESCE(started_at, now())
  WHERE id = p_stream_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'started',
    'active_broadcasts', v_active,
    'start_cap', v_cap
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_broadcast_with_capacity_check(uuid) TO authenticated, service_role;

-- 2. Set start cap to 10 broadcasters, enabled, restrictions not disabled
INSERT INTO public.admin_settings (setting_key, setting_value, description, updated_at)
VALUES (
  'broadcast_start_cap_max',
  '{"value": 10}',
  'Max concurrent broadcasters',
  NOW()
)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = '{"value": 10}',
  updated_at = NOW();

INSERT INTO public.admin_settings (setting_key, setting_value, description, updated_at)
VALUES (
  'broadcast_start_cap_enabled',
  '{"enabled": true}',
  'Enable broadcast start cap',
  NOW()
)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = '{"enabled": true}',
  updated_at = NOW();

INSERT INTO public.admin_settings (setting_key, setting_value, description, updated_at)
VALUES (
  'broadcast_all_restrictions_disabled',
  '{"enabled": false}',
  'Master override to remove all broadcast restrictions',
  NOW()
)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = '{"enabled": false}',
  updated_at = NOW();

-- 3. Remove signup caps from platform_event (if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'platform_event'
      AND column_name = 'signup_cap'
  ) THEN
    ALTER TABLE public.platform_event DROP COLUMN IF EXISTS signup_cap;
  END IF;
END $$;

-- 4. Remove testing mode signup limits (if table/columns exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'testing_mode'
      AND column_name = 'signup_limit'
  ) THEN
    ALTER TABLE public.testing_mode DROP COLUMN IF EXISTS signup_limit;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'testing_mode'
      AND column_name = 'current_signups'
  ) THEN
    ALTER TABLE public.testing_mode DROP COLUMN IF EXISTS current_signups;
  END IF;
END $$;

-- 5. Set seat cap to 10 total boxes for broadcasts
INSERT INTO public.admin_settings (setting_key, setting_value, description, updated_at)
VALUES (
  'broadcast_seat_cap_max',
  '{"value": 10}',
  'Max total boxes per broadcast including broadcaster',
  NOW()
)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = '{"value": 10}',
  updated_at = NOW();

INSERT INTO public.admin_settings (setting_key, setting_value, description, updated_at)
VALUES (
  'broadcast_seat_cap_enabled',
  '{"enabled": true}',
  'Enable broadcast seat cap',
  NOW()
)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = '{"enabled": true}',
  updated_at = NOW();
