-- Random battles: synced countdown, arena participants, winner finalization, rematch, and 15s sudden troll.
-- Additive only; does not touch LiveKit publishing behavior.

ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS winner_id uuid;

ALTER TABLE public.battle_participants
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.battle_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id uuid NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  amount numeric DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

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
    'pending',
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

CREATE OR REPLACE FUNCTION public.activate_random_battle(
  p_battle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.battles%ROWTYPE;
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
    RETURN jsonb_build_object('success', false, 'message', 'Battle already ended');
  END IF;

  IF v_battle.started_at > now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Countdown still running');
  END IF;

  UPDATE public.battles
  SET status = 'active'
  WHERE id = p_battle_id
    AND status <> 'active';

  UPDATE public.streams
  SET battle_status = 'active',
      is_battle = true
  WHERE battle_id = p_battle_id
    AND battle_mode = 'random_queue';

  RETURN jsonb_build_object('success', true);
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
      battle_status = 'ended',
      battle_end_time = now(),
      battle_end_reason = p_end_reason,
      battle_winner_id = v_winner_id,
      random_battle_queue_enabled = false,
      random_battle_queued_at = null,
      random_battle_cooldown_until = now() + interval '5 minutes'
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

CREATE OR REPLACE FUNCTION public.request_random_battle_rematch(
  p_battle_id uuid,
  p_stream_id uuid,
  p_broadcaster_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.battles%ROWTYPE;
  v_started_at timestamptz := now() + interval '10 seconds';
  v_ends_at timestamptz := now() + interval '3 minutes 10 seconds';
BEGIN
  SELECT *
    INTO v_battle
  FROM public.battles
  WHERE id = p_battle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.streams
    WHERE id = p_stream_id
      AND user_id = p_broadcaster_id
      AND battle_id = p_battle_id
      AND battle_mode = 'random_queue'
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  UPDATE public.battles
  SET status = 'pending',
      started_at = v_started_at,
      ends_at = v_ends_at,
      ended_at = null,
      winner_stream_id = null,
      winner_id = null,
      score_challenger = 0,
      score_opponent = 0
  WHERE id = p_battle_id;

  UPDATE public.streams
  SET is_battle = true,
      battle_status = 'starting',
      battle_start_time = v_started_at,
      battle_end_time = v_ends_at,
      battle_end_reason = null,
      battle_winner_id = null,
      battle_forfeited_by = null,
      random_battle_cooldown_until = null
  WHERE battle_id = p_battle_id
    AND battle_mode = 'random_queue';

  RETURN jsonb_build_object('success', true, 'battle_started_at', v_started_at, 'battle_ends_at', v_ends_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.troll_opponent(
  p_battle_id uuid,
  p_troller_id uuid,
  p_target_stream_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle public.battles%ROWTYPE;
  v_troller_team text;
  v_target_user_id uuid;
  v_target_coins numeric;
  v_deduction_amount numeric;
  v_seconds_until_end integer;
BEGIN
  SELECT *
    INTO v_battle
  FROM public.battles
  WHERE id = p_battle_id
  FOR UPDATE;

  IF NOT FOUND OR v_battle.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not found or not active');
  END IF;

  IF EXISTS (SELECT 1 FROM public.streams WHERE id = v_battle.challenger_stream_id AND user_id = p_troller_id) THEN
    v_troller_team := 'challenger';
  ELSIF EXISTS (SELECT 1 FROM public.streams WHERE id = v_battle.opponent_stream_id AND user_id = p_troller_id) THEN
    v_troller_team := 'opponent';
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'User is not a broadcaster in this battle');
  END IF;

  IF v_troller_team = 'challenger' AND p_target_stream_id <> v_battle.opponent_stream_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Can only troll the opponent');
  END IF;

  IF v_troller_team = 'opponent' AND p_target_stream_id <> v_battle.challenger_stream_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Can only troll the opponent');
  END IF;

  v_seconds_until_end := EXTRACT(EPOCH FROM (COALESCE(v_battle.ends_at, v_battle.started_at + interval '3 minutes') - now()))::integer;

  IF v_seconds_until_end > 15 OR v_seconds_until_end <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sudden troll is only available in the last 15 seconds');
  END IF;

  SELECT user_id INTO v_target_user_id
  FROM public.streams
  WHERE id = p_target_stream_id;

  SELECT troll_coins INTO v_target_coins
  FROM public.user_profiles
  WHERE id = v_target_user_id
  FOR UPDATE;

  IF COALESCE(v_target_coins, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Target has no coins to troll');
  END IF;

  v_deduction_amount := GREATEST(1, CEIL(v_target_coins * 0.01));

  UPDATE public.user_profiles
  SET troll_coins = GREATEST(0, COALESCE(troll_coins, 0) - v_deduction_amount)
  WHERE id = v_target_user_id;

  IF v_troller_team = 'challenger' THEN
    UPDATE public.battles
    SET score_challenger = COALESCE(score_challenger, 0) + v_deduction_amount::integer
    WHERE id = p_battle_id;
  ELSE
    UPDATE public.battles
    SET score_opponent = COALESCE(score_opponent, 0) + v_deduction_amount::integer
    WHERE id = p_battle_id;
  END IF;

  INSERT INTO public.battle_events (battle_id, event_type, user_id, target_user_id, amount, metadata)
  VALUES (
    p_battle_id,
    'troll',
    p_troller_id,
    v_target_user_id,
    v_deduction_amount,
    jsonb_build_object('troller_team', v_troller_team, 'target_coins_before', v_target_coins, 'sudden_troll_seconds_left', v_seconds_until_end)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Sudden troll successful!',
    'deduction', v_deduction_amount,
    'target_coins_before', v_target_coins,
    'target_coins_after', GREATEST(0, v_target_coins - v_deduction_amount)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_random_battle_match(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_random_battle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_random_battle(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_random_battle_rematch(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.troll_opponent(uuid, uuid, uuid) TO authenticated;
