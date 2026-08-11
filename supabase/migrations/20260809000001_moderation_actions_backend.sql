-- ============================================================================
-- Mod Actions Backend — secure, idempotent migration
-- Authorizes ONLY these roles for Mod Actions:
--   ceo, admin, lead_troll_officer, troll_officer, secretary,
--   broadcaster, broadofficer, ceo_assistant, noah_assistant
--
-- Reuses existing tables. Does NOT create duplicate tables, duplicate
-- columns, duplicate RPC overloads, or a second moderation system.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. Guard: these table references must exist. We add columns idempotently.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Strict Mod Actions role helper (normalized role comparison)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_modo_role(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = p_user_id
      AND (
        LOWER(COALESCE(role, '')) IN (
          'ceo','admin','lead_troll_officer','troll_officer','secretary',
          'broadcaster','broadofficer','ceo_assistant','noah_assistant'
        )
        OR LOWER(COALESCE(troll_role, '')) IN (
          'ceo','admin','lead_troll_officer','troll_officer','secretary',
          'broadcaster','broadofficer','ceo_assistant','noah_assistant'
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_modo_role(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1b. Ensure create_notification exists (defined separately in
-- 20270218000000_secure_notification_rpc.sql). This is a self-contained guard:
-- it only creates the function if it does not already exist, so it never
-- duplicates or overrides the existing definition.
-- ---------------------------------------------------------------------------
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'create_notification'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE OR REPLACE FUNCTION public.create_notification(
      p_user_id UUID,
      p_type TEXT,
      p_title TEXT,
      p_message TEXT,
      p_metadata JSONB DEFAULT '{}'::jsonb
    )
    RETURNS UUID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_id UUID;
    BEGIN
      IF p_message IS NULL OR p_message = '' THEN
        RAISE EXCEPTION 'Message cannot be empty';
      END IF;
      INSERT INTO public.notifications (
        user_id, type, title, message, metadata, is_read, created_at
      ) VALUES (
        p_user_id, p_type, p_title, p_message, p_metadata, false, now()
      )
      RETURNING id INTO v_id;
      RETURN v_id;
    END;
    $$;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, jsonb)
      TO authenticated, service_role;
  END IF;
END $guard$;

-- ---------------------------------------------------------------------------
-- 1c. Ensure is_stream_owner_or_admin exists (defined in
-- 20260801000000_mai_troll_moderation.sql / 20290712000001_stream_broadofficer_secure.sql).
-- Self-contained guard: only creates it if missing, so it never overrides the
-- existing definition.
-- ---------------------------------------------------------------------------
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_stream_owner_or_admin'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE OR REPLACE FUNCTION public.is_stream_owner_or_admin(
      p_stream_id uuid,
      p_user_id uuid
    )
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_actor_profile public.user_profiles%ROWTYPE;
      v_stream public.streams%ROWTYPE;
    BEGIN
      IF p_user_id IS NULL THEN
        p_user_id := auth.uid();
      END IF;
      IF p_user_id IS NULL THEN
        RETURN false;
      END IF;

      SELECT * INTO v_actor_profile
      FROM public.user_profiles
      WHERE id = p_user_id
      LIMIT 1;
      IF NOT FOUND THEN
        RETURN false;
      END IF;

      SELECT * INTO v_stream
      FROM public.streams
      WHERE id = p_stream_id
      LIMIT 1;
      IF NOT FOUND THEN
        RETURN false;
      END IF;

      IF v_actor_profile.is_admin = true OR v_actor_profile.role = 'admin' THEN
        RETURN true;
      END IF;
      IF v_actor_profile.role = 'ceo' THEN
        RETURN true;
      END IF;
      IF v_stream.user_id = p_user_id OR v_stream.broadcaster_id = p_user_id THEN
        RETURN true;
      END IF;
      IF v_actor_profile.role = 'lead_troll_officer' OR v_actor_profile.is_lead_officer = true THEN
        RETURN true;
      END IF;
      RETURN false;
    END;
    $$;
    GRANT EXECUTE ON FUNCTION public.is_stream_owner_or_admin(uuid, uuid) TO authenticated, service_role;
  END IF;
END $guard$;

-- ---------------------------------------------------------------------------
-- 2. Missing columns on existing tables (no new tables)
-- ---------------------------------------------------------------------------

-- streams: stream_channel (used by end_stream / broadofficer system messages)
ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS stream_channel TEXT;

-- user_profiles: moderation fields used by the component + updated_at
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mic_muted_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_kicked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS kicked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_kicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- chat_blocks: updated_at + stream-scoped unique index for ON CONFLICT
ALTER TABLE public.chat_blocks
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS chat_blocks_stream_user_uidx
  ON public.chat_blocks (stream_id, user_id);

-- stream_messages: allow system messages (broadofficer removal etc.)
ALTER TABLE public.stream_messages
  ADD COLUMN IF NOT EXISTS type TEXT;

CREATE INDEX IF NOT EXISTS idx_stream_messages_stream_created_at
  ON public.stream_messages (stream_id, created_at DESC);

-- broadcast_mod_actions: audit/display columns used by the component
ALTER TABLE public.broadcast_mod_actions
  ADD COLUMN IF NOT EXISTS action_name TEXT,
  ADD COLUMN IF NOT EXISTS actor_display_name TEXT,
  ADD COLUMN IF NOT EXISTS target_display_name TEXT,
  ADD COLUMN IF NOT EXISTS target_role_before TEXT,
  ADD COLUMN IF NOT EXISTS target_role_after TEXT,
  ADD COLUMN IF NOT EXISTS broadcast_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS livekit_room_name TEXT,
  ADD COLUMN IF NOT EXISTS previous_status TEXT,
  ADD COLUMN IF NOT EXISTS new_status TEXT,
  ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Widen broadcast_mod_actions.action_type CHECK to include backend actions.
DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'broadcast_mod_actions_action_type_check'
      AND conrelid = 'public.broadcast_mod_actions'::regclass
  ) THEN
    ALTER TABLE public.broadcast_mod_actions
      DROP CONSTRAINT broadcast_mod_actions_action_type_check;
  END IF;
END $guard$;

ALTER TABLE public.broadcast_mod_actions
  ADD CONSTRAINT broadcast_mod_actions_action_type_check
  CHECK (action_type IN (
    'disable_chat','enable_chat','kick','arrest',
    'disable_broadcast','enable_broadcast',
    'disable_hytrogame','enable_hytrogame',
    'disable_seat_joining','enable_seat_joining',
    'report','mute','unmute','warn','warning','platform_review','fine',
    'suspend_license','grant_license','remove_officer','set_to_user','end_stream'
  ));

-- user_driver_licenses: expiration + suspension metadata
ALTER TABLE public.user_driver_licenses
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- user_insurances: protection_type + issued_at + active unique for upsert
ALTER TABLE public.user_insurances
  ADD COLUMN IF NOT EXISTS protection_type TEXT DEFAULT 'car',
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ DEFAULT now();

-- Partial unique index over active rows so the grant upsert can target
-- (user_id, protection_type) without destroying insurance purchase history.
CREATE UNIQUE INDEX IF NOT EXISTS user_insurances_active_user_type_uidx
  ON public.user_insurances (user_id, protection_type)
  WHERE is_active = true;

-- broadcast_restrictions: stream-scoped fields + status
ALTER TABLE public.broadcast_restrictions
  ADD COLUMN IF NOT EXISTS stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- user_ip_tracking: geofence columns referenced by the component
ALTER TABLE public.user_ip_tracking
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- court_cases: allow criminal/pending used by the arrest flow
DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'court_cases_case_type_check'
      AND conrelid = 'public.court_cases'::regclass
  ) THEN
    ALTER TABLE public.court_cases DROP CONSTRAINT court_cases_case_type_check;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'court_cases_status_check'
      AND conrelid = 'public.court_cases'::regclass
  ) THEN
    ALTER TABLE public.court_cases DROP CONSTRAINT court_cases_status_check;
  END IF;
