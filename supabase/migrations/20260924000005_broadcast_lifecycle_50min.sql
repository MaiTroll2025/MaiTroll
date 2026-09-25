-- Broadcast 50-minute lifecycle columns
-- Adds authoritative expiration tracking and broadcast type classification

ALTER TABLE public.streams
ADD COLUMN IF NOT EXISTS broadcast_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS broadcast_type TEXT DEFAULT 'broadcast',
ADD COLUMN IF NOT EXISTS ended_reason TEXT;

-- Add check constraint for broadcast_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'streams_broadcast_type_check'
  ) THEN
    ALTER TABLE public.streams
    ADD CONSTRAINT streams_broadcast_type_check
    CHECK (broadcast_type IN ('broadcast', 'hytrogame', 'podcast'));
  END IF;
END $$;

-- Add check constraint for ended_reason
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'streams_ended_reason_check'
  ) THEN
    ALTER TABLE public.streams
    ADD CONSTRAINT streams_ended_reason_check
    CHECK (ended_reason IN (
      'manual_end',
      'automatic_50_minute_reset',
      'battle_completed_after_expiration',
      'maintenance_end',
      'admin_end',
      'disconnect',
      'unload'
    ));
  END IF;
END $$;

-- Index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_streams_broadcast_expires_at
ON public.streams (broadcast_expires_at)
WHERE broadcast_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_streams_broadcast_type
ON public.streams (broadcast_type);

-- Function to set broadcast_expires_at on stream start
CREATE OR REPLACE FUNCTION public.set_broadcast_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'live' AND NEW.is_live = true AND NEW.started_at IS NOT NULL THEN
    NEW.broadcast_expires_at = NEW.started_at + INTERVAL '50 minutes';
    NEW.broadcast_type = COALESCE(NEW.broadcast_type, 'broadcast');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-set expiration on stream start
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_set_broadcast_expiration'
  ) THEN
    CREATE TRIGGER trigger_set_broadcast_expiration
    BEFORE UPDATE ON public.streams
    FOR EACH ROW
    EXECUTE FUNCTION public.set_broadcast_expiration();
  END IF;
END $$;

-- Function to check if broadcast has expired (for server-side use)
CREATE OR REPLACE FUNCTION public.is_broadcast_expired(p_stream_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_status TEXT;
  v_ended_at TIMESTAMPTZ;
  v_is_battle BOOLEAN;
  v_battle_status TEXT;
BEGIN
  SELECT broadcast_expires_at, status, ended_at, is_battle, battle_status
  INTO v_expires_at, v_status, v_ended_at, v_is_battle, v_battle_status
  FROM public.streams
  WHERE id = p_stream_id;

  IF v_expires_at IS NULL OR v_ended_at IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  -- Broadcast has expired
  IF NOW() >= v_expires_at THEN
    -- Allow active battle to complete naturally
    IF v_is_battle AND v_battle_status IN ('starting', 'active') THEN
      RETURN FALSE;
    END IF;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Function to end expired broadcasts (for cron job)
CREATE OR REPLACE FUNCTION public.end_expired_broadcasts()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream RECORD;
BEGIN
  FOR v_stream IN
    SELECT id, user_id, broadcast_type, battle_id, is_battle, battle_status
    FROM public.streams
    WHERE broadcast_expires_at IS NOT NULL
      AND ended_at IS NULL
      AND status = 'live'
      AND is_live = true
      AND NOW() >= broadcast_expires_at
      AND NOT (is_battle AND battle_status IN ('starting', 'active'))
  LOOP
    UPDATE public.streams
    SET status = 'ended',
        is_live = false,
        ended_at = NOW(),
        ended_reason = 'automatic_50_minute_reset',
        rtc_connected = false,
        camera_enabled = false,
        microphone_enabled = false
    WHERE id = v_stream.id;

    -- Log the automatic ending
    INSERT INTO public.podcast_rtc_logs (
      podcast_id, user_id, username, role, level,
      event_type, message, metadata
    ) VALUES (
      v_stream.id,
      v_stream.user_id,
      (SELECT username FROM public.user_profiles WHERE id = v_stream.user_id),
      (SELECT role FROM public.user_profiles WHERE id = v_stream.user_id),
      (SELECT level FROM public.user_profiles WHERE id = v_stream.user_id),
      'broadcast_ended',
      'Broadcast automatically ended at 50-minute limit',
      jsonb_build_object(
        'broadcast_type', v_stream.broadcast_type,
        'ended_reason', 'automatic_50_minute_reset',
        'battle_active', v_stream.is_battle
      )
    );
  END LOOP;
END;
$$;