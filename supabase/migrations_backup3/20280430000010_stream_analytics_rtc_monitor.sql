-- Additive RTC Monitor stream analytics.
-- Safe launch patch: creates analytics tables/functions without changing live stream logic.

CREATE TABLE IF NOT EXISTS public.stream_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid,
  user_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('join', 'leave', 'gift', 'stream_start', 'stream_end')),
  gift_amount bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stream_analytics_daily (
  date date PRIMARY KEY,
  total_viewer_minutes bigint NOT NULL DEFAULT 0,
  total_stream_minutes bigint NOT NULL DEFAULT 0,
  total_gifts_count bigint NOT NULL DEFAULT 0,
  total_gift_coins bigint NOT NULL DEFAULT 0,
  unique_viewers bigint NOT NULL DEFAULT 0,
  unique_streams bigint NOT NULL DEFAULT 0,
  avg_watch_time_per_user numeric NOT NULL DEFAULT 0,
  avg_stream_duration numeric NOT NULL DEFAULT 0,
  avg_gifts_per_user numeric NOT NULL DEFAULT 0,
  peak_concurrent_viewers bigint NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_stream_analytics_events_stream_id
  ON public.stream_analytics_events(stream_id);

CREATE INDEX IF NOT EXISTS idx_stream_analytics_events_user_id
  ON public.stream_analytics_events(user_id);

CREATE INDEX IF NOT EXISTS idx_stream_analytics_events_created_at
  ON public.stream_analytics_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stream_analytics_events_type_created_at
  ON public.stream_analytics_events(event_type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stream_analytics_stream_lifecycle
  ON public.stream_analytics_events(stream_id, event_type)
  WHERE event_type IN ('stream_start', 'stream_end') AND stream_id IS NOT NULL;

ALTER TABLE public.stream_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_analytics_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stream_analytics_events_staff_read" ON public.stream_analytics_events;
CREATE POLICY "stream_analytics_events_staff_read" ON public.stream_analytics_events
FOR SELECT
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (
        COALESCE(up.is_admin, false) = true
        OR up.role IN ('admin', 'superadmin', 'ceo', 'moderator', 'troll_officer', 'lead_troll_officer', 'secretary')
      )
  )
);

DROP POLICY IF EXISTS "stream_analytics_daily_staff_read" ON public.stream_analytics_daily;
CREATE POLICY "stream_analytics_daily_staff_read" ON public.stream_analytics_daily
FOR SELECT
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (
        COALESCE(up.is_admin, false) = true
        OR up.role IN ('admin', 'superadmin', 'ceo', 'moderator', 'troll_officer', 'lead_troll_officer', 'secretary')
      )
  )
);

