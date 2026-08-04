-- Allow immediate random battle rematches with any eligible broadcaster,
-- including opponents that were already faced in a previous battle.
-- This removes cooldown gating from random queue matchmaking.

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
  v_started_at timestamptz := now() + interval '10 seconds';
  v_ends_at timestamptz := now() + interval '3 minutes 10 seconds';
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

CREATE OR REPLACE FUNCTION public.finish_random_battle(
  p_battle_id uuid,
  p_end_reason text DEFAULT 'timer_expired'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.battles%ROWTYPE;
  v_winner_stream_id uuid;
  v_winner_id uuid;
BEGIN
  SELECT *
    INTO v_battle
  FROM public.battles
  WHERE id = p_battle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not found');
  END IF;

  IF v_battle.status = 'ended' THEN
    RETURN jsonb_build_object('success', true, 'winner_stream_id', v_battle.winner_stream_id, 'already_ended', true);
  END IF;

  IF COALESCE(v_battle.score_challenger, 0) > COALESCE(v_battle.score_opponent, 0) THEN
    v_winner_stream_id := v_battle.challenger_stream_id;
  ELSIF COALESCE(v_battle.score_opponent, 0) > COALESCE(v_battle.score_challenger, 0) THEN
    v_winner_stream_id := v_battle.opponent_stream_id;
  END IF;

  IF v_winner_stream_id IS NOT NULL THEN
    SELECT user_id INTO v_winner_id
    FROM public.streams
    WHERE id = v_winner_stream_id;
  END IF;

  UPDATE public.battles
  SET status = 'ended',
      ended_at = now(),
      winner_stream_id = v_winner_stream_id,
      winner_id = v_winner_id
  WHERE id = p_battle_id;

  UPDATE public.streams
  SET is_battle = false,
      battle_id = null,
      battle_mode = 'manual',
      battle_status = 'waiting',
      battle_start_time = null,
      battle_end_time = now(),
      battle_end_reason = p_end_reason,
      battle_winner_id = v_winner_id,
      battle_forfeited_by = null,
      random_battle_queue_enabled = false,
      random_battle_queued_at = null,
      random_battle_cooldown_until = null
  WHERE battle_id = p_battle_id
    AND battle_mode = 'random_queue';

  IF v_winner_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET battle_crowns = COALESCE(battle_crowns, 0) + 1,
        battle_crown_streak = COALESCE(battle_crown_streak, 0) + 1,
        total_battle_wins = COALESCE(total_battle_wins, 0) + 1
    WHERE id = v_winner_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'winner_stream_id', v_winner_stream_id,
    'winner_id', v_winner_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.forfeit_random_battle(
  p_stream_id uuid,
  p_broadcaster_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle record;
  v_forfeiter_stream_id uuid;
  v_winner_stream_id uuid;
  v_winner_id uuid;
BEGIN
  SELECT b.*
    INTO v_battle
  FROM public.battles b
  JOIN public.streams s ON s.id IN (b.challenger_stream_id, b.opponent_stream_id)
  WHERE s.id = p_stream_id
    AND s.user_id = p_broadcaster_id
    AND s.battle_mode = 'random_queue'
    AND b.status <> 'ended'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Random battle not found');
  END IF;

  v_forfeiter_stream_id := p_stream_id;
  v_winner_stream_id := CASE
    WHEN v_battle.challenger_stream_id = p_stream_id THEN v_battle.opponent_stream_id
    ELSE v_battle.challenger_stream_id
  END;

  SELECT user_id INTO v_winner_id
  FROM public.streams
  WHERE id = v_winner_stream_id
  FOR UPDATE;

  UPDATE public.battles
  SET status = 'ended',
      ended_at = now(),
      winner_stream_id = v_winner_stream_id
  WHERE id = v_battle.id;

UPDATE public.streams
SET is_battle = false,
    battle_id = null,
    battle_mode = 'manual',
    battle_status = 'waiting',
    battle_start_time = null,
    battle_end_time = now(),
    battle_end_reason = 'forfeit',
    battle_winner_id = v_winner_id,
    battle_forfeited_by = p_broadcaster_id,
    random_battle_queue_enabled = false,
    random_battle_queued_at = null,
    random_battle_cooldown_until = null
WHERE id = v_forfeiter_stream_id;  -- Only clear from forfeiting stream, winner stays in broadcast

  UPDATE public.user_profiles
  SET battle_crowns = COALESCE(battle_crowns, 0) + 2
  WHERE id = v_winner_id;

  RETURN jsonb_build_object(
    'success', true,
    'battle_id', v_battle.id,
    'winner_id', v_winner_id,
    'winner_stream_id', v_winner_stream_id,
    'coins_awarded_to_forfeiter', 0,
    'crowns_awarded_to_winner', 2
  );
END;
$$;

-- One-time cleanup for streams stuck in ended/random_queue state from prior logic.
UPDATE public.streams
SET battle_id = null,
    battle_mode = 'manual',
    battle_status = 'waiting',
    battle_start_time = null,
    random_battle_queue_enabled = false,
    random_battle_queued_at = null,
    random_battle_cooldown_until = null
WHERE COALESCE(is_battle, false) = false
  AND (
    battle_id IS NOT NULL
    OR battle_mode = 'random_queue'
    OR battle_status IN ('ended', 'active', 'starting')
  );
