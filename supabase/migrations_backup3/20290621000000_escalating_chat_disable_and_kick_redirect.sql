-- Escalating chat disable durations and permanent chat ban after 5 strikes
-- Also adds kick redirect support (remove tracks + redirect to homepage)

-- Add strike count column to chat_blocks to track repeat offenses per stream
ALTER TABLE public.chat_blocks
  ADD COLUMN IF NOT EXISTS strike_count integer NOT NULL DEFAULT 1;

-- Add a flag to mark permanent chat blocks
ALTER TABLE public.chat_blocks
  ADD COLUMN IF NOT EXISTS is_permanent boolean NOT NULL DEFAULT FALSE;

-- Add unique constraint for upsert in moderator_disable_chat RPC
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_blocks_stream_user_unique'
      AND conrelid = 'public.chat_blocks'::regclass
  ) THEN
    ALTER TABLE public.chat_blocks
      ADD CONSTRAINT chat_blocks_stream_user_unique UNIQUE (stream_id, user_id);
  END IF;
END$$;

-- Add column to track if user was kicked (for redirect on client)
ALTER TABLE public.stream_participants
  ADD COLUMN IF NOT EXISTS removed_reason text;

-- Update moderator_disable_chat to support escalating durations
-- Strike 1: 5 min, Strike 2: 10 min, Strike 3: 15 min, Strike 4: 30 min, Strike 5: 60 min, Strike 6+: permanent
CREATE OR REPLACE FUNCTION public.moderator_disable_chat(
  p_stream_id uuid,
  p_target_user_id uuid,
  p_duration_minutes integer DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_existing_strike_count integer := 0;
  v_effective_duration integer;
  v_expires_at timestamptz;
  v_is_permanent boolean := false;
BEGIN
  IF NOT public.can_moderate_stream(p_stream_id, v_actor_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- Check for existing active block to determine strike count
  SELECT COALESCE(MAX(strike_count), 0)
  INTO v_existing_strike_count
  FROM public.chat_blocks
  WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id;

  -- If caller explicitly provided a duration, use it; otherwise calculate from strike count
  IF p_duration_minutes IS NOT NULL THEN
    v_effective_duration := GREATEST(p_duration_minutes, 1);
  ELSE
    -- Escalating durations based on previous strikes
    v_effective_duration := CASE v_existing_strike_count
      WHEN 0 THEN 5
      WHEN 1 THEN 10
      WHEN 2 THEN 15
      WHEN 3 THEN 30
      WHEN 4 THEN 60
      ELSE NULL  -- permanent
    END;
  END IF;

  -- If duration is NULL, it means permanent (6+ strikes)
  IF v_effective_duration IS NULL THEN
    v_is_permanent := true;
    v_expires_at := now() + interval '100 years';
  ELSE
    v_expires_at := now() + make_interval(mins => v_effective_duration);
  END IF;

  -- Upsert the chat block with incremented strike count
  INSERT INTO public.chat_blocks (stream_id, user_id, blocked_by, expires_at, reason, strike_count, is_permanent)
  VALUES (
    p_stream_id,
    p_target_user_id,
    v_actor_id,
    v_expires_at,
    COALESCE(p_reason, 'Chat disabled by moderator'),
    v_existing_strike_count + 1,
    v_is_permanent
  )
  ON CONFLICT (stream_id, user_id)
  DO UPDATE SET
    blocked_by = v_actor_id,
    expires_at = v_expires_at,
    reason = COALESCE(p_reason, 'Chat disabled by moderator'),
    created_at = now(),
    strike_count = v_existing_strike_count + 1,
    is_permanent = v_is_permanent;

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', v_expires_at,
    'is_permanent', v_is_permanent,
    'strike_count', v_existing_strike_count + 1,
    'duration_minutes', v_effective_duration
  );
END;
$$;

-- Update is_user_chat_blocked to also check permanent blocks
CREATE OR REPLACE FUNCTION public.is_user_chat_blocked(
  p_user_id uuid,
  p_stream_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_blocks cb
    WHERE cb.user_id = p_user_id
      AND (
        cb.is_permanent = true
        OR cb.expires_at > now()
      )
      AND (p_stream_id IS NULL OR cb.stream_id = p_stream_id OR cb.stream_id IS NULL)
  );
$$;

-- Update kick_user_paid to also set removed_reason on stream_participants
CREATE OR REPLACE FUNCTION kick_user_paid(p_stream_id UUID, p_target_user_id UUID, p_kicker_id UUID, p_duration_minutes INTEGER DEFAULT 1440)
RETURNS JSONB AS $$
DECLARE
    v_cost INTEGER := 100;
    v_balance INTEGER;
BEGIN
    -- Check balance
    SELECT coins INTO v_balance FROM user_profiles WHERE id = p_kicker_id;

    IF v_balance IS NULL OR v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds (100 coins required)');
    END IF;

    -- Deduct coins
    UPDATE user_profiles SET coins = coins - v_cost WHERE id = p_kicker_id;

    -- Add to kick/ban list (default 24 hours, caller can override)
    INSERT INTO stream_bans (stream_id, user_id, banned_by, reason, expires_at)
    VALUES (p_stream_id, p_target_user_id, p_kicker_id, 'Paid Kick', NOW() + (p_duration_minutes || ' minutes')::INTERVAL)
    ON CONFLICT (stream_id, user_id)
    DO UPDATE SET expires_at = NOW() + (p_duration_minutes || ' minutes')::INTERVAL, banned_by = p_kicker_id;

    -- Remove from viewers
    DELETE FROM stream_viewers WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

    -- Mark participant as removed with reason for client-side redirect
    UPDATE stream_participants
    SET removed = true,
        removed_reason = 'Kicked by broadcaster',
        removed_at = NOW()
    WHERE stream_id = p_stream_id
      AND user_id = p_target_user_id;

    -- Remove from stage seat so the broadcast page clears the seat box
    UPDATE stream_seat_sessions
    SET status = 'kicked',
        left_at = NOW(),
        updated_at = NOW()
    WHERE stream_id = p_stream_id
      AND user_id = p_target_user_id
      AND status IN ('active', 'live', 'reserved', 'camera_starting');

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update moderator_kick_user to also set removed_reason
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
BEGIN
  IF NOT public.can_moderate_stream(p_stream_id, v_actor_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  INSERT INTO public.stream_kicks (stream_id, user_id, kicked_by, created_by, reason)
  VALUES (p_stream_id, p_target_user_id, v_actor_id, v_actor_id, COALESCE(p_reason, 'Kicked by moderator'));

  UPDATE public.stream_bans
  SET banned_by = v_actor_id,
      created_by = v_actor_id,
      reason = COALESCE(p_reason, 'Kicked by moderator'),
      expires_at = v_expires_at
  WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.stream_bans (stream_id, user_id, banned_by, created_by, reason, expires_at)
    VALUES (p_stream_id, p_target_user_id, v_actor_id, v_actor_id, COALESCE(p_reason, 'Kicked by moderator'), v_expires_at);
  END IF;

  UPDATE public.stream_seat_sessions
  SET status = 'kicked',
      kick_reason = COALESCE(p_reason, 'Kicked by moderator'),
      left_at = now()
  WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id
    AND status = 'active';

  -- Mark participant as removed with reason for client-side redirect
  UPDATE public.stream_participants
  SET removed = true,
      removed_reason = COALESCE(p_reason, 'Kicked by moderator'),
      removed_at = NOW()
  WHERE stream_id = p_stream_id
    AND user_id = p_target_user_id;

  RETURN jsonb_build_object('success', true, 'expires_at', v_expires_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderator_disable_chat(uuid, uuid, integer, text) TO authenticated;
