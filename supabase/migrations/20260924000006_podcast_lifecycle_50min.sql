-- Podcast 50-minute lifecycle columns
-- Adds authoritative expiration tracking for podcasts (mirrors streams migration)

ALTER TABLE public.podcasts
ADD COLUMN IF NOT EXISTS broadcast_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS broadcast_type TEXT DEFAULT 'podcast',
ADD COLUMN IF NOT EXISTS ended_reason TEXT;

-- Add check constraint for broadcast_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'podcasts_broadcast_type_check'
  ) THEN
    ALTER TABLE public.podcasts
    ADD CONSTRAINT podcasts_broadcast_type_check
    CHECK (broadcast_type IN ('broadcast', 'hytrogame', 'podcast'));
  END IF;
END $$;

-- Add check constraint for ended_reason
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'podcasts_ended_reason_check'
  ) THEN
    ALTER TABLE public.podcasts
    ADD CONSTRAINT podcasts_ended_reason_check
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
CREATE INDEX IF NOT EXISTS idx_podcasts_broadcast_expires_at
ON public.podcasts (broadcast_expires_at)
WHERE broadcast_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_podcasts_broadcast_type
ON public.podcasts (broadcast_type);

-- Function to set broadcast_expires_at on podcast start
CREATE OR REPLACE FUNCTION public.set_podcast_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('live', 'active') AND NEW.started_at IS NOT NULL THEN
    NEW.broadcast_expires_at = NEW.started_at + INTERVAL '50 minutes';
    NEW.broadcast_type = COALESCE(NEW.broadcast_type, 'podcast');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-set expiration on podcast start
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_set_podcast_expiration'
  ) THEN
    CREATE TRIGGER trigger_set_podcast_expiration
    BEFORE UPDATE ON public.podcasts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_podcast_expiration();
  END IF;
END $$;

-- Function to check if podcast has expired (for server-side use)
CREATE OR REPLACE FUNCTION public.is_podcast_expired(p_podcast_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_status TEXT;
  v_ended_at TIMESTAMPTZ;
BEGIN
  SELECT broadcast_expires_at, status, ended_at
  INTO v_expires_at, v_status, v_ended_at
  FROM public.podcasts
  WHERE id = p_podcast_id;

  IF v_expires_at IS NULL OR v_ended_at IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  RETURN NOW() >= v_expires_at;
END;
$$;

-- Function to automatically end expired podcasts (called by cron)
CREATE OR REPLACE FUNCTION public.end_expired_podcasts()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_podcast RECORD;
BEGIN
  FOR v_podcast IN
    SELECT id, user_id, broadcast_expires_at, broadcast_type, started_at
    FROM public.podcasts
    WHERE broadcast_expires_at IS NOT NULL
      AND ended_at IS NULL
      AND status IN ('live', 'active')
      AND broadcast_expires_at <= NOW()
  LOOP
    UPDATE public.podcasts
    SET status = 'ended',
        ended_at = NOW(),
        ended_reason = 'automatic_50_minute_reset',
        updated_at = NOW()
    WHERE id = v_podcast.id;

    INSERT INTO public.podcast_rtc_logs (podcast_id, user_id, username, role, level, event_type, message, metadata)
    SELECT
      v_podcast.id,
      v_podcast.user_id,
      up.username,
      up.role,
      up.level,
      'podcast_ended',
      'Podcast automatically ended at 50-minute limit',
      jsonb_build_object(
        'broadcast_type', v_podcast.broadcast_type,
        'ended_reason', 'automatic_50_minute_reset'
      )
    FROM public.user_profiles up
    WHERE up.id = v_podcast.user_id;

    -- Emit realtime event
    PERFORM pg_notify('podcast_ended', jsonb_build_object(
      'podcast_id', v_podcast.id,
      'broadcaster_id', v_podcast.user_id,
      'ended_at', NOW(),
      'reason', 'automatic_50_minute_reset',
      'broadcast_type', v_podcast.broadcast_type
    )::text);
  END LOOP;
END;
$$;