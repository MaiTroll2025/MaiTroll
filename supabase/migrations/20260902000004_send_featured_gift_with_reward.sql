-- ============================================================
-- MaiTroll Featured Gift Reward RPC
-- Server-authoritative featured gift send + 5% reward
-- ============================================================

CREATE OR REPLACE FUNCTION public.send_featured_gift_with_reward(
  p_sender_id uuid,
  p_receiver_id uuid,
  p_stream_id uuid,
  p_gift_id text,
  p_quantity integer DEFAULT 1,
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
  v_reward_amount integer;
  v_txn_key text := nullif(p_metadata->>'txn_key', '');
  v_stream_gift_id text;
  v_reward_txn_id text;
  v_active_cycle RECORD;
  v_current_gift_id uuid;
BEGIN
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Step 1: Lock sender row FIRST
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

  -- Step 3: Validate featured gift promotion is active
  SELECT * INTO v_active_cycle
  FROM public.active_featured_gift_cycle
  LIMIT 1;

  IF v_active_cycle.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active featured gift promotion');
  END IF;

  SELECT current_gift_id INTO v_current_gift_id
  FROM public.featured_gift_cycles
  WHERE id = v_active_cycle.id;

  IF v_current_gift_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No featured gift selected');
  END IF;

  -- Normalize gift ID for comparison
  IF p_gift_id::uuid != v_current_gift_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift is not the current featured gift');
  END IF;

  -- Step 4: Normalize quantity
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    p_quantity := 1;
  END IF;

  IF p_quantity > 20 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Maximum 20 gifts per transaction');
  END IF;

  -- Step 5: Look up gift cost
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
    SELECT price::integer, name
      INTO v_gift_cost, v_gift_name
    FROM public.gifts_catalog
    WHERE id::text = p_gift_id
      AND is_active = true
    LIMIT 1;
  END IF;

  IF v_gift_cost IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Gift not found');
  END IF;

  v_total_cost := v_gift_cost * p_quantity;

  -- Step 6: Check sufficient balance AFTER lock
  IF COALESCE(v_sender.troll_coins, 0) < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
  END IF;

  -- Step 7: Deduct coins from sender
  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) - v_total_cost
  WHERE id = p_sender_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient coins');
  END IF;

  -- Step 8: Credit receiver
  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + v_total_cost,
      total_earned_coins = COALESCE(total_earned_coins, 0) + v_total_cost
  WHERE id = p_receiver_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Recipient profile not found');
  END IF;

  -- Step 9: Record stream_gift with featured-gift metadata
  INSERT INTO public.stream_gifts (
    stream_id, sender_id, receiver_id, recipient_id,
    gift_id, gift_type, quantity, amount, coins_spent,
    coins_amount, currency_used, trollmonds_spent,
    trollmonds_transferred, coins_back, transaction_type, metadata,
    txn_key
  ) VALUES (
    p_stream_id, p_sender_id, p_receiver_id, p_receiver_id,
    p_gift_id, p_gift_id, p_quantity, v_total_cost, v_total_cost,
    v_total_cost, 'coins', 0,
    0, 0,
    'featured_gift',
    p_metadata || jsonb_build_object(
      'gift_value', v_total_cost,
      'currency_used', 'coins',
      'featured_gift_cycle_id', v_active_cycle.id,
      'featured_gift_reward_pending', true
    ),
    v_txn_key
  )
  RETURNING id::text INTO v_stream_gift_id;

  -- Step 10: Calculate and award 5% reward
  v_reward_amount := GREATEST(0, floor(v_total_cost * 0.05));

  IF v_reward_amount > 0 THEN
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_reward_amount,
        total_earned_coins = COALESCE(total_earned_coins, 0) + v_reward_amount
    WHERE id = p_sender_id;

    INSERT INTO public.coin_transactions (
      user_id, amount, type, currency, transaction_type, stream_id, from_user_id, to_user_id, metadata
    ) VALUES (
      p_sender_id, v_reward_amount, 'featured_gift_reward', 'coins', 'featured_gift_reward', p_stream_id, NULL, p_sender_id,
      jsonb_build_object(
        'stream_id', p_stream_id,
        'gift_id', p_gift_id,
        'gift_value', v_total_cost,
        'reward_percent', 5,
        'reward_amount', v_reward_amount,
        'stream_gift_id', v_stream_gift_id,
        'featured_gift_cycle_id', v_active_cycle.id
      )
    )
    RETURNING id::text INTO v_reward_txn_id;
  END IF;

  -- Step 11: Record sender debit
  INSERT INTO public.coin_transactions (user_id, amount, type, currency, transaction_type, stream_id, from_user_id, to_user_id, metadata)
  VALUES (
    p_sender_id, -v_total_cost, 'gift_sent', 'coins', 'gift_sent', p_stream_id, p_sender_id, p_receiver_id,
    jsonb_build_object(
      'recipient_id', p_receiver_id, 'stream_id', p_stream_id,
      'gift_id', p_gift_id, 'gift_value', v_total_cost,
      'stream_gift_id', v_stream_gift_id,
      'featured_gift', true
    )
  );

  -- Step 12: Record receiver credit
  INSERT INTO public.coin_transactions (user_id, amount, type, currency, transaction_type, stream_id, from_user_id, to_user_id, metadata)
  VALUES (
    p_receiver_id, v_total_cost, 'gift_received', 'coins', 'gift_received', p_stream_id, p_sender_id, p_receiver_id,
    jsonb_build_object(
      'sender_id', p_sender_id, 'stream_id', p_stream_id,
      'gift_id', p_gift_id, 'gift_value', v_total_cost,
      'stream_gift_id', v_stream_gift_id,
      'featured_gift', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_stream_gift_id,
    'reward_transaction_id', v_reward_txn_id,
    'reward_amount', v_reward_amount,
    'gift_value', v_total_cost,
    'message', 'Featured gift sent successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Featured gift processing error: ' || SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_featured_gift_with_reward(uuid, uuid, uuid, text, integer, jsonb) TO authenticated, anon, service_role;
