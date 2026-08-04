-- Per-broadcast minute counter with gift-based extension system.
-- Each broadcast gets a base of 360 minutes (6 hours).
-- When gifts over 1000 coins are sent to a broadcaster, the broadcast
-- gets an extra 60 minutes per 1000 coins received.

-- Add minute tracking columns to streams table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'total_minutes_allowed') THEN
    ALTER TABLE public.streams ADD COLUMN total_minutes_allowed INTEGER NOT NULL DEFAULT 360;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'minutes_used') THEN
    ALTER TABLE public.streams ADD COLUMN minutes_used INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'minutes_remaining') THEN
    ALTER TABLE public.streams ADD COLUMN minutes_remaining INTEGER NOT NULL DEFAULT 360;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'gift_extension_minutes') THEN
    ALTER TABLE public.streams ADD COLUMN gift_extension_minutes INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'last_gift_extension_at') THEN
    ALTER TABLE public.streams ADD COLUMN last_gift_extension_at TIMESTAMPTZ;
  END IF;
END
$$;

-- Create broadcast_minute_tracking table for per-participant minute accounting
CREATE TABLE IF NOT EXISTS public.broadcast_minute_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  participant_identity TEXT NOT NULL,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('host', 'seat', 'viewer', 'moderator')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bmt_stream_id ON public.broadcast_minute_tracking(stream_id);
CREATE INDEX IF NOT EXISTS idx_bmt_participant_identity ON public.broadcast_minute_tracking(participant_identity);
CREATE INDEX IF NOT EXISTS idx_bmt_joined_at ON public.broadcast_minute_tracking(joined_at);
CREATE INDEX IF NOT EXISTS idx_bmt_stream_active ON public.broadcast_minute_tracking(stream_id, participant_type) WHERE left_at IS NULL;

