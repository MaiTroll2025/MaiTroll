BEGIN;

ALTER TABLE public.broadcaster_battle_unlocks
  ALTER COLUMN initial_target_coins SET DEFAULT 100;

CREATE TABLE IF NOT EXISTS public.battle_starter_coin_grants (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 100 CHECK (amount = 100),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.grant_battle_starter_coins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.battle_starter_coin_grants (user_id, amount)
  VALUES (NEW.id, 100)
  ON CONFLICT (user_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + 100
  WHERE id = NEW.id;

  INSERT INTO public.coin_transactions (
    user_id, amount, type, description, metadata
  )
  VALUES (
    NEW.id,
    100,
    'battle_starter_bonus',
    '100 Battle Starter Coins',
    jsonb_build_object(
      'source', 'battle_starter_signup_grant',
      'cashout_balance', true
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_battle_starter_coins_on_signup
  ON public.user_profiles;
CREATE TRIGGER grant_battle_starter_coins_on_signup
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_battle_starter_coins();

REVOKE ALL ON FUNCTION public.grant_battle_starter_coins() FROM PUBLIC;
ALTER TABLE public.battle_starter_coin_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.battle_starter_coin_grants FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.battle_starter_coin_grants TO service_role;

UPDATE public.battle_pot_rounds
SET target_coins = CASE round_type
      WHEN 'initial_unlock' THEN 100
      WHEN 'subsequent_battle' THEN 10
    END,
    status = CASE
      WHEN collected_coins >= CASE round_type
        WHEN 'initial_unlock' THEN 100
        WHEN 'subsequent_battle' THEN 10
      END
      THEN 'reached'
      ELSE status
    END,
    reached_at = CASE
      WHEN collected_coins >= CASE round_type
        WHEN 'initial_unlock' THEN 100
        WHEN 'subsequent_battle' THEN 10
      END
      THEN COALESCE(reached_at, NOW())
      ELSE reached_at
    END,
    updated_at = NOW()
WHERE status IN ('open', 'reached')
  AND round_type IN ('initial_unlock', 'subsequent_battle');

UPDATE public.user_profiles profile
SET battle_unlocked = TRUE,
    battle_unlocked_at = COALESCE(profile.battle_unlocked_at, NOW())
WHERE EXISTS (
  SELECT 1
  FROM public.battle_pot_rounds round
  WHERE round.broadcaster_id = profile.id
    AND round.round_type = 'initial_unlock'
    AND round.status = 'reached'
    AND round.collected_coins >= round.target_coins
);

INSERT INTO public.broadcaster_battle_unlocks (
  user_id, unlocked_at, initial_target_coins
)
SELECT profile.id, COALESCE(profile.battle_unlocked_at, NOW()), 100
FROM public.user_profiles profile
WHERE profile.battle_unlocked IS TRUE
ON CONFLICT (user_id) DO UPDATE
SET initial_target_coins = 100;

CREATE OR REPLACE FUNCTION public.create_next_battle_round(
  p_broadcaster_id UUID,
  p_stream_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id UUID;
  v_existing_open BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_broadcaster_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT battle_unlocked INTO v_existing_open
  FROM public.user_profiles
  WHERE id = p_broadcaster_id;

  IF NOT v_existing_open THEN
    RETURN jsonb_build_object('success', false, 'error', 'Broadcaster has not unlocked battles');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.battle_pot_rounds
    WHERE broadcaster_id = p_broadcaster_id
      AND round_type = 'subsequent_battle'
      AND status = 'open'
  ) INTO v_existing_open;

  IF v_existing_open THEN
    RETURN jsonb_build_object('success', false, 'error', 'Open round already exists');
  END IF;

  INSERT INTO public.battle_pot_rounds (
    broadcaster_id, stream_id, round_type, target_coins, collected_coins, status,
    idempotency_key
  ) VALUES (
    p_broadcaster_id, p_stream_id, 'subsequent_battle', 10, 0, 'open',
    gen_random_uuid()::text
  )
  RETURNING id INTO v_round_id;

  RETURN jsonb_build_object(
    'success', true,
    'round_id', v_round_id,
    'target_coins', 10,
    'collected_coins', 0,
    'remaining', 10,
    'status', 'open'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_battle_pot_state(
  p_broadcaster_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unlocked BOOLEAN := FALSE;
  v_collected INTEGER := 0;
  v_target INTEGER := 0;
  v_status TEXT := 'locked';
  v_round_type TEXT;
  v_round_id UUID;
BEGIN
  SELECT battle_unlocked INTO v_unlocked
  FROM public.user_profiles
  WHERE id = p_broadcaster_id;

  IF NOT v_unlocked THEN
    SELECT id, target_coins, collected_coins, status, round_type
    INTO v_round_id, v_target, v_collected, v_status, v_round_type
    FROM public.battle_pot_rounds
    WHERE broadcaster_id = p_broadcaster_id
      AND round_type = 'initial_unlock'
      AND status IN ('open', 'reached')
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      INSERT INTO public.battle_pot_rounds (
        broadcaster_id, round_type, target_coins, collected_coins, status, idempotency_key
      ) VALUES (
        p_broadcaster_id, 'initial_unlock', 100, 0, 'open', gen_random_uuid()::text
      )
      RETURNING id, target_coins, collected_coins, status, round_type
      INTO v_round_id, v_target, v_collected, v_status, v_round_type;
    END IF;

    RETURN jsonb_build_object(
      'unlocked', false,
      'round_id', v_round_id,
      'round_type', v_round_type,
      'target_coins', v_target,
      'collected_coins', v_collected,
      'remaining', GREATEST(0, v_target - v_collected),
      'status', v_status
    );
  END IF;

  SELECT id, target_coins, collected_coins, status, round_type
  INTO v_round_id, v_target, v_collected, v_status, v_round_type
  FROM public.battle_pot_rounds
  WHERE broadcaster_id = p_broadcaster_id
    AND round_type = 'subsequent_battle'
    AND status = 'open'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'unlocked', true,
      'round_id', NULL,
      'round_type', NULL,
      'target_coins', 10,
      'collected_coins', 0,
      'remaining', 10,
      'status', 'no_open_round'
    );
  END IF;

  RETURN jsonb_build_object(
    'unlocked', true,
    'round_id', v_round_id,
    'round_type', v_round_type,
    'target_coins', v_target,
    'collected_coins', v_collected,
    'remaining', GREATEST(0, v_target - v_collected),
    'status', v_status
  );
END;
$$;

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
  v_unlocked BOOLEAN := FALSE;
  v_round_status TEXT;
BEGIN
  IF auth.uid() IS NULL
     OR auth.uid() IS DISTINCT FROM p_broadcaster_id THEN
    RETURN jsonb_build_object(
      'matched', false,
      'message', 'Unauthorized'
    );
  END IF;

  SELECT * INTO v_self
  FROM public.streams
  WHERE id = p_stream_id AND user_id = p_broadcaster_id
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

  SELECT * INTO v_opponent
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
    challenger_stream_id, opponent_stream_id, status, started_at, ends_at,
    score_challenger, score_opponent
  )
  VALUES (
    p_stream_id, v_opponent.id, 'active', v_started_at, v_ends_at, 0, 0
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
  WHERE stream_id = v_self.id AND status = 'active' AND user_id IS NOT NULL
  ON CONFLICT (battle_id, user_id) DO NOTHING;

  INSERT INTO public.battle_participants (battle_id, user_id, team, role, source_stream_id, seat_index)
  SELECT v_battle_id, user_id, 'opponent', 'stage', v_opponent.id, seat_index
  FROM public.stream_seat_sessions
  WHERE stream_id = v_opponent.id AND status = 'active' AND user_id IS NOT NULL
  ON CONFLICT (battle_id, user_id) DO NOTHING;

  UPDATE public.battle_pot_rounds
  SET status = 'battle_started', battle_id = v_battle_id, updated_at = NOW()
  WHERE id = (
    SELECT id
    FROM public.battle_pot_rounds
    WHERE broadcaster_id = p_broadcaster_id
      AND round_type = 'subsequent_battle'
      AND status = 'reached'
    ORDER BY created_at DESC
    LIMIT 1
  );

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

GRANT EXECUTE ON FUNCTION public.create_next_battle_round(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_battle_pot_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_random_battle_match(UUID, UUID) TO authenticated;

COMMENT ON TABLE public.battle_pot_rounds IS
  'Battle Pot rounds: 100 coins for first-time unlock and 10 coins for each subsequent random battle.';

COMMIT;