END $guard$;

ALTER TABLE public.court_cases
  ADD CONSTRAINT court_cases_case_type_check
  CHECK (case_type IN ('non_payment','eviction','lease_violation','criminal','civil'));
ALTER TABLE public.court_cases
  ADD CONSTRAINT court_cases_status_check
  CHECK (status IN ('open','ruled','dismissed','pending','in_session','resolved','closed','scheduled','appealed'));

-- jail: ensure all columns used by the component exist
ALTER TABLE public.jail
  ADD COLUMN IF NOT EXISTS sentence_days INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bond_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'moderate',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'jailed',
  ADD COLUMN IF NOT EXISTS arrested_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS court_date DATE,
  ADD COLUMN IF NOT EXISTS arrest_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS arrest_longitude DOUBLE PRECISION;

-- ---------------------------------------------------------------------------
-- 3. Audit helper (writes broadcast_mod_actions)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.modo_audit(
  p_action_type text,
  p_action_name text,
  p_actor_id uuid,
  p_target_user_id uuid,
  p_target_display_name text,
  p_target_role_before text,
  p_target_role_after text,
  p_broadcast_id uuid,
  p_livekit_room_name text,
  p_reason text,
  p_duration_minutes integer,
  p_previous_status text,
  p_new_status text,
  p_expires_at timestamptz,
  p_success boolean,
  p_error_message text,
  p_metadata jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_display text;
BEGIN
  SELECT COALESCE(role, 'unknown'), COALESCE(NULLIF(username, ''), NULLIF(full_name, ''), 'Unknown')
  INTO v_role, v_display
  FROM public.user_profiles
  WHERE id = p_actor_id;

  INSERT INTO public.broadcast_mod_actions (
    action_type, action_name, actor_id, actor_role, actor_display_name,
    target_user_id, target_display_name, target_role_before, target_role_after,
    broadcast_id, stream_id, livekit_room_name, reason, duration_minutes,
    previous_status, new_status, expires_at, success, error_message,
    metadata, created_at, updated_at
  ) VALUES (
    p_action_type, p_action_name, p_actor_id, v_role, v_display,
    p_target_user_id, p_target_display_name, p_target_role_before, p_target_role_after,
    p_broadcast_id, p_broadcast_id, p_livekit_room_name, p_reason, p_duration_minutes,
    p_previous_status, p_new_status, p_expires_at, p_success, p_error_message,
    COALESCE(p_metadata, '{}'::jsonb), now(), now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.modo_audit(
  text, text, uuid, uuid, text, text, text, uuid, text, text, integer,
  text, text, timestamptz, boolean, text, jsonb
) TO authenticated, service_role;

-- ============================================================================
-- 4. Secure RPCs used by the component / edge function
-- ============================================================================

-- ---------------------------------------------------------------------------
-- can_moderate_stream (repair to use strict role list + existing ownership)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_moderate_stream(
  p_stream_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_stream public.streams%ROWTYPE;
  v_owner uuid;
BEGIN
  IF p_user_id IS NULL THEN
    p_user_id := auth.uid();
  END IF;
  IF p_user_id IS NULL OR p_stream_id IS NULL THEN
    RETURN false;
  END IF;

SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Stream owner (broadcaster) moderates their own stream
  v_owner := COALESCE(v_stream.user_id, v_stream.broadcaster_id);
  IF v_owner = p_user_id THEN RETURN true; END IF;

  -- Global staff roles may moderate any stream: CEO, Admin, Lead, Troll Officer, Secretary
  IF public.is_modo_role_in(p_user_id, ARRAY[
    'ceo','admin','lead_troll_officer','troll_officer','secretary'
  ]) THEN
    RETURN true;
  END IF;

  -- Broadcaster role moderates their own active stream
  IF public.is_modo_role_in(p_user_id, ARRAY['broadcaster'])
     AND v_owner = p_user_id THEN
    RETURN true;
  END IF;

  -- Assigned Broadofficer moderates the stream via the Broadofficer relationship
  IF public.is_modo_role_in(p_user_id, ARRAY['broadofficer']) THEN
    RETURN EXISTS (
      SELECT 1 FROM public.broadcast_officers bo
      WHERE bo.stream_id = p_stream_id
        AND bo.officer_id = p_user_id
    );
  END IF;

  RETURN false;
END;
$$;

-- Helper: check if a user has ANY of the given normalized roles
CREATE OR REPLACE FUNCTION public.is_modo_role_in(p_user_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_user_id
      AND (
        LOWER(COALESCE(role, '')) = ANY (
          SELECT LOWER(x) FROM unnest(p_roles) AS x
        )
        OR LOWER(COALESCE(troll_role, '')) = ANY (
          SELECT LOWER(x) FROM unnest(p_roles) AS x
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_modo_role_in(uuid, text[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- moderator_mute_user(p_stream_id, p_target_user_id, p_duration_minutes, p_reason)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.moderator_mute_user(
  p_stream_id uuid,
  p_target_user_id uuid,
  p_duration_minutes integer DEFAULT 5,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_host_id uuid;
  v_expires_at timestamptz;
  v_target_display text;
  v_target_role text;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN '{"success":false,"code":"UNAUTHENTICATED","message":"You must be signed in."}'::jsonb;
  END IF;

  IF NOT public.is_modo_role(v_actor_id) THEN
    RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to use Mod Actions."}'::jsonb;
  END IF;

  IF p_stream_id IS NULL OR p_target_user_id IS NULL THEN
    RETURN '{"success":false,"code":"INVALID_INPUT","message":"Stream and target are required."}'::jsonb;
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes <= 0 THEN
    RETURN '{"success":false,"code":"INVALID_DURATION","message":"Mute duration must be positive."}'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.streams WHERE id = p_stream_id) THEN
    RETURN '{"success":false,"code":"STREAM_NOT_FOUND","message":"Stream not found."}'::jsonb;
  END IF;

  IF NOT public.can_moderate_stream(p_stream_id, v_actor_id) THEN
    RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to moderate this stream."}'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_target_user_id) THEN
    RETURN '{"success":false,"code":"TARGET_NOT_FOUND","message":"Target user not found."}'::jsonb;
  END IF;

  SELECT user_id INTO v_host_id FROM public.streams WHERE id = p_stream_id;
  v_expires_at := now() + make_interval(mins => p_duration_minutes);

  -- stream_mutes upsert
  UPDATE public.stream_mutes
    SET muted_by = v_actor_id, expires_at = v_expires_at,
        reason = COALESCE(p_reason, 'Muted by moderator'), created_at = now()
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.stream_mutes (stream_id, user_id, muted_by, expires_at, reason)
    VALUES (p_stream_id, p_target_user_id, v_actor_id, v_expires_at, COALESCE(p_reason, 'Muted by moderator'));
  END IF;

  -- chat_blocks stream restriction
  INSERT INTO public.chat_blocks (stream_id, user_id, blocked_by, expires_at, reason, created_at, updated_at)
  VALUES (p_stream_id, p_target_user_id, v_actor_id, v_expires_at, COALESCE(p_reason, 'Muted by moderator'), now(), now())
  ON CONFLICT (stream_id, user_id) DO UPDATE SET
    blocked_by = excluded.blocked_by,
    expires_at = excluded.expires_at,
    reason = excluded.reason,
    updated_at = now();

  -- profile mute fields
  UPDATE public.user_profiles
    SET muted_until = v_expires_at,
        mic_muted_until = CASE WHEN p_target_user_id = v_host_id THEN v_expires_at ELSE mic_muted_until END,
        updated_at = now()
    WHERE id = p_target_user_id;

  -- participant mic state
  UPDATE public.stream_participants SET mic_muted = true
  WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

  -- notification
  PERFORM public.create_notification(
    p_target_user_id, 'muted', 'You have been muted',
    COALESCE(p_reason, 'Muted by moderator') || ' — expires ' || to_char(v_expires_at, 'MM/DD HH24:MI'),
    jsonb_build_object('stream_id', p_stream_id, 'expires_at', v_expires_at, 'duration_minutes', p_duration_minutes)
  );

  SELECT COALESCE(NULLIF(username, ''), 'Unknown'), COALESCE(role, 'unknown')
    INTO v_target_display, v_target_role FROM public.user_profiles WHERE id = p_target_user_id;

  PERFORM public.modo_audit(
    'mute', 'Mute', v_actor_id, p_target_user_id, v_target_display,
    v_target_role, v_target_role, p_stream_id, NULL,
    COALESCE(p_reason, 'Muted by moderator'), p_duration_minutes,
    'unmuted', 'muted', v_expires_at, true, NULL, '{}'::jsonb
  );

  RETURN jsonb_build_object(
    'success', true, 'code', 'ACTION_COMPLETED',
    'message', 'User muted successfully.',
    'data', jsonb_build_object('expires_at', v_expires_at, 'duration_minutes', p_duration_minutes)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- moderator_unmute_user(p_stream_id, p_target_user_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.moderator_unmute_user(
  p_stream_id uuid,
  p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_target_display text;
  v_target_role text;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN '{"success":false,"code":"UNAUTHENTICATED","message":"You must be signed in."}'::jsonb;
  END IF;
  IF NOT public.is_modo_role(v_actor_id) THEN
    RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to use Mod Actions."}'::jsonb;
  END IF;
  IF p_stream_id IS NULL OR p_target_user_id IS NULL THEN
    RETURN '{"success":false,"code":"INVALID_INPUT","message":"Stream and target are required."}'::jsonb;
  END IF;
  IF NOT public.can_moderate_stream(p_stream_id, v_actor_id) THEN
    RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to moderate this stream."}'::jsonb;
  END IF;

  DELETE FROM public.stream_mutes
  WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

  DELETE FROM public.chat_blocks
  WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

  UPDATE public.user_profiles
    SET muted_until = NULL, mic_muted_until = NULL, updated_at = now()
  WHERE id = p_target_user_id;

  UPDATE public.stream_participants SET mic_muted = false
  WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

  SELECT COALESCE(NULLIF(username, ''), 'Unknown'), COALESCE(role, 'unknown')
    INTO v_target_display, v_target_role FROM public.user_profiles WHERE id = p_target_user_id;

  PERFORM public.modo_audit(
    'unmute', 'Unmute', v_actor_id, p_target_user_id, v_target_display,
    v_target_role, v_target_role, p_stream_id, NULL,
    'Unmuted by moderator', NULL, 'muted', 'unmuted', NULL, true, NULL, '{}'::jsonb
  );

  RETURN '{"success":true,"code":"ACTION_COMPLETED","message":"User unmuted successfully.","data":{}}'::jsonb;
END;
$$;

-- ---------------------------------------------------------------------------
-- moderator_disable_chat(p_stream_id, p_target_user_id, p_duration_minutes, p_reason)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.moderator_disable_chat(
  p_stream_id uuid,
  p_target_user_id uuid,
  p_duration_minutes integer DEFAULT 5,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_expires_at timestamptz;
  v_target_display text;
  v_target_role text;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN '{"success":false,"code":"UNAUTHENTICATED","message":"You must be signed in."}'::jsonb;
  END IF;
  IF NOT public.is_modo_role(v_actor_id) THEN
    RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to use Mod Actions."}'::jsonb;
  END IF;
  IF p_stream_id IS NULL OR p_target_user_id IS NULL THEN
    RETURN '{"success":false,"code":"INVALID_INPUT","message":"Stream and target are required."}'::jsonb;
  END IF;
  IF p_duration_minutes IS NULL OR p_duration_minutes <= 0 THEN
    RETURN '{"success":false,"code":"INVALID_DURATION","message":"Duration must be positive."}'::jsonb;
  END IF;
  IF NOT public.can_moderate_stream(p_stream_id, v_actor_id) THEN
    RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to moderate this stream."}'::jsonb;
  END IF;

  v_expires_at := now() + make_interval(mins => p_duration_minutes);

  INSERT INTO public.chat_blocks (stream_id, user_id, blocked_by, expires_at, reason, created_at, updated_at)
  VALUES (p_stream_id, p_target_user_id, v_actor_id, v_expires_at, COALESCE(p_reason, 'Chat disabled by moderator'), now(), now())
  ON CONFLICT (stream_id, user_id) DO UPDATE SET
    blocked_by = excluded.blocked_by,
    expires_at = excluded.expires_at,
    reason = excluded.reason,
    updated_at = now();

  UPDATE public.user_profiles
    SET muted_until = v_expires_at, updated_at = now()
  WHERE id = p_target_user_id;

  PERFORM public.create_notification(
    p_target_user_id, 'chat_disabled', 'Chat Disabled',
    COALESCE(p_reason, 'Chat disabled by moderator') || ' — until ' || to_char(v_expires_at, 'MM/DD HH24:MI'),
    jsonb_build_object('stream_id', p_stream_id, 'expires_at', v_expires_at, 'duration_minutes', p_duration_minutes)
  );

  SELECT COALESCE(NULLIF(username, ''), 'Unknown'), COALESCE(role, 'unknown')
    INTO v_target_display, v_target_role FROM public.user_profiles WHERE id = p_target_user_id;

  PERFORM public.modo_audit(
    'disable_chat', 'Disable Chat', v_actor_id, p_target_user_id, v_target_display,
    v_target_role, v_target_role, p_stream_id, NULL,
    COALESCE(p_reason, 'Chat disabled by moderator'), p_duration_minutes,
    'chat_enabled', 'chat_disabled', v_expires_at, true, NULL, '{}'::jsonb
  );

  RETURN jsonb_build_object(
    'success', true, 'code', 'ACTION_COMPLETED',
    'message', 'Chat disabled successfully.',
    'data', jsonb_build_object('expires_at', v_expires_at, 'duration_minutes', p_duration_minutes)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- moderator_kick_user(p_stream_id, p_target_user_id, p_reason)
-- NOTE: guest (non-UUID) identifiers are handled by the Edge Function which
-- closes the seat session directly with a TEXT guest identity. This RPC is
-- for UUID targets only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.moderator_kick_user(
  p_stream_id uuid,
  p_target_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_expires_at timestamptz := now() + interval '24 hours';
  v_target_display text;
  v_target_role text;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN '{"success":false,"code":"UNAUTHENTICATED","message":"You must be signed in."}'::jsonb;
  END IF;
  IF NOT public.is_modo_role(v_actor_id) THEN
    RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to use Mod Actions."}'::jsonb;
  END IF;
  IF p_stream_id IS NULL OR p_target_user_id IS NULL THEN
    RETURN '{"success":false,"code":"INVALID_INPUT","message":"Stream and target are required."}'::jsonb;
  END IF;
  IF NOT public.can_moderate_stream(p_stream_id, v_actor_id) THEN
    RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to moderate this stream."}'::jsonb;
  END IF;

  INSERT INTO public.stream_kicks (stream_id, user_id, kicked_by, created_by, reason, created_at)
  VALUES (p_stream_id, p_target_user_id, v_actor_id, v_actor_id, COALESCE(p_reason, 'Kicked by moderator'), now())
  ON CONFLICT DO NOTHING;

  UPDATE public.stream_bans
    SET banned_by = v_actor_id, created_by = v_actor_id,
        reason = COALESCE(p_reason, 'Kicked by moderator'), expires_at = v_expires_at
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.stream_bans (stream_id, user_id, banned_by, created_by, reason, expires_at)
    VALUES (p_stream_id, p_target_user_id, v_actor_id, v_actor_id, COALESCE(p_reason, 'Kicked by moderator'), v_expires_at);
  END IF;

  UPDATE public.stream_seat_sessions
    SET status = 'kicked', kick_reason = COALESCE(p_reason, 'Kicked by moderator'), left_at = now()
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id AND status = 'active';

  UPDATE public.stream_participants
    SET status = 'kicked', left_at = now()
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

  UPDATE public.user_profiles
    SET is_kicked = true, kicked_until = v_expires_at, last_kicked_at = now(), updated_at = now()
  WHERE id = p_target_user_id;

  PERFORM public.create_notification(
    p_target_user_id, 'kicked_from_live', 'Kicked from Stream',
    COALESCE(p_reason, 'Kicked by moderator'),
    jsonb_build_object('stream_id', p_stream_id, 'expires_at', v_expires_at)
  );

  SELECT COALESCE(NULLIF(username, ''), 'Unknown'), COALESCE(role, 'unknown')
    INTO v_target_display, v_target_role FROM public.user_profiles WHERE id = p_target_user_id;

  PERFORM public.modo_audit(
    'kick', 'Kick', v_actor_id, p_target_user_id, v_target_display,
    v_target_role, v_target_role, p_stream_id, NULL,
    COALESCE(p_reason, 'Kicked by moderator'), NULL,
    'active', 'kicked', v_expires_at, true, NULL, '{}'::jsonb
  );

  RETURN jsonb_build_object(
    'success', true, 'code', 'ACTION_COMPLETED',
    'message', 'User kicked successfully.',
    'data', jsonb_build_object('expires_at', v_expires_at)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- can_user_broadcast(p_user_id) — authoritative eligibility
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_user_broadcast(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_license_status text;
  v_has_restriction boolean;
  v_has_active_suspension boolean;
  v_reasons text[] := '{}';
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('can_broadcast', false, 'reasons', ARRAY['Missing user']);
  END IF;

  SELECT drivers_license_status INTO v_license_status
  FROM public.user_profiles WHERE id = p_user_id;

  IF v_license_status IS NULL OR v_license_status = 'none' THEN
    v_reasons := array_append(v_reasons, 'No active driver license');
  ELSIF v_license_status = 'suspended' THEN
    v_reasons := array_append(v_reasons, 'Driver license is suspended');
  ELSIF v_license_status = 'expired' THEN
    v_reasons := array_append(v_reasons, 'Driver license is expired');
  END IF;

  -- Active license suspension record
  SELECT EXISTS (
    SELECT 1 FROM public.user_driver_licenses
    WHERE user_id = p_user_id AND status = 'suspended'
      AND (suspended_until IS NULL OR suspended_until > now())
  ) INTO v_has_active_suspension;

  IF v_has_active_suspension THEN
    v_reasons := array_append(v_reasons, 'License suspension is active');
  END IF;

  -- Active broadcast restriction
  SELECT EXISTS (
    SELECT 1 FROM public.broadcast_restrictions
    WHERE user_id = p_user_id AND status = 'active'
      AND COALESCE(expires_at, now() + interval '1 day') > now()
  ) INTO v_has_restriction;

  IF v_has_restriction THEN
    v_reasons := array_append(v_reasons, 'Broadcast restriction is active');
  END IF;

  RETURN jsonb_build_object(
    'can_broadcast', array_length(v_reasons, 1) IS NULL,
    'reasons', v_reasons
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- can_set_to_user(p_target_id) — derive actor from auth.uid()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_set_to_user(p_target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
  v_target_is_admin boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN jsonb_build_object('allowed', true, 'reason', NULL);
  END IF;

  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Not authenticated');
  END IF;

  IF NOT public.is_modo_role(v_actor_id) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'You do not have permission to use Mod Actions.');
  END IF;

  SELECT COALESCE(role, '') INTO v_actor_role FROM public.user_profiles WHERE id = v_actor_id;

IF NOT public.is_modo_role_in(v_actor_id, ARRAY[
    'admin','ceo','secretary','lead_troll_officer','ceo_assistant','noah_assistant'
  ]) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Only Admin, CEO, Secretary, or Lead Troll Officer can set users to user role.');
  END IF;

  SELECT COALESCE(role, ''), COALESCE(is_admin, false)
    INTO v_target_role, v_target_is_admin FROM public.user_profiles WHERE id = p_target_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Target user not found');
  END IF;

  IF v_target_is_admin = true
     OR LOWER(v_target_role) IN ('ceo','admin','owner','superadmin','lead_troll_officer') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Cannot demote elevated staff roles');
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', NULL);
END;
$$;

-- ---------------------------------------------------------------------------
-- reset_user_permissions(p_target_user_id) — returns jsonb, actor from auth.uid()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_user_permissions(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_target_display text;
  v_target_role_before text;
  v_auth jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor_id IS NULL THEN
      RETURN '{"success":false,"code":"UNAUTHENTICATED","message":"You must be signed in."}'::jsonb;
    END IF;

    v_auth := public.can_set_to_user(p_target_user_id);
    IF NOT (v_auth->>'allowed')::boolean THEN
      RETURN jsonb_build_object(
        'success', false, 'code', 'NOT_AUTHORIZED',
        'message', COALESCE(v_auth->>'reason', 'You do not have permission to use Mod Actions.')
      );
    END IF;
  END IF;

  SELECT COALESCE(NULLIF(username, ''), 'Unknown'), COALESCE(role, 'unknown')
    INTO v_target_display, v_target_role_before FROM public.user_profiles WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN '{"success":false,"code":"TARGET_NOT_FOUND","message":"Target user not found."}'::jsonb;
  END IF;

  UPDATE public.user_profiles
    SET role = 'user',
        troll_role = NULL,
        is_admin = false,
        is_troll_officer = false,
        is_lead_officer = false,
        is_prosecutor = false,
        is_attorney = false,
        is_secretary = false,
        is_staff = false,
        officer_level = 0,
        updated_at = now()
  WHERE id = p_target_user_id;

  PERFORM public.create_notification(
    p_target_user_id, 'roles_reset', 'Account Reset to User',
    'Your roles and dashboard access have been reset to a standard user account.',
    jsonb_build_object('previous_role', v_target_role_before)
  );

  PERFORM public.modo_audit(
    'set_to_user', 'Set to User', v_actor_id, p_target_user_id, v_target_display,
    v_target_role_before, 'user', NULL, NULL, 'Roles reset to user', NULL,
    v_target_role_before, 'user', NULL, true, NULL,
    jsonb_build_object('actor', v_actor_id)
  );

  RETURN jsonb_build_object(
    'success', true, 'code', 'ACTION_COMPLETED',
    'message', 'User set to standard account.',
    'data', jsonb_build_object('role', 'user')
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- remove_stream_broadofficer(p_stream_id, p_officer_id)
-- Inserts EXACTLY ONE stream_messages system message (no temp realtime channel).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_stream_broadofficer(
  p_stream_id uuid,
  p_officer_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_deleted integer := 0;
  v_officer_display text;
  v_officer_role text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN '{"success":false,"code":"UNAUTHENTICATED","message":"You must be signed in."}'::jsonb;
  END IF;
  IF NOT public.is_modo_role(v_actor) THEN
    RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to use Mod Actions."}'::jsonb;
  END IF;
  IF p_stream_id IS NULL OR p_officer_id IS NULL THEN
    RETURN '{"success":false,"code":"INVALID_INPUT","message":"Stream and officer are required."}'::jsonb;
  END IF;

  SELECT user_id INTO v_owner FROM public.streams WHERE id = p_stream_id;
  IF v_owner IS NULL THEN
    RETURN '{"success":false,"code":"STREAM_NOT_FOUND","message":"Stream not found."}'::jsonb;
  END IF;

  IF NOT public.is_stream_owner_or_admin(p_stream_id, v_actor) THEN
    RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not control this stream."}'::jsonb;
  END IF;

  SELECT COALESCE(NULLIF(username, ''), 'Unknown'), COALESCE(role, 'unknown')
    INTO v_officer_display, v_officer_role FROM public.user_profiles WHERE id = p_officer_id;

  DELETE FROM public.broadcast_officers
    WHERE broadcaster_id = v_owner
      AND officer_id = p_officer_id
      AND stream_id = p_stream_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Exactly one system message via the existing realtime subscription
  INSERT INTO public.stream_messages (stream_id, user_id, content, type, created_at)
  VALUES (p_stream_id, v_actor, v_officer_display || ' is no longer a Broadofficer.', 'system', now());

  PERFORM public.create_notification(
    p_officer_id, 'broadofficer_removed', 'Broadofficer Removed',
    'You are no longer a Broadofficer for this stream.',
    jsonb_build_object('stream_id', p_stream_id)
  );

  PERFORM public.modo_audit(
    'remove_officer', 'Remove Officer', v_actor, p_officer_id, v_officer_display,
    v_officer_role, v_officer_role, p_stream_id, NULL,
    'Broadofficer removed from stream', NULL,
    'broadofficer', 'removed', NULL, true, NULL, '{}'::jsonb
  );

  RETURN jsonb_build_object(
    'success', true, 'code', 'ACTION_COMPLETED',
    'message', 'Broadofficer removed.',
    'data', jsonb_build_object('removed', v_deleted > 0)
  );
END;
$$;

-- ============================================================================
-- 5. Backend transactional operations (called by Edge Function via RPC)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- modo_arrest(p_stream_id, p_target_user_id, p_reason, p_severity)
-- Race-safe docket assignment; never exceeds max_cases.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.modo_arrest(
  p_stream_id uuid,
  p_target_user_id uuid,
  p_reason text,
  p_severity text DEFAULT 'moderate'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_court_date date;
  v_docket_id uuid;
  v_max_cases integer := 20;
  v_bail integer;
v_target_display text;
  v_target_role text;
  v_lat double precision;
  v_lng double precision;
  v_jail_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN '{"success":false,"code":"UNAUTHENTICATED","message":"You must be signed in."}'::jsonb;
    END IF;
    IF NOT public.is_modo_role(v_actor) THEN
      RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to use Mod Actions."}'::jsonb;
    END IF;
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN '{"success":false,"code":"INVALID_INPUT","message":"Target is required."}'::jsonb;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN '{"success":false,"code":"INVALID_INPUT","message":"A reason is required."}'::jsonb;
  END IF;
  IF length(p_reason) > 2000 THEN
    RETURN '{"success":false,"code":"INVALID_INPUT","message":"Reason is too long."}'::jsonb;
  END IF;
  IF p_severity IS NULL OR p_severity NOT IN ('minor','moderate','serious','severe') THEN
    RETURN '{"success":false,"code":"INVALID_SEVERITY","message":"Unsupported severity."}'::jsonb;
  END IF;

  SELECT COALESCE(NULLIF(username, ''), 'Unknown'), COALESCE(role, 'unknown')
    INTO v_target_display, v_target_role FROM public.user_profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RETURN '{"success":false,"code":"TARGET_NOT_FOUND","message":"Target user not found."}'::jsonb;
  END IF;

  v_bail := CASE p_severity
    WHEN 'minor' THEN 100
    WHEN 'moderate' THEN 200
    WHEN 'serious' THEN 500
    WHEN 'severe' THEN 1000
    ELSE 100 END;

  -- Next valid Tuesday or Thursday
  SELECT CASE
    WHEN EXTRACT(ISODOW FROM now())::int IN (1,2) THEN date_trunc('day', now())::date + (2 - EXTRACT(ISODOW FROM now())::int)
    WHEN EXTRACT(ISODOW FROM now())::int IN (3)   THEN date_trunc('day', now())::date + 1
    WHEN EXTRACT(ISODOW FROM now())::int IN (4)   THEN date_trunc('day', now())::date
    WHEN EXTRACT(ISODOW FROM now())::int IN (5)   THEN date_trunc('day', now())::date + 4
    WHEN EXTRACT(ISODOW FROM now())::int IN (6)   THEN date_trunc('day', now())::date + 3
    ELSE date_trunc('day', now())::date + 2
  END INTO v_court_date;

  -- Find/create a docket for that date with capacity (lock row to avoid races).
  -- Only one docket exists per court_date (UNIQUE constraint), so walk forward
  -- to the next valid date if the current one is full.
  LOOP
    SELECT id INTO v_docket_id
    FROM public.court_dockets
    WHERE court_date = v_court_date
    FOR UPDATE;

    IF v_docket_id IS NULL THEN
      INSERT INTO public.court_dockets (court_date, max_cases, cases_count, status)
      VALUES (v_court_date, v_max_cases, 0, 'open')
      RETURNING id INTO v_docket_id;
    END IF;

    IF (SELECT COALESCE(cases_count, 0) FROM public.court_dockets WHERE id = v_docket_id) < v_max_cases THEN
      EXIT;
    END IF;

    -- Move to next valid court date (Tue or Thu)
    v_court_date := v_court_date + CASE WHEN EXTRACT(ISODOW FROM v_court_date)::int = 2 THEN 2 ELSE 5 END;
  END LOOP;

  UPDATE public.court_dockets
  SET cases_count = COALESCE(cases_count, 0) + 1, updated_at = now()
  WHERE id = v_docket_id;

  SELECT latitude, longitude INTO v_lat, v_lng
  FROM public.user_ip_tracking
  WHERE user_id = p_target_user_id
  ORDER BY created_at DESC LIMIT 1;

-- Jail record
  INSERT INTO public.jail (
    user_id, release_time, reason, sentence_days, bond_amount,
    severity, status, arrested_by, court_date, arrest_latitude, arrest_longitude
  ) VALUES (
    p_target_user_id, now() + interval '24 hours', p_reason, 1, v_bail,
    p_severity, 'jailed', COALESCE(v_actor, p_target_user_id), v_court_date, v_lat, v_lng
  ) RETURNING id INTO v_jail_id;

  -- Court case
  INSERT INTO public.court_cases (docket_id, plaintiff_id, defendant_id, reason, status, case_type)
  VALUES (v_docket_id, COALESCE(v_actor, p_target_user_id), p_target_user_id, p_reason, 'pending', 'criminal');

  PERFORM public.create_notification(
    p_target_user_id, 'jail_sentence_started', 'Arrested',
    'You were arrested: ' || p_reason || '. Court date: ' || to_char(v_court_date, 'MM/DD/YYYY'),
    jsonb_build_object('severity', p_severity, 'bail', v_bail, 'court_date', v_court_date)
  );

  PERFORM public.modo_audit(
    'arrest', 'Arrest', COALESCE(v_actor, p_target_user_id), p_target_user_id, v_target_display,
    v_target_role, v_target_role, p_stream_id, NULL,
    p_reason, NULL, 'active', 'jailed', NULL, true, NULL,
    jsonb_build_object('severity', p_severity, 'bail', v_bail, 'court_date', v_court_date, 'docket_id', v_docket_id)
  );

  RETURN jsonb_build_object(
    'success', true, 'code', 'ACTION_COMPLETED',
    'message', 'User arrested successfully.',
'data', jsonb_build_object(
      'jail_id', v_jail_id,
      'court_date', v_court_date,
      'docket_id', v_docket_id,
      'bail', v_bail,
      'severity', p_severity
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- modo_suspend_license(p_target_user_id, p_reason, p_duration_hours)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.modo_suspend_license(
  p_target_user_id uuid,
  p_reason text,
  p_duration_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_suspended_until timestamptz;
  v_target_display text;
  v_target_role text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN '{"success":false,"code":"UNAUTHENTICATED","message":"You must be signed in."}'::jsonb;
    END IF;
    IF NOT public.is_modo_role(v_actor) THEN
      RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to use Mod Actions."}'::jsonb;
    END IF;
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN '{"success":false,"code":"INVALID_INPUT","message":"Target is required."}'::jsonb;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN '{"success":false,"code":"INVALID_INPUT","message":"A reason is required."}'::jsonb;
  END IF;
  IF p_duration_hours IS NULL OR p_duration_hours <= 0 THEN
    RETURN '{"success":false,"code":"INVALID_DURATION","message":"Suspension duration must be positive."}'::jsonb;
  END IF;

  SELECT COALESCE(NULLIF(username, ''), 'Unknown'), COALESCE(role, 'unknown')
    INTO v_target_display, v_target_role FROM public.user_profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RETURN '{"success":false,"code":"TARGET_NOT_FOUND","message":"Target user not found."}'::jsonb;
  END IF;

  v_suspended_until := now() + make_interval(hours => p_duration_hours);

  INSERT INTO public.user_driver_licenses (user_id, status, suspended_until, expires_at, suspended_by, suspension_reason, updated_at)
  VALUES (p_target_user_id, 'suspended', v_suspended_until, v_suspended_until, v_actor, p_reason, now())
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'suspended',
    suspended_until = excluded.suspended_until,
    expires_at = excluded.expires_at,
    suspended_by = excluded.suspended_by,
    suspension_reason = excluded.suspension_reason,
    updated_at = now();

  UPDATE public.user_profiles
    SET drivers_license_status = 'suspended', updated_at = now()
  WHERE id = p_target_user_id;

  PERFORM public.create_notification(
    p_target_user_id, 'license_suspension_started', 'License Suspended',
    'Your driver license has been suspended for ' || p_duration_hours || ' hours. Reason: ' || p_reason,
    jsonb_build_object('reason', p_reason, 'duration_hours', p_duration_hours, 'suspended_until', v_suspended_until)
  );

  PERFORM public.modo_audit(
    'suspend_license', 'Suspend License', v_actor, p_target_user_id, v_target_display,
    v_target_role, v_target_role, NULL, NULL,
    p_reason, p_duration_hours * 60, 'active', 'suspended', v_suspended_until, true, NULL, '{}'::jsonb
  );

  RETURN jsonb_build_object(
    'success', true, 'code', 'ACTION_COMPLETED',
    'message', 'License suspended.',
    'data', jsonb_build_object('suspended_until', v_suspended_until, 'duration_hours', p_duration_hours)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- modo_grant_license(p_target_user_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.modo_grant_license(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_license_expires timestamptz;
  v_insurance_expires timestamptz;
  v_target_display text;
  v_target_role text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN '{"success":false,"code":"UNAUTHENTICATED","message":"You must be signed in."}'::jsonb;
    END IF;
    IF NOT public.is_modo_role(v_actor) THEN
      RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to use Mod Actions."}'::jsonb;
    END IF;
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN '{"success":false,"code":"INVALID_INPUT","message":"Target is required."}'::jsonb;
  END IF;

  SELECT COALESCE(NULLIF(username, ''), 'Unknown'), COALESCE(role, 'unknown')
    INTO v_target_display, v_target_role FROM public.user_profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RETURN '{"success":false,"code":"TARGET_NOT_FOUND","message":"Target user not found."}'::jsonb;
  END IF;

  v_license_expires := now() + interval '30 days';
  v_insurance_expires := now() + interval '30 days';

  INSERT INTO public.user_driver_licenses (user_id, status, suspended_until, issued_at, expires_at, updated_at)
  VALUES (p_target_user_id, 'active', NULL, now(), v_license_expires, now())
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    suspended_until = NULL,
    issued_at = now(),
    expires_at = excluded.expires_at,
    updated_at = now();

  INSERT INTO public.user_insurances (
    user_id, protection_type, is_active, issued_at, expires_at, created_at, updated_at
  ) VALUES (
    p_target_user_id, 'car', true, now(), v_insurance_expires, now(), now()
  )
  ON CONFLICT (user_id, protection_type) WHERE is_active = true DO UPDATE SET
    is_active = true,
    issued_at = now(),
    expires_at = excluded.expires_at,
    updated_at = now();

  UPDATE public.user_profiles
    SET drivers_license_status = 'active',
        drivers_license_expiry = v_license_expires,
        car_insurance_expiry = v_insurance_expires,
        updated_at = now()
  WHERE id = p_target_user_id;

  PERFORM public.create_notification(
    p_target_user_id, 'license_granted', 'Driver License Granted',
    'Your driver license and 30 days of car insurance have been granted. You can now broadcast.',
    jsonb_build_object('license_expires_at', v_license_expires, 'insurance_expires_at', v_insurance_expires)
  );

  PERFORM public.modo_audit(
    'grant_license', 'Grant License', v_actor, p_target_user_id, v_target_display,
    v_target_role, v_target_role, NULL, NULL,
    'License granted by moderator', NULL, 'none', 'active', v_license_expires, true, NULL, '{}'::jsonb
  );

  RETURN jsonb_build_object(
    'success', true, 'code', 'ACTION_COMPLETED',
    'message', 'License granted.',
    'data', jsonb_build_object('license_expires_at', v_license_expires, 'insurance_expires_at', v_insurance_expires)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- modo_end_stream(p_stream_id, p_target_broadcaster_id, p_reason, p_restrict_duration_minutes)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.modo_end_stream(
  p_stream_id uuid,
  p_target_broadcaster_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_restrict_duration_minutes integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_stream_id uuid := p_stream_id;
  v_stream record;
  v_broadcaster_id uuid;
  v_restrict_until timestamptz;
  v_room_name text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN '{"success":false,"code":"UNAUTHENTICATED","message":"You must be signed in."}'::jsonb;
    END IF;
    IF NOT public.is_modo_role(v_actor) THEN
      RETURN '{"success":false,"code":"NOT_AUTHORIZED","message":"You do not have permission to use Mod Actions."}'::jsonb;
    END IF;
  END IF;

  IF p_restrict_duration_minutes IS NULL OR p_restrict_duration_minutes <= 0 THEN
    RETURN '{"success":false,"code":"INVALID_DURATION","message":"Restriction duration must be positive."}'::jsonb;
  END IF;

  -- Resolve stream: use stream_id, else fall back to broadcaster's active stream
  IF v_stream_id IS NOT NULL THEN
    SELECT * INTO v_stream FROM public.streams WHERE id = v_stream_id;
    IF NOT FOUND THEN
      RETURN '{"success":false,"code":"STREAM_NOT_FOUND","message":"Stream not found."}'::jsonb;
    END IF;
  ELSIF p_target_broadcaster_id IS NOT NULL THEN
    SELECT * INTO v_stream
    FROM public.streams
    WHERE (user_id = p_target_broadcaster_id OR broadcaster_id = p_target_broadcaster_id)
      AND (is_live = true OR status IN ('live','active'))
    ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN
      RETURN '{"success":false,"code":"STREAM_NOT_FOUND","message":"No active stream found."}'::jsonb;
    END IF;
    v_stream_id := v_stream.id;
  ELSE
    RETURN '{"success":false,"code":"INVALID_INPUT","message":"A stream is required to end."}'::jsonb;
  END IF;

  v_broadcaster_id := COALESCE(v_stream.user_id, v_stream.broadcaster_id);
  v_restrict_until := now() + make_interval(mins => p_restrict_duration_minutes);
  v_room_name := COALESCE(v_stream.stream_channel, v_stream.room_name, v_stream_id::text);

  UPDATE public.streams
    SET status = 'ended',
        is_live = false,
        ended_at = now(),
        end_time = now(),
        is_force_ended = true,
        ended_by = COALESCE(v_actor, v_broadcaster_id),
        updated_at = now()
  WHERE id = v_stream_id;

  INSERT INTO public.broadcast_restrictions (
    user_id, restricted_by, stream_id, reason, duration_minutes, starts_at, expires_at, status
  ) VALUES (
    v_broadcaster_id, COALESCE(v_actor, v_broadcaster_id), v_stream_id,
    COALESCE(p_reason, 'Ended by moderator'), p_restrict_duration_minutes,
    now(), v_restrict_until, 'active'
  );

  -- Close participants + seat sessions
  UPDATE public.stream_participants
    SET status = 'left', left_at = now()
    WHERE stream_id = v_stream_id AND status = 'active';

  UPDATE public.stream_seat_sessions
    SET status = 'left', left_at = now()
    WHERE stream_id = v_stream_id AND status = 'active';

  PERFORM public.create_notification(
    v_broadcaster_id, 'live_ended_by_staff', 'Stream Ended',
    COALESCE(p_reason, 'Your stream was ended by staff.'),
    jsonb_build_object('stream_id', v_stream_id)
  );

  PERFORM public.modo_audit(
    'end_stream', 'End Stream', COALESCE(v_actor, v_broadcaster_id), v_broadcaster_id,
    NULL, NULL, NULL, v_stream_id, v_room_name,
    COALESCE(p_reason, 'Ended by moderator'), p_restrict_duration_minutes,
    'live', 'ended', v_restrict_until, true, NULL, '{}'::jsonb
  );

  RETURN jsonb_build_object(
    'success', true, 'code', 'ACTION_COMPLETED',
    'message', 'Stream ended and broadcaster restricted.',
    'data', jsonb_build_object(
      'stream_id', v_stream_id,
      'restricted_until', v_restrict_until,
      'room_name', v_room_name
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderator_mute_user(uuid, uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moderator_unmute_user(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moderator_disable_chat(uuid, uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moderator_kick_user(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_user_broadcast(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_set_to_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_user_permissions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_stream_broadofficer(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.modo_arrest(uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.modo_suspend_license(uuid, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.modo_grant_license(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.modo_end_stream(uuid, uuid, text, integer) TO authenticated, service_role;

-- ============================================================================
-- 6. RLS tightening on privileged moderation tables
-- ============================================================================

DO $guard$
BEGIN
  IF to_regclass('public.jail') IS NOT NULL THEN
    ALTER TABLE public.jail ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can insert jail rows" ON public.jail;
    DROP POLICY IF EXISTS "Allow all jail" ON public.jail;
    DROP POLICY IF EXISTS "jail_all" ON public.jail;
  END IF;
END $guard$;

DO $guard$
BEGIN
  IF to_regclass('public.court_cases') IS NOT NULL THEN
    ALTER TABLE public.court_cases ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can insert court cases" ON public.court_cases;
    DROP POLICY IF EXISTS "Allow all court cases" ON public.court_cases;
  END IF;
END $guard$;

DO $guard$
BEGIN
  IF to_regclass('public.court_dockets') IS NOT NULL THEN
    ALTER TABLE public.court_dockets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can insert court dockets" ON public.court_dockets;
    DROP POLICY IF EXISTS "Allow all court dockets" ON public.court_dockets;
  END IF;
END $guard$;

DO $guard$
BEGIN
  IF to_regclass('public.user_driver_licenses') IS NOT NULL THEN
    ALTER TABLE public.user_driver_licenses ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can insert licenses" ON public.user_driver_licenses;
    DROP POLICY IF EXISTS "Allow all user_driver_licenses" ON public.user_driver_licenses;
  END IF;
END $guard$;

DO $guard$
BEGIN
  IF to_regclass('public.broadcast_mod_actions') IS NOT NULL THEN
    ALTER TABLE public.broadcast_mod_actions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can insert mod actions" ON public.broadcast_mod_actions;
    DROP POLICY IF EXISTS "Allow all broadcast_mod_actions" ON public.broadcast_mod_actions;
  END IF;
END $guard$;

DO $guard$
BEGIN
  IF to_regclass('public.broadcast_restrictions') IS NOT NULL THEN
    ALTER TABLE public.broadcast_restrictions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users can insert restrictions" ON public.broadcast_restrictions;
    DROP POLICY IF EXISTS "Allow all broadcast_restrictions" ON public.broadcast_restrictions;
  END IF;
END $guard$;

-- SELECT-only policies (reads allowed, privileged writes only via SECURITY DEFINER RPCs)
DO $guard$
BEGIN
  IF to_regclass('public.jail') IS NOT NULL THEN
    DROP POLICY IF EXISTS "modo_jail_select" ON public.jail;
    CREATE POLICY "modo_jail_select" ON public.jail FOR SELECT USING (true);
  END IF;
  IF to_regclass('public.court_cases') IS NOT NULL THEN
    DROP POLICY IF EXISTS "modo_court_cases_select" ON public.court_cases;
    CREATE POLICY "modo_court_cases_select" ON public.court_cases FOR SELECT USING (true);
  END IF;
  IF to_regclass('public.court_dockets') IS NOT NULL THEN
    DROP POLICY IF EXISTS "modo_court_dockets_select" ON public.court_dockets;
    CREATE POLICY "modo_court_dockets_select" ON public.court_dockets FOR SELECT USING (true);
  END IF;
  IF to_regclass('public.user_driver_licenses') IS NOT NULL THEN
    DROP POLICY IF EXISTS "modo_drivers_select" ON public.user_driver_licenses;
    CREATE POLICY "modo_drivers_select" ON public.user_driver_licenses FOR SELECT USING (true);
  END IF;
  IF to_regclass('public.broadcast_mod_actions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "modo_mod_actions_select" ON public.broadcast_mod_actions;
    CREATE POLICY "modo_mod_actions_select" ON public.broadcast_mod_actions FOR SELECT USING (true);
  END IF;
  IF to_regclass('public.broadcast_restrictions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "modo_restrictions_select" ON public.broadcast_restrictions;
    CREATE POLICY "modo_restrictions_select" ON public.broadcast_restrictions FOR SELECT USING (true);
  END IF;
END $guard$;

-- ============================================================================
-- 7. Realtime publication membership + REPLICA IDENTITY FULL
-- ============================================================================

DO $guard$
DECLARE
  t text;
  tables text[] := ARRAY['stream_messages','streams','user_profiles','notifications','stream_participants','stream_seat_sessions'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END IF;
  END LOOP;
END $guard$;

-- REPLICA IDENTITY FULL where complete UPDATE/DELETE payloads are needed
DO $guard$
DECLARE
  t text;
  tables text[] := ARRAY['stream_messages','streams','notifications','stream_participants','stream_seat_sessions'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    END IF;
  END LOOP;
END $guard$;

COMMIT;

NOTIFY pgrst, 'reload schema';