-- Create function to record participant join
CREATE OR REPLACE FUNCTION public.record_broadcast_participant_join(
  p_stream_id uuid,
  p_participant_identity text,
  p_participant_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.broadcast_minute_tracking (stream_id, participant_identity, participant_type, joined_at)
  VALUES (p_stream_id, p_participant_identity, p_participant_type, NOW())
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_broadcast_participant_join(uuid, text, text) TO authenticated, service_role;

-- Create function to record participant leave and update minutes
CREATE OR REPLACE FUNCTION public.record_broadcast_participant_leave(
  p_stream_id uuid,
  p_participant_identity text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.broadcast_minute_tracking%ROWTYPE;
  v_duration_seconds INTEGER;
  v_minutes_added INTEGER;
BEGIN
  -- Find the active session for this participant
  SELECT * INTO v_row
  FROM public.broadcast_minute_tracking
  WHERE stream_id = p_stream_id
    AND participant_identity = p_participant_identity
    AND left_at IS NULL
  ORDER BY joined_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_active_session');
  END IF;

  -- Calculate duration
  v_duration_seconds := FLOOR(EXTRACT(EPOCH FROM (NOW() - v_row.joined_at)));
  v_minutes_added := CEIL(v_duration_seconds / 60);

  -- Update the tracking row
  UPDATE public.broadcast_minute_tracking
  SET left_at = NOW(),
      duration_seconds = v_duration_seconds
  WHERE id = v_row.id;

  -- Update stream minutes_used and minutes_remaining
  UPDATE public.streams
  SET minutes_used = COALESCE(minutes_used, 0) + v_minutes_added,
      minutes_remaining = GREATEST(0, COALESCE(minutes_remaining, 360) - v_minutes_added),
      last_heartbeat_at = NOW()
  WHERE id = p_stream_id;

  RETURN jsonb_build_object(
    'success', true,
    'duration_seconds', v_duration_seconds,
    'minutes_added', v_minutes_added,
    'stream_id', p_stream_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_broadcast_participant_leave(uuid, text) TO authenticated, service_role;

-- Create function to extend broadcast time based on gifts
CREATE OR REPLACE FUNCTION public.extend_broadcast_with_gift(
  p_stream_id uuid,
  p_gift_amount bigint,
  p_sender_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_extension_minutes INTEGER;
  v_current_remaining INTEGER;
  v_current_allowed INTEGER;
BEGIN
  -- Only process gifts over 1000 coins
  IF p_gift_amount < 1000 THEN
    RETURN jsonb_build_object('success', true, 'reason', 'gift_below_threshold', 'extension_minutes', 0);
  END IF;

  -- Calculate extension: 60 minutes per 1000 coins
  v_extension_minutes := FLOOR(p_gift_amount / 1000) * 60;

  -- Get current values
  SELECT minutes_remaining, total_minutes_allowed
  INTO v_current_remaining, v_current_allowed
  FROM public.streams
  WHERE id = p_stream_id;

  -- Update stream with extended time
  UPDATE public.streams
  SET gift_extension_minutes = COALESCE(gift_extension_minutes, 0) + v_extension_minutes,
      total_minutes_allowed = COALESCE(total_minutes_allowed, 360) + v_extension_minutes,
      minutes_remaining = COALESCE(minutes_remaining, 360) + v_extension_minutes,
      last_gift_extension_at = NOW()
  WHERE id = p_stream_id;

  RETURN jsonb_build_object(
    'success', true,
    'extension_minutes', v_extension_minutes,
    'gift_amount', p_gift_amount,
    'new_total_minutes_allowed', COALESCE(v_current_allowed, 360) + v_extension_minutes,
    'new_minutes_remaining', COALESCE(v_current_remaining, 360) + v_extension_minutes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_broadcast_with_gift(uuid, bigint, uuid) TO authenticated, service_role;

-- Create trigger to auto-extend broadcast time when gifts are sent
CREATE OR REPLACE FUNCTION public.handle_gift_broadcast_extension()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process gifts sent to broadcasters (not between viewers)
  IF NEW.coins_amount >= 1000 AND NEW.stream_id IS NOT NULL THEN
    PERFORM public.extend_broadcast_with_gift(
      NEW.stream_id,
      NEW.coins_amount,
      NEW.sender_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gift_broadcast_extension ON public.stream_gifts;
CREATE TRIGGER trg_gift_broadcast_extension
  AFTER INSERT ON public.stream_gifts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_gift_broadcast_extension();

-- Create function to get broadcast minute stats for admin monitor
CREATE OR REPLACE FUNCTION public.get_broadcast_minute_stats(
  p_stream_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_stream_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'stream_id', s.id,
      'title', s.title,
      'is_live', s.is_live,
      'total_minutes_allowed', COALESCE(s.total_minutes_allowed, 360),
      'minutes_used', COALESCE(s.minutes_used, 0),
      'minutes_remaining', COALESCE(s.minutes_remaining, 360),
      'gift_extension_minutes', COALESCE(s.gift_extension_minutes, 0),
      'last_gift_extension_at', s.last_gift_extension_at,
      'started_at', s.started_at,
      'active_participants', (
        SELECT COUNT(*)
        FROM public.broadcast_minute_tracking bmt
        WHERE bmt.stream_id = s.id
        AND bmt.left_at IS NULL
      ),
      'total_participant_minutes', (
        SELECT COALESCE(SUM(CEIL(duration_seconds / 60)), 0)
        FROM public.broadcast_minute_tracking bmt
        WHERE bmt.stream_id = s.id
      )
    ) INTO v_result
    FROM public.streams s
    WHERE s.id = p_stream_id;
  ELSE
    -- Return stats for all active broadcasts
    SELECT jsonb_agg(row_to_json(r)) INTO v_result
    FROM (
      SELECT
        s.id AS stream_id,
        s.title,
        s.is_live,
        COALESCE(s.total_minutes_allowed, 360) AS total_minutes_allowed,
        COALESCE(s.minutes_used, 0) AS minutes_used,
        COALESCE(s.minutes_remaining, 360) AS minutes_remaining,
        COALESCE(s.gift_extension_minutes, 0) AS gift_extension_minutes,
        s.last_gift_extension_at,
        s.started_at,
        (SELECT COUNT(*) FROM public.broadcast_minute_tracking bmt WHERE bmt.stream_id = s.id AND bmt.left_at IS NULL) AS active_participants,
        (SELECT COALESCE(SUM(CEIL(duration_seconds / 60)), 0) FROM public.broadcast_minute_tracking bmt WHERE bmt.stream_id = s.id) AS total_participant_minutes
      FROM public.streams s
      WHERE s.is_live = true AND s.status = 'live'
    ) r;
  END IF;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_broadcast_minute_stats(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_broadcast_minute_stats() TO authenticated, service_role;

-- Update the livekit_usage_tracking table to include stream_id for per-broadcast tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'livekit_usage_tracking' AND column_name = 'stream_id') THEN
    ALTER TABLE public.livekit_usage_tracking ADD COLUMN stream_id uuid REFERENCES public.streams(id);
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';