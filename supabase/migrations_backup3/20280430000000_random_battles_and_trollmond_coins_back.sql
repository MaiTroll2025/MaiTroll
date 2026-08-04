-- Random Battle Queue + Trollmond coins-back gifting.
-- This migration is intentionally additive around existing broadcast and LiveKit flows.

ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS random_battle_queue_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS random_battle_queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS random_battle_cooldown_until timestamptz,
  ADD COLUMN IF NOT EXISTS battle_end_reason text,
  ADD COLUMN IF NOT EXISTS battle_winner_id uuid,
  ADD COLUMN IF NOT EXISTS battle_forfeited_by uuid;

-- battle_mode already exists in this app. Keep existing values valid while adding random_queue.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'streams_battle_mode_allowed'
  ) THEN
    ALTER TABLE public.streams
      ADD CONSTRAINT streams_battle_mode_allowed
      CHECK (battle_mode IS NULL OR battle_mode IN ('manual', 'random_queue', 'universal', 'troll'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'streams_battle_end_reason_allowed'
  ) THEN
    ALTER TABLE public.streams
      ADD CONSTRAINT streams_battle_end_reason_allowed
      CHECK (battle_end_reason IS NULL OR battle_end_reason IN ('timer_expired', 'broadcaster_left', 'forfeit', 'admin_ended', 'disconnected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_streams_random_battle_queue
  ON public.streams (category, status, random_battle_queue_enabled, random_battle_queued_at)
  WHERE random_battle_queue_enabled = true;

ALTER TABLE public.stream_gifts
  ADD COLUMN IF NOT EXISTS recipient_id uuid,
  ADD COLUMN IF NOT EXISTS amount integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS currency_used text,
  ADD COLUMN IF NOT EXISTS trollmonds_spent integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_back integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transaction_type text;

ALTER TABLE public.coin_transactions
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS transaction_type text;

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
  v_started_at timestamptz := now();
  v_ends_at timestamptz := now() + interval '3 minutes';
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
    ends_at
  )
  VALUES (
    p_stream_id,
    v_opponent.id,
    'active',
    v_started_at,
    v_ends_at
  )
  RETURNING id INTO v_battle_id;

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
  v_cooldown_until timestamptz := now() + interval '5 minutes';
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

  -- Only clear battle from the forfeiting stream.
  -- The winning broadcaster stays live on their broadcast page with viewers.
  UPDATE public.streams
  SET is_battle = false,
      battle_status = 'ended',
      battle_end_time = now(),
      battle_end_reason = 'forfeit',
      battle_winner_id = v_winner_id,
      battle_forfeited_by = p_broadcaster_id,
      random_battle_queue_enabled = false,
      random_battle_queued_at = null,
      random_battle_cooldown_until = v_cooldown_until
  WHERE id = v_forfeiter_stream_id;

  -- Update the winning stream's battle state so it reflects the ended battle
  -- but keeps the stream live (is_battle = true so the battle overlay shows results)
  UPDATE public.streams
  SET battle_status = 'ended',
      battle_end_time = now(),
      battle_end_reason = 'forfeit',
      battle_winner_id = v_winner_id,
      battle_forfeited_by = p_broadcaster_id
  WHERE id = v_winner_stream_id;

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

GRANT EXECUTE ON FUNCTION public.forfeit_random_battle(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_gift_in_stream(
  p_sender_id uuid,
  p_receiver_id uuid,
  p_stream_id uuid,
  p_gift_id text,
  p_quantity integer,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender public.user_profiles%ROWTYPE;
  v_gift_cost integer;
  v_total_cost integer;
  v_gift_name text;
  v_battle_id uuid;
  v_is_challenger boolean;
  v_currency_used text := 'coins';
  v_trollmonds_spent integer := 0;
  v_coins_back integer := 0;
  v_recipient_share integer;
  v_txn_key text := nullif(p_metadata->>'txn_key', '');
  v_existing_id uuid;
  v_sender_name text;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    p_quantity := 1;
  END IF;

  IF v_txn_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.stream_gifts
    WHERE sender_id = p_sender_id
      AND metadata->>'txn_key' = v_txn_key
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'transaction_id', v_existing_id);
    END IF;
  END IF;

  SELECT cost::integer, name
    INTO v_gift_cost, v_gift_name
  FROM public.gifts
  WHERE id::text = p_gift_id OR slug = p_gift_id
  LIMIT 1;

  IF v_gift_cost IS NULL THEN
    SELECT value::integer, name
      INTO v_gift_cost, v_gift_name
    FROM public.gift_items
    WHERE id::text = p_gift_id OR slug = p_gift_id
    LIMIT 1;
  END IF;

  IF v_gift_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift not found');
  END IF;

  v_total_cost := v_gift_cost * p_quantity;

  SELECT * INTO v_sender
  FROM public.user_profiles
  WHERE id = p_sender_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sender not found');
  END IF;

  PERFORM 1 FROM public.user_profiles WHERE id = p_receiver_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Recipient not found');
  END IF;

  IF COALESCE(v_sender.trollmonds, 0) >= v_total_cost THEN
    v_currency_used := 'trollmonds';
    v_trollmonds_spent := v_total_cost;
    v_coins_back := floor(v_total_cost * 0.10);
    v_recipient_share := v_total_cost;

    UPDATE public.user_profiles
    SET trollmonds = COALESCE(trollmonds, 0) - v_trollmonds_spent,
        troll_coins = COALESCE(troll_coins, 0) + v_coins_back
    WHERE id = p_sender_id
      AND COALESCE(trollmonds, 0) >= v_trollmonds_spent;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'Insufficient Trollmonds');
    END IF;

    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_recipient_share,
        total_earned_coins = COALESCE(total_earned_coins, 0) + v_recipient_share
    WHERE id = p_receiver_id;
  ELSE
    IF COALESCE(v_sender.troll_coins, 0) < v_total_cost THEN
      RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
    END IF;

    v_coins_back := floor(v_total_cost * 0.10);
    v_recipient_share := floor(v_total_cost * 0.95);

    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) - v_total_cost + v_coins_back
    WHERE id = p_sender_id
      AND COALESCE(troll_coins, 0) >= v_total_cost;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
    END IF;

    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_recipient_share,
        total_earned_coins = COALESCE(total_earned_coins, 0) + v_recipient_share
    WHERE id = p_receiver_id;
  END IF;

  IF p_stream_id IS NOT NULL THEN
    UPDATE public.streams
    SET total_gifts_coins = COALESCE(total_gifts_coins, 0) + v_total_cost
    WHERE id = p_stream_id;
  END IF;

  INSERT INTO public.stream_gifts (
    stream_id,
    sender_id,
    receiver_id,
    recipient_id,
    gift_id,
    gift_type,
    quantity,
    amount,
    coins_spent,
    coins_amount,
    currency_used,
    trollmonds_spent,
    coins_back,
    transaction_type,
    metadata
  ) VALUES (
    p_stream_id,
    p_sender_id,
    p_receiver_id,
    p_receiver_id,
    p_gift_id,
    p_gift_id,
    p_quantity,
    v_total_cost,
    CASE WHEN v_currency_used = 'coins' THEN v_total_cost ELSE 0 END,
    v_total_cost,
    v_currency_used,
    v_trollmonds_spent,
    v_coins_back,
    CASE WHEN v_currency_used = 'trollmonds' THEN 'trollmond_gift' ELSE 'gift' END,
    p_metadata || jsonb_build_object(
      'gift_value', v_total_cost,
      'currency_used', v_currency_used,
      'trollmonds_spent', v_trollmonds_spent,
      'coins_back', v_coins_back,
      'transaction_type', CASE WHEN v_currency_used = 'trollmonds' THEN 'trollmond_gift' ELSE 'gift' END,
      'coins_back_source', 'gift_return_reward'
    )
  )
  RETURNING id INTO v_existing_id;

  INSERT INTO public.coin_transactions (
    user_id,
    amount,
    type,
    currency,
    transaction_type,
    metadata
  ) VALUES
  (
    p_sender_id,
    CASE WHEN v_currency_used = 'coins' THEN -v_total_cost ELSE 0 END,
    CASE WHEN v_currency_used = 'trollmonds' THEN 'trollmond_gift' ELSE 'gift_sent' END,
    v_currency_used,
    CASE WHEN v_currency_used = 'trollmonds' THEN 'trollmond_gift' ELSE 'gift_sent' END,
    jsonb_build_object('recipient_id', p_receiver_id, 'stream_id', p_stream_id, 'gift_id', p_gift_id, 'gift_value', v_total_cost, 'trollmonds_spent', v_trollmonds_spent, 'coins_back', v_coins_back, 'stream_gift_id', v_existing_id)
  ),
  (
    p_receiver_id,
    v_recipient_share,
    'gift_received',
    'coins',
    'gift_received',
    jsonb_build_object('sender_id', p_sender_id, 'stream_id', p_stream_id, 'gift_id', p_gift_id, 'gift_value', v_total_cost, 'stream_gift_id', v_existing_id)
  );

  IF v_coins_back > 0 THEN
    INSERT INTO public.coin_transactions (
      user_id,
      amount,
      type,
      currency,
      transaction_type,
      metadata
    ) VALUES (
      p_sender_id,
      v_coins_back,
      'gift_return_reward',
      'coins',
      'gift_return_reward',
      jsonb_build_object('stream_id', p_stream_id, 'gift_id', p_gift_id, 'gift_value', v_total_cost, 'stream_gift_id', v_existing_id)
    );
  END IF;

  IF p_stream_id IS NOT NULL THEN
    INSERT INTO public.stream_messages (stream_id, user_id, content, type)
    VALUES (
      p_stream_id,
      p_sender_id,
      CASE
        WHEN v_currency_used = 'trollmonds'
          THEN 'GIFT_EVENT:' || COALESCE(v_gift_name, p_gift_id) || ':' || p_quantity || ':' || v_total_cost || ':trollmonds:' || v_coins_back
        ELSE 'GIFT_EVENT:' || COALESCE(v_gift_name, p_gift_id) || ':' || p_quantity || ':' || v_total_cost
      END,
      'system'
    );

    IF v_coins_back > 0 THEN
      SELECT COALESCE(username, display_name, split_part(email, '@', 1), 'Troll Citizen')
        INTO v_sender_name
      FROM public.user_profiles
      WHERE id = p_sender_id;

      INSERT INTO public.stream_messages (stream_id, user_id, content, type)
      VALUES (
        p_stream_id,
        p_sender_id,
        COALESCE(v_sender_name, 'Troll Citizen') || ' got ' || v_coins_back || ' coins back',
        'system'
      );
    END IF;
  END IF;

  SELECT id, (challenger_stream_id = p_stream_id) INTO v_battle_id, v_is_challenger
  FROM public.battles
  WHERE (challenger_stream_id = p_stream_id OR opponent_stream_id = p_stream_id)
    AND status = 'active'
  LIMIT 1;

  IF v_battle_id IS NOT NULL THEN
    IF v_is_challenger THEN
      UPDATE public.battles
      SET score_challenger = COALESCE(score_challenger, 0) + v_total_cost,
          pot_challenger = COALESCE(pot_challenger, 0) + v_total_cost
      WHERE id = v_battle_id;
    ELSE
      UPDATE public.battles
      SET score_opponent = COALESCE(score_opponent, 0) + v_total_cost,
          pot_opponent = COALESCE(pot_opponent, 0) + v_total_cost
      WHERE id = v_battle_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_existing_id,
    'currency_used', v_currency_used,
    'gift_value', v_total_cost,
    'trollmonds_spent', v_trollmonds_spent,
    'coins_back', v_coins_back,
    'message', 'Gift sent successfully'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(uuid, uuid, uuid, text, integer, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_gift(
  p_stream_id uuid,
  p_recipient_id uuid,
  p_gift_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.send_gift_in_stream(
    auth.uid(),
    p_recipient_id,
    p_stream_id,
    p_gift_id::text,
    p_quantity,
    jsonb_build_object('txn_key', gen_random_uuid()::text, 'source', 'send_gift')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_gift(uuid, uuid, uuid, integer) TO authenticated;