CREATE OR REPLACE FUNCTION public.log_stream_analytics_event(
  p_stream_id uuid,
  p_user_id uuid,
  p_event_type text,
  p_gift_amount bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_type NOT IN ('join', 'leave', 'gift', 'stream_start', 'stream_end') THEN
    RETURN;
  END IF;

  IF p_event_type IN ('join', 'leave') AND (p_stream_id IS NULL OR p_user_id IS NULL) THEN
    RETURN;
  END IF;

  -- Prevent duplicate browser/realtime events from StrictMode, refreshes, and reconnect churn.
  IF p_event_type IN ('join', 'leave') AND EXISTS (
    SELECT 1
    FROM public.stream_analytics_events e
    WHERE e.stream_id = p_stream_id
      AND e.user_id = p_user_id
      AND e.event_type = p_event_type
      AND e.created_at > now() - interval '30 seconds'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.stream_analytics_events (stream_id, user_id, event_type, gift_amount)
  VALUES (p_stream_id, p_user_id, p_event_type, GREATEST(COALESCE(p_gift_amount, 0), 0));
EXCEPTION WHEN unique_violation THEN
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_stream_analytics_event(uuid, uuid, text, bigint) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.aggregate_stream_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH days AS (
    SELECT generate_series((current_date - interval '30 days')::date, current_date, interval '1 day')::date AS date
  ),
  viewer_sessions AS (
    SELECT
      j.created_at::date AS date,
      j.stream_id,
      j.user_id,
      GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM (
          LEAST(
            COALESCE((
              SELECT MIN(l.created_at)
              FROM public.stream_analytics_events l
              WHERE l.stream_id = j.stream_id
                AND l.user_id = j.user_id
                AND l.event_type = 'leave'
                AND l.created_at > j.created_at
            ), now()),
            j.created_at + interval '30 minutes'
          ) - j.created_at
        )) / 60)
      )::bigint AS minutes
    FROM public.stream_analytics_events j
    WHERE j.event_type = 'join'
      AND j.created_at >= current_date - interval '30 days'
  ),
  viewer_daily AS (
    SELECT
      date,
      COALESCE(SUM(minutes), 0)::bigint AS total_viewer_minutes,
      COUNT(DISTINCT user_id)::bigint AS unique_viewers
    FROM viewer_sessions
    GROUP BY date
  ),
  stream_sessions AS (
    SELECT
      s.created_at::date AS date,
      s.stream_id,
      GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM (
          LEAST(
            COALESCE((
              SELECT MIN(e.created_at)
              FROM public.stream_analytics_events e
              WHERE e.stream_id = s.stream_id
                AND e.event_type = 'stream_end'
                AND e.created_at > s.created_at
            ), now()),
            s.created_at + interval '12 hours'
          ) - s.created_at
        )) / 60)
      )::bigint AS minutes
    FROM public.stream_analytics_events s
    WHERE s.event_type = 'stream_start'
      AND s.created_at >= current_date - interval '30 days'
  ),
  stream_daily AS (
    SELECT
      date,
      COALESCE(SUM(minutes), 0)::bigint AS total_stream_minutes,
      COUNT(DISTINCT stream_id)::bigint AS unique_streams
    FROM stream_sessions
    GROUP BY date
  ),
  gift_daily AS (
    SELECT
      created_at::date AS date,
      COUNT(*)::bigint AS total_gifts_count,
      COALESCE(SUM(GREATEST(COALESCE(gift_amount, 0), 0)), 0)::bigint AS total_gift_coins,
      COUNT(DISTINCT user_id)::bigint AS gift_users
    FROM public.stream_analytics_events
    WHERE event_type = 'gift'
      AND created_at >= current_date - interval '30 days'
    GROUP BY created_at::date
  ),
  concurrent_points AS (
    SELECT
      created_at::date AS date,
      SUM(CASE WHEN event_type = 'join' THEN 1 WHEN event_type = 'leave' THEN -1 ELSE 0 END)
        OVER (PARTITION BY stream_id, created_at::date ORDER BY created_at, id) AS concurrent_viewers
    FROM public.stream_analytics_events
    WHERE event_type IN ('join', 'leave')
      AND created_at >= current_date - interval '30 days'
  ),
  peak_daily AS (
    SELECT
      date,
      GREATEST(COALESCE(MAX(concurrent_viewers), 0), 0)::bigint AS peak_concurrent_viewers
    FROM concurrent_points
    GROUP BY date
  )
  INSERT INTO public.stream_analytics_daily (
    date,
    total_viewer_minutes,
    total_stream_minutes,
    total_gifts_count,
    total_gift_coins,
    unique_viewers,
    unique_streams,
    avg_watch_time_per_user,
    avg_stream_duration,
    avg_gifts_per_user,
    peak_concurrent_viewers
  )
  SELECT
    d.date,
    COALESCE(v.total_viewer_minutes, 0),
    COALESCE(s.total_stream_minutes, 0),
    COALESCE(g.total_gifts_count, 0),
    COALESCE(g.total_gift_coins, 0),
    COALESCE(v.unique_viewers, 0),
    COALESCE(s.unique_streams, 0),
    CASE WHEN COALESCE(v.unique_viewers, 0) > 0 THEN ROUND(COALESCE(v.total_viewer_minutes, 0)::numeric / v.unique_viewers, 2) ELSE 0 END,
    CASE WHEN COALESCE(s.unique_streams, 0) > 0 THEN ROUND(COALESCE(s.total_stream_minutes, 0)::numeric / s.unique_streams, 2) ELSE 0 END,
    CASE WHEN COALESCE(g.gift_users, 0) > 0 THEN ROUND(COALESCE(g.total_gifts_count, 0)::numeric / g.gift_users, 2) ELSE 0 END,
    COALESCE(p.peak_concurrent_viewers, 0)
  FROM days d
  LEFT JOIN viewer_daily v ON v.date = d.date
  LEFT JOIN stream_daily s ON s.date = d.date
  LEFT JOIN gift_daily g ON g.date = d.date
  LEFT JOIN peak_daily p ON p.date = d.date
  ON CONFLICT (date) DO UPDATE
  SET total_viewer_minutes = EXCLUDED.total_viewer_minutes,
      total_stream_minutes = EXCLUDED.total_stream_minutes,
      total_gifts_count = EXCLUDED.total_gifts_count,
      total_gift_coins = EXCLUDED.total_gift_coins,
      unique_viewers = EXCLUDED.unique_viewers,
      unique_streams = EXCLUDED.unique_streams,
      avg_watch_time_per_user = EXCLUDED.avg_watch_time_per_user,
      avg_stream_duration = EXCLUDED.avg_stream_duration,
      avg_gifts_per_user = EXCLUDED.avg_gifts_per_user,
      peak_concurrent_viewers = EXCLUDED.peak_concurrent_viewers;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aggregate_stream_analytics() TO authenticated, service_role;

DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aggregate-stream-analytics-5min') THEN
      PERFORM cron.schedule(
        'aggregate-stream-analytics-5min',
        '*/5 * * * *',
        'SELECT public.aggregate_stream_analytics();'
      );
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'stream analytics cron schedule skipped: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_stream_gift_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount bigint;
BEGIN
  v_amount := GREATEST(COALESCE(NEW.coins_amount, NEW.coins_spent, NEW.amount, 0), 0)::bigint;
  PERFORM public.log_stream_analytics_event(NEW.stream_id, NEW.sender_id, 'gift', v_amount);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_stream_gift_analytics ON public.stream_gifts;
CREATE TRIGGER trg_track_stream_gift_analytics
AFTER INSERT ON public.stream_gifts
FOR EACH ROW
EXECUTE FUNCTION public.track_stream_gift_analytics();

CREATE OR REPLACE FUNCTION public.track_stream_lifecycle_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  v_owner := COALESCE(NEW.user_id, NEW.broadcaster_id);

  IF TG_OP = 'INSERT' AND (COALESCE(NEW.is_live, false) = true OR NEW.status = 'live') THEN
    PERFORM public.log_stream_analytics_event(NEW.id, v_owner, 'stream_start', NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    IF (COALESCE(NEW.is_live, false) = true OR NEW.status = 'live')
       AND NOT (COALESCE(OLD.is_live, false) = true OR OLD.status = 'live') THEN
      PERFORM public.log_stream_analytics_event(NEW.id, v_owner, 'stream_start', NULL);
    END IF;

    IF (COALESCE(OLD.is_live, false) = true OR OLD.status = 'live')
       AND NOT (COALESCE(NEW.is_live, false) = true OR NEW.status = 'live') THEN
      PERFORM public.log_stream_analytics_event(NEW.id, v_owner, 'stream_end', NULL);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_stream_lifecycle_analytics ON public.streams;
CREATE TRIGGER trg_track_stream_lifecycle_analytics
AFTER INSERT OR UPDATE OF is_live, status ON public.streams
FOR EACH ROW
EXECUTE FUNCTION public.track_stream_lifecycle_analytics();

NOTIFY pgrst, 'reload schema';
