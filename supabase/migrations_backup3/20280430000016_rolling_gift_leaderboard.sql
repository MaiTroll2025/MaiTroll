-- Rolling gift leaderboard.
-- Uses live gift transactions instead of stale all-time broadcaster totals.

CREATE INDEX IF NOT EXISTS idx_stream_gifts_created_at
  ON public.stream_gifts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stream_gifts_receiver_created_at
  ON public.stream_gifts(receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stream_gifts_recipient_created_at
  ON public.stream_gifts(recipient_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_gift_leaderboard(
  p_window text DEFAULT 'day',
  p_direction text DEFAULT 'received',
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  rgb_username_expires_at timestamptz,
  glowing_username_color text,
  created_at timestamptz,
  total_gift_coins bigint,
  gift_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT CASE lower(COALESCE(p_window, 'day'))
      WHEN '30m' THEN interval '30 minutes'
      WHEN '30min' THEN interval '30 minutes'
      WHEN 'hour' THEN interval '1 hour'
      WHEN '1h' THEN interval '1 hour'
      WHEN 'week' THEN interval '7 days'
      WHEN 'month' THEN interval '30 days'
      ELSE interval '1 day'
    END AS window_interval
  ),
  normalized AS (
    SELECT
      sg.sender_id,
      COALESCE(sg.receiver_id, sg.recipient_id) AS receiver_id,
      GREATEST(
        COALESCE(
          sg.coins_amount,
          sg.coins_spent,
          sg.amount,
          CASE
            WHEN (sg.metadata->>'gift_value') ~ '^[0-9]+(\.[0-9]+)?$'
              THEN (sg.metadata->>'gift_value')::numeric
            ELSE 0
          END,
          0
        ),
        0
      )::bigint AS coin_value,
      sg.created_at
    FROM public.stream_gifts sg, bounds b
    WHERE sg.created_at >= now() - b.window_interval
      AND sg.sender_id IS NOT NULL
      AND COALESCE(sg.receiver_id, sg.recipient_id) IS NOT NULL
  ),
  ranked AS (
    SELECT
      CASE
        WHEN lower(COALESCE(p_direction, 'received')) IN ('sent', 'gifters', 'sender') THEN sender_id
        ELSE receiver_id
      END AS leaderboard_user_id,
      SUM(coin_value)::bigint AS total_gift_coins,
      COUNT(*)::bigint AS gift_count
    FROM normalized
    WHERE coin_value > 0
    GROUP BY 1
  )
  SELECT
    up.id AS user_id,
    up.username,
    up.avatar_url,
    up.rgb_username_expires_at,
    up.glowing_username_color,
    up.created_at,
    r.total_gift_coins,
    r.gift_count
  FROM ranked r
  JOIN public.user_profiles up ON up.id = r.leaderboard_user_id
  WHERE r.total_gift_coins > 0
  ORDER BY r.total_gift_coins DESC, r.gift_count DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_gift_leaderboard(text, text, integer) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
