-- ============================================================================
-- Canonical find_random_battle_match
-- ============================================================================
-- The live RPC had drifted from the source of truth: it was replaced with a
-- custom version that gated on JWT auth (returning code=NOT_AUTHENTICATED to
-- service-role calls) and returned {success, match_found} instead of the
-- {matched, battle_id, ...} shape useRandomBattleQueueController reads. The
-- client checks data?.matched, so matches were never detected and the
-- `battles` table stayed empty.
--
-- This restores the canonical SECURITY DEFINER implementation (no JWT gate):
--   * matches any queued, live, 'general' stream that is not on cooldown and
--     not already in a battle,
--   * atomically spawns the battle with status='active' and sets BOTH streams
--     to battle_status='starting' with a 10s battle_start_time,
--   * returns {matched, battle_id, opponent_stream_id, opponent_broadcaster_id,
--     battle_started_at, battle_ends_at} exactly as the client expects.
-- Together with 20290801000004 (pg_cron safety net) the 10s prep is resolved
-- server-side and the arena opens reliably via realtime.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.find_random_battle_match(
  p_stream_id uuid,
  p_broadcaster_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_self public.streams%ROWTYPE;
  v_opponent public.streams%ROWTYPE;
  v_battle_id uuid;
  v_started_at timestamptz := now() + interval ' seconds';
  v_ends_at timestamptz := now() + interval '3 minutes 0 seconds';
BEGIN
  SELECT *
    INTO v_self
  FROM public.streams
  WHERE id = p_stream_id
    AND user_id = p_broadcaster_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('matched', false, 'message', 'Stream not found');
  END IF;

  IF v_self.category <> 'general'
    OR v_self.status <> 'live'
    OR COALESCE(v_self.random_battle_queue_enabled, false) = false
    OR COALESCE(v_self.is_battle, false) = true
    OR v_self.battle_id IS NOT NULL
    OR (v_self.random_battle_cooldown_until IS NOT NULL AND v_self.random_battle_cooldown_until > now())
  THEN
    RETURN jsonb_build_object('matched', false, 'message', 'Stream not eligible');
  END IF;

  SELECT *
    INTO v_opponent
  FROM public.streams
  WHERE id <> p_stream_id
    AND category = 'general'
    AND status = 'live'
    AND COALESCE(random_battle_queue_enabled, false) = true
    AND COALESCE(is_battle, false) = false
    AND battle_id IS NULL
    AND user_id <> p_broadcaster_id
    AND (random_battle_cooldown_until IS NULL OR random_battle_cooldown_until <= now())
  ORDER BY random_battle_queued_at NULLS FIRST, started_at NULLS LAST, created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    UPDATE public.streams
    SET random_battle_queue_enabled = true,
        random_battle_queued_at = COALESCE(random_battle_queued_at, now())
    WHERE id = p_stream_id;

    RETURN jsonb_build_object('matched', false, 'message', 'No opponent available');
  END IF;

  INSERT INTO public.battles (
    challenger_stream_id,
    opponent_stream_id,
    status,
    started_at,
    ends_at,
    score_challenger,
    score_opponent
  )
  VALUES (
    p_stream_id,
    v_opponent.id,
    'active',
    v_started_at,
    v_ends_at,
    0,
    0
  )
  RETURNING id INTO v_battle_id;

  INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id, seat_index)
  VALUES
    (v_battle_id, v_self.user_id, 'challenger', 'host', v_self.id, 0),
    (v_battle_id, v_opponent.user_id, 'opponent', 'host', v_opponent.id, 0)
  ON CONFLICT (battle_id, user_id) DO NOTHING;

  INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id, seat_index)
  SELECT v_battle_id, user_id, 'challenger', 'stage', v_self.id, seat_index
  FROM public.stream_seat_sessions
  WHERE stream_id = v_self.id
    AND status = 'active'
    AND user_id IS NOT NULL
  ON CONFLICT (battle_id, user_id) DO NOTHING;

  INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id, seat_index)
  SELECT v_battle_id, user_id, 'opponent', 'stage', v_opponent.id, seat_index
  FROM public.stream_seat_sessions
  WHERE stream_id = v_opponent.id
    AND status = 'active'
    AND user_id IS NOT NULL
  ON CONFLICT (battle_id, user_id) DO NOTHING;

  UPDATE public.streams
  SET random_battle_queue_enabled = false,
      random_battle_queued_at = null,
      battle_mode = 'random_queue',
      battle_status = 'starting',
      is_battle = true,
      battle_id = v_battle_id,
      battle_start_time = v_started_at,
      battle_end_time = v_ends_at,
      battle_end_reason = null,
      battle_winner_id = null,
      battle_forfeited_by = null
  WHERE id IN (p_stream_id, v_opponent.id);

  RETURN jsonb_build_object(
    'matched', true,
    'battle_id', v_battle_id,
    'opponent_stream_id', v_opponent.id,
    'opponent_broadcaster_id', v_opponent.user_id,
    'battle_started_at', v_started_at,
    'battle_ends_at', v_ends_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_random_battle_match(uuid, uuid) TO authenticated;
