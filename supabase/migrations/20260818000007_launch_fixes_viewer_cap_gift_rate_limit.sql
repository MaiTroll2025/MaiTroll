-- ============================================
-- LAUNCH FIX: Atomic gift rate limit + balance
-- safety + idempotency + recruiter fix
-- ============================================

-- 1. Gift rate limit table
CREATE TABLE IF NOT EXISTS public.gift_rate_limits (
  user_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_rate_limits_user_sent
  ON public.gift_rate_limits(user_id, sent_at);

-- Auto-cleanup old entries
CREATE OR REPLACE FUNCTION public.cleanup_old_gift_rate_limits()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.gift_rate_limits
  WHERE sent_at < now() - interval '1 hour';
END;
$$;

-- 2. Add txn_key column to stream_gifts for atomic idempotency
ALTER TABLE public.stream_gifts 
  ADD COLUMN IF NOT EXISTS txn_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stream_gifts_sender_txn_key 
ON public.stream_gifts(sender_id, txn_key) 
WHERE txn_key IS NOT NULL;

-- 3. Fix send_gift_in_stream: atomic ordering + balance check + recruiter fix
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
  v_trollmonds_to_deduct integer := 0;
  v_trollmonds_transferred integer := 0;
  v_coins_back integer := 0;
  v_recipient_share integer;
  v_txn_key text := nullif(p_metadata->>'txn_key', '');
  v_existing_id text;
  v_sender_name text;
  v_agency_id uuid;
  v_agency_status text;
  v_default_split_percent integer := 0;
  v_agency_split_percent integer := 0;
  v_creator_share integer := 0;
  v_agency_share integer := 0;
  v_leader_bonus integer := 0;
  v_recruiter_bonus integer := 0;
  v_leader_commission_percent integer := 0;
  v_recruiter_commission_percent integer := 0;
  v_leader_user_id uuid;
  v_recruiter_user_id uuid;
  v_manager_user_id uuid;
  v_owner_user_id uuid;
  v_recipient_is_banned boolean := false;
  v_recipient_is_jailed boolean := false;
  v_contract_split_percent integer := NULL;
  v_per_gift_trollmond_cost integer := 0;
  v_is_friday boolean := false;
  v_bonus_result jsonb;
  v_sender_troll_coins bigint;
  v_sender_xp bigint;
  v_receiver_xp bigint;
  v_gifts_in_last_minute integer;
BEGIN
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Step 1: Lock sender row FIRST to serialize all concurrent operations
  SELECT * INTO v_sender
  FROM public.user_profiles
  WHERE id = p_sender_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sender not found');
  END IF;

  -- Step 2: Prevent self-gifting
  IF p_sender_id = p_receiver_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot send gifts to yourself');
  END IF;

  -- Step 3: Rate limit AFTER lock — max 10 gift sends per rolling minute
  SELECT count(*)
    INTO v_gifts_in_last_minute
  FROM public.gift_rate_limits
  WHERE user_id = p_sender_id
    AND sent_at > now() - interval '1 minute';

  IF v_gifts_in_last_minute >= 10 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift rate limit exceeded. Please slow down.', 'code', 'GIFT_RATE_LIMITED');
  END IF;

  -- Step 4: Normalize quantity and enforce max per transaction
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    p_quantity := 1;
  END IF;

  IF p_quantity > 20 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Maximum 20 gifts per transaction');
  END IF;

  -- Step 5: Atomic idempotency — insert with ON CONFLICT to prevent duplicate txn_key
  IF v_txn_key IS NOT NULL THEN
    INSERT INTO public.stream_gifts (
      stream_id, sender_id, receiver_id, recipient_id,
      gift_id, gift_type, quantity, amount, coins_spent,
      coins_amount, currency_used, trollmonds_spent,
      trollmonds_transferred, coins_back, transaction_type, metadata,
      txn_key
    ) VALUES (
      p_stream_id, p_sender_id, p_receiver_id, p_receiver_id,
      p_gift_id, p_gift_id, p_quantity, 0, 0,
      0, 'coins', 0,
      0, 0,
      'idempotency_check',
      p_metadata || jsonb_build_object('txn_key', v_txn_key),
      v_txn_key
    )
    ON CONFLICT (sender_id, txn_key) DO NOTHING
    RETURNING id::text INTO v_existing_id;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'transaction_id', v_existing_id);
    END IF;

    -- If INSERT did not return a row (conflict), fetch existing
    IF v_existing_id IS NULL THEN
      SELECT id::text INTO v_existing_id
      FROM public.stream_gifts
      WHERE sender_id = p_sender_id AND txn_key = v_txn_key
      LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'duplicate', true, 'transaction_id', v_existing_id);
      END IF;
    END IF;
  END IF;

  -- Step 6: Look up gift cost
  SELECT COALESCE(coin_cost, value)::integer, name
    INTO v_gift_cost, v_gift_name
  FROM public.gift_items
  WHERE status = 'active'
    AND (
      id::text = p_gift_id
      OR gift_slug = p_gift_id
      OR name = p_gift_id
    )
  LIMIT 1;

  IF v_gift_cost IS NULL THEN
    SELECT coin_price::integer, display_name
      INTO v_gift_cost, v_gift_name
    FROM public.purchasable_items
    WHERE (id::text = p_gift_id OR item_key = p_gift_id)
      AND category = 'gift'
      AND is_active = true
    LIMIT 1;
  END IF;

  IF v_gift_cost IS NULL THEN
    SELECT cost::integer, name
      INTO v_gift_cost, v_gift_name
    FROM public.gifts
    WHERE id::text = p_gift_id OR slug = p_gift_id
    LIMIT 1;
  END IF;

  IF v_gift_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift not found');
  END IF;

  v_total_cost := v_gift_cost * p_quantity;

  -- Step 7: Check sufficient balance AFTER lock
  IF COALESCE(v_sender.troll_coins, 0) < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
  END IF;

  -- Determine trollmond deduction
  IF v_gift_cost >= 100 THEN
    v_per_gift_trollmond_cost := 100;
  ELSE
    v_per_gift_trollmond_cost := 0;
  END IF;

  v_trollmonds_to_deduct := v_per_gift_trollmond_cost * p_quantity;

  IF v_trollmonds_to_deduct > 0 AND COALESCE(v_sender.trollmonds, 0) < v_trollmonds_to_deduct THEN
    v_trollmonds_to_deduct := 0;
  END IF;

  -- Agency split lookup
  SELECT am.agency_id,
         a.status,
         COALESCE(a.default_split_percent, 0),
         COALESCE(up.is_banned, false),
         COALESCE(up.is_jailed, false)
    INTO v_agency_id,
         v_agency_status,
         v_default_split_percent,
         v_recipient_is_banned,
         v_recipient_is_jailed
  FROM public.agency_members am
  JOIN public.agencies a ON a.id = am.agency_id
  JOIN public.user_profiles up ON up.id = am.user_id
  WHERE am.user_id = p_receiver_id
    AND am.role = 'creator'
    AND am.status = 'active'
  ORDER BY am.joined_at DESC
  LIMIT 1;

  IF FOUND
     AND v_agency_status = 'approved'
     AND NOT v_recipient_is_banned
     AND NOT v_recipient_is_jailed THEN
    SELECT split_percent
      INTO v_contract_split_percent
    FROM public.agency_contracts
    WHERE agency_id = v_agency_id
      AND creator_id = p_receiver_id
      AND status = 'active'
      AND (creator_accepted_at IS NOT NULL OR agency_accepted_at IS NOT NULL)
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
    ORDER BY created_at DESC
    LIMIT 1;

    v_agency_split_percent := COALESCE(v_contract_split_percent, v_default_split_percent, 0);
    IF v_agency_split_percent < 0 THEN
      v_agency_split_percent := 0;
    ELSIF v_agency_split_percent > 50 THEN
      v_agency_split_percent := 50;
    END IF;

    SELECT owner_id
      INTO v_owner_user_id
    FROM public.agencies
    WHERE id = v_agency_id;

    SELECT user_id
      INTO v_manager_user_id
    FROM public.agency_members
    WHERE agency_id = v_agency_id
      AND role = 'manager'
      AND status = 'active'
    ORDER BY joined_at
    LIMIT 1;

    IF v_owner_user_id IS NOT NULL AND v_owner_user_id <> p_receiver_id THEN
      v_leader_user_id := v_owner_user_id;
    ELSIF v_manager_user_id IS NOT NULL THEN
      v_leader_user_id := v_manager_user_id;
    END IF;

    SELECT COALESCE(leader_commission_percent, 0), COALESCE(recruiter_commission_percent, 0)
      INTO v_leader_commission_percent, v_recruiter_commission_percent
    FROM public.agencies
    WHERE id = v_agency_id;

    IF v_leader_commission_percent < 0 THEN
      v_leader_commission_percent := 0;
    ELSIF v_leader_commission_percent > 100 THEN
      v_leader_commission_percent := 100;
    END IF;

    IF v_recruiter_commission_percent < 0 THEN
      v_recruiter_commission_percent := 0;
    ELSIF v_recruiter_commission_percent > 100 THEN
      v_recruiter_commission_percent := 100;
    END IF;

    -- FIX: actually assign recruiter_user_id
    SELECT user_id
      INTO v_recruiter_user_id
    FROM public.agency_members
    WHERE agency_id = v_agency_id
      AND role = 'recruiter'
      AND status = 'active'
    ORDER BY joined_at
    LIMIT 1;
  ELSE
    v_agency_split_percent := 0;
  END IF;

  IF v_agency_split_percent > 0 THEN
    v_agency_share := (v_total_cost * v_agency_split_percent) / 100;
    v_creator_share := v_total_cost - v_agency_share;
  ELSE
    v_agency_share := 0;
    v_creator_share := v_total_cost;
  END IF;

  v_leader_bonus := 0;
  v_recruiter_bonus := 0;

  IF v_agency_split_percent > 0 AND v_leader_user_id IS NOT NULL THEN
    v_leader_bonus := (v_creator_share * v_leader_commission_percent) / 100;
  END IF;

  IF v_recruiter_user_id IS NOT NULL AND v_agency_split_percent > 0 THEN
    v_recruiter_bonus := (v_creator_share * v_recruiter_commission_percent) / 100;
  END IF;

  IF v_leader_bonus + v_recruiter_bonus > v_creator_share THEN
    v_leader_bonus := LEAST(v_leader_bonus, v_creator_share);
    v_recruiter_bonus := GREATEST(0, v_creator_share - v_leader_bonus);
  END IF;

  v_recipient_share := v_creator_share - v_leader_bonus - v_recruiter_bonus;

  -- Step 8: Deduct coins from sender (balance already verified above)
  v_coins_back := floor(v_total_cost * 0.10);

  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) - v_total_cost + v_coins_back
  WHERE id = p_sender_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
  END IF;

  -- Step 9: Deduct trollmonds from sender and transfer to receiver
  IF v_trollmonds_to_deduct > 0 THEN
    UPDATE public.user_profiles
    SET trollmonds = COALESCE(trollmonds, 0) - v_trollmonds_to_deduct
    WHERE id = p_sender_id
      AND COALESCE(trollmonds, 0) >= v_trollmonds_to_deduct;

    IF FOUND THEN
      UPDATE public.user_profiles
      SET trollmonds = COALESCE(trollmonds, 0) + v_trollmonds_to_deduct
      WHERE id = p_receiver_id;
      v_trollmonds_transferred := v_trollmonds_to_deduct;
    ELSE
      v_trollmonds_to_deduct := 0;
      v_trollmonds_transferred := 0;
    END IF;
  END IF;

  -- Step 10: Credit receiver with FULL coins (no fees)
  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + v_recipient_share,
      total_earned_coins = COALESCE(total_earned_coins, 0) + v_recipient_share
  WHERE id = p_receiver_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Recipient profile not found');
  END IF;

  -- Step 11: Update stream totals
  IF p_stream_id IS NOT NULL THEN
    UPDATE public.streams
    SET total_gifts_coins = COALESCE(total_gifts_coins, 0) + v_total_cost
    WHERE id = p_stream_id;
  END IF;

  -- Step 12: Record stream_gifts with txn_key for idempotency
  INSERT INTO public.stream_gifts (
    stream_id, sender_id, receiver_id, recipient_id,
    gift_id, gift_type, quantity, amount, coins_spent,
    coins_amount, currency_used, trollmonds_spent,
    trollmonds_transferred, coins_back, transaction_type, metadata,
    txn_key
  ) VALUES (
    p_stream_id, p_sender_id, p_receiver_id, p_receiver_id,
    p_gift_id, p_gift_id, p_quantity, v_total_cost, v_total_cost,
    v_total_cost, 'coins', v_trollmonds_to_deduct,
    v_trollmonds_transferred, v_coins_back,
    CASE WHEN v_trollmonds_transferred > 0 THEN 'gift_with_trollmonds' ELSE 'gift' END,
    p_metadata || jsonb_build_object(
      'gift_value', v_total_cost,
      'currency_used', 'coins',
      'trollmonds_spent', v_trollmonds_to_deduct,
      'trollmonds_transferred', v_trollmonds_transferred,
      'coins_back', v_coins_back,
      'transaction_type', CASE WHEN v_trollmonds_transferred > 0 THEN 'gift_with_trollmonds' ELSE 'gift' END,
      'coins_back_source', 'gift_return_reward',
      'agency_split_percent', v_agency_split_percent,
      'agency_share_coins', v_agency_share,
      'creator_share_coins', v_recipient_share,
      'leader_bonus_coins', v_leader_bonus,
      'recruiter_bonus_coins', v_recruiter_bonus
    ),
    v_txn_key
  )
  RETURNING id::text INTO v_existing_id;

  -- Step 13: Record rate limit AFTER successful transaction
  INSERT INTO public.gift_rate_limits (user_id, sent_at)
  VALUES (p_sender_id, now());

  -- Agency earnings
  IF v_agency_id IS NOT NULL THEN
    INSERT INTO public.agency_earnings (
      agency_id, creator_id, source_type, source_id,
      gross_coins, split_percent, agency_coins, creator_coins
    ) VALUES (
      v_agency_id, p_receiver_id, 'gift', v_existing_id,
      v_total_cost, v_agency_split_percent, v_agency_share, v_recipient_share
    );

    IF v_leader_bonus > 0 AND v_leader_user_id IS NOT NULL THEN
      INSERT INTO public.agency_earnings (
        agency_id, creator_id, source_type, source_id,
        gross_coins, split_percent, agency_coins, creator_coins
      ) VALUES (
        v_agency_id, v_leader_user_id, 'gift', v_existing_id,
        v_leader_bonus, v_agency_split_percent, 0, v_leader_bonus
      );
    END IF;

    IF v_recruiter_bonus > 0 AND v_recruiter_user_id IS NOT NULL THEN
      INSERT INTO public.agency_earnings (
        agency_id, creator_id, source_type, source_id,
        gross_coins, split_percent, agency_coins, creator_coins
      ) VALUES (
        v_agency_id, v_recruiter_user_id, 'gift', v_existing_id,
        v_recruiter_bonus, v_agency_split_percent, 0, v_recruiter_bonus
      );
    END IF;
  END IF;

  -- Leader/recruiter bonus credit
  IF v_leader_bonus > 0 AND v_leader_user_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_leader_bonus,
        total_earned_coins = COALESCE(total_earned_coins, 0) + v_leader_bonus
    WHERE id = v_leader_user_id;

    INSERT INTO public.coin_transactions (
      user_id, amount, type, currency, transaction_type, stream_id, metadata
    ) VALUES (
      v_leader_user_id, v_leader_bonus, 'agency_leader_bonus', 'coins', 'agency_leader_bonus', p_stream_id,
      jsonb_build_object(
        'stream_gift_id', v_existing_id, 'gift_id', p_gift_id,
        'gift_value', v_total_cost, 'bonus_amount', v_leader_bonus,
        'agency_id', v_agency_id, 'recipient_id', p_receiver_id
      )
    );
  END IF;

  IF v_recruiter_bonus > 0 AND v_recruiter_user_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_recruiter_bonus,
        total_earned_coins = COALESCE(total_earned_coins, 0) + v_recruiter_bonus
    WHERE id = v_recruiter_user_id;

    INSERT INTO public.coin_transactions (
      user_id, amount, type, currency, transaction_type, stream_id, metadata
    ) VALUES (
      v_recruiter_user_id, v_recruiter_bonus, 'agency_recruiter_bonus', 'coins', 'agency_recruiter_bonus', p_stream_id,
      jsonb_build_object(
        'stream_gift_id', v_existing_id, 'gift_id', p_gift_id,
        'gift_value', v_total_cost, 'bonus_amount', v_recruiter_bonus,
        'agency_id', v_agency_id, 'recipient_id', p_receiver_id
      )
    );
  END IF;

  INSERT INTO public.coin_transactions (user_id, amount, type, currency, transaction_type, stream_id, from_user_id, to_user_id, metadata)
  VALUES
  (p_sender_id, -v_total_cost, 'gift_sent', 'coins', 'gift_sent', p_stream_id, p_sender_id, p_receiver_id,
    jsonb_build_object(
      'recipient_id', p_receiver_id, 'stream_id', p_stream_id,
      'gift_id', p_gift_id, 'gift_value', v_total_cost,
      'trollmonds_spent', v_trollmonds_to_deduct,
      'trollmonds_transferred', v_trollmonds_transferred,
      'coins_back', v_coins_back, 'stream_gift_id', v_existing_id
    )),
  (p_receiver_id, v_recipient_share, 'gift_received', 'coins', 'gift_received', p_stream_id, p_sender_id, p_receiver_id,
    jsonb_build_object(
      'sender_id', p_sender_id, 'stream_id', p_stream_id,
      'gift_id', p_gift_id, 'gift_value', v_total_cost,
      'stream_gift_id', v_existing_id
    ));

  IF v_coins_back > 0 THEN
    INSERT INTO public.coin_transactions (user_id, amount, type, currency, transaction_type, stream_id, from_user_id, to_user_id, metadata)
    VALUES (
      p_sender_id, v_coins_back, 'gift_return_reward', 'coins', 'gift_return_reward', p_stream_id, NULL, p_sender_id,
      jsonb_build_object(
        'stream_id', p_stream_id, 'gift_id', p_gift_id,
        'gift_value', v_total_cost, 'stream_gift_id', v_existing_id
      )
    );
  END IF;

  IF p_stream_id IS NOT NULL THEN
    INSERT INTO public.stream_messages (stream_id, user_id, content, type)
    VALUES (
      p_stream_id, p_sender_id,
      'GIFT_EVENT:' || COALESCE(v_gift_name, p_gift_id) || ':' || p_quantity || ':' || v_total_cost || ':coins:' || v_coins_back || ':' || v_trollmonds_transferred,
      'system'
    );

    IF v_coins_back > 0 THEN
      SELECT COALESCE(username, display_name, split_part(email, '@', 1), 'Troll Citizen')
        INTO v_sender_name
      FROM public.user_profiles
      WHERE id = p_sender_id;

      INSERT INTO public.stream_messages (stream_id, user_id, content, type)
      VALUES (
        p_stream_id, p_sender_id,
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

  -- Wrap the optional Friday battle bonus call in its own exception handler
  BEGIN
    IF v_battle_id IS NOT NULL THEN
      v_is_friday := EXTRACT(DOW FROM (NOW() AT TIME ZONE 'America/Denver')) = 5;
      IF v_is_friday THEN
        BEGIN
          v_bonus_result := public.award_friday_battle_gifter_bonus(p_sender_id, v_battle_id, v_total_cost::BIGINT);
        EXCEPTION WHEN OTHERS THEN
          v_bonus_result := NULL;
        END;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_bonus_result := NULL;
  END;

  -- Award XP to sender and receiver
  BEGIN
    v_sender_xp := FLOOR(v_total_cost * 1.1);
    v_receiver_xp := FLOOR(v_total_cost * 1.0);

    PERFORM public.grant_xp(
      p_sender_id,
      v_sender_xp,
      'gift_sent',
      'gift_sent_' || v_existing_id,
      jsonb_build_object('receiver_id', p_receiver_id, 'stream_id', p_stream_id, 'gift_id', p_gift_id, 'quantity', p_quantity)
    );

    PERFORM public.grant_xp(
      p_receiver_id,
      v_receiver_xp,
      'gift_received',
      'gift_received_' || v_existing_id,
      jsonb_build_object('sender_id', p_sender_id, 'stream_id', p_stream_id, 'gift_id', p_gift_id, 'quantity', p_quantity)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_existing_id,
    'currency_used', 'coins',
    'gift_value', v_total_cost,
    'trollmonds_spent', v_trollmonds_to_deduct,
    'trollmonds_transferred', v_trollmonds_transferred,
    'coins_back', v_coins_back,
    'agency_split_percent', v_agency_split_percent,
    'agency_share_coins', v_agency_share,
    'creator_share_coins', v_recipient_share,
    'leader_bonus_coins', v_leader_bonus,
    'recruiter_bonus_coins', v_recruiter_bonus,
    'friday_battle_bonus', COALESCE(v_bonus_result->>'success', 'false')::BOOLEAN,
    'message', 'Gift sent successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Gift processing error: ' || SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_gift_in_stream(uuid, uuid, uuid, text, integer, jsonb) TO authenticated, anon, service_role;
