CREATE OR REPLACE FUNCTION public.spend_coins(
    p_sender_id uuid,
    p_receiver_id uuid,
    p_coin_amount bigint,
    p_source text DEFAULT 'gift'::text,
    p_item text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_gift_id UUID := gen_random_uuid();
  v_bank_result json;
BEGIN
  -- Check sender's paid coin balance
  SELECT Troll_coins INTO v_sender_balance
  FROM user_profiles
  WHERE id = p_sender_id;

  IF v_sender_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender not found');
  END IF;

  IF v_sender_balance < p_coin_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Not enough coins',
      'current_balance', v_sender_balance,
      'required', p_coin_amount
    );
  END IF;

  -- Deduct coins from sender
  UPDATE user_profiles
  SET 
    Troll_coins = Troll_coins - p_coin_amount,
    total_spent_coins = COALESCE(total_spent_coins, 0) + p_coin_amount,
    updated_at = now()
  WHERE id = p_sender_id;

  -- Grant XP to Sender (Spending XP) - 1 XP per coin spent
  -- This ensures sender levels up by spending coins
  PERFORM public.grant_xp(
    p_sender_id,
    p_coin_amount,
    'spend_coins',
    v_gift_id::text
  );

  -- Log Sender Transaction
  INSERT INTO coin_transactions (
    user_id, type, amount, coin_type, description, metadata, created_at
  ) VALUES (
    p_sender_id, 'gift_sent', -p_coin_amount, 'troll_coins', 
    format('Sent gift: %s', COALESCE(p_item, 'Gift')),
    jsonb_build_object('receiver_id', p_receiver_id, 'source', p_source, 'item', p_item, 'gift_id', v_gift_id),
    now()
  );

  -- Credit Receiver via Troll Bank
  SELECT public.troll_bank_credit_coins(
    p_receiver_id,
    p_coin_amount::int,
    'gifted',
    'gift',
    v_gift_id::text,
    jsonb_build_object('sender_id', p_sender_id, 'item', p_item, 'source', p_source)
  ) INTO v_bank_result;

  -- Grant XP to Receiver (Receiving Gift XP) - 1 XP per coin value
  -- This ensures receiver levels up by receiving gifts
  PERFORM public.grant_xp(
    p_receiver_id,
    p_coin_amount,
    'gift_received',
    v_gift_id::text
  );

  -- Insert gift record
  INSERT INTO gifts (
    id, sender_id, receiver_id, coins_spent, gift_type, message, created_at
  ) VALUES (
    v_gift_id, p_sender_id, p_receiver_id, p_coin_amount, 'paid', COALESCE(p_item, 'Gift'), now()
  );

  -- Notification
  BEGIN
    PERFORM create_notification(
       p_receiver_id,
       'gift_received',
       'You received a gift!',
       jsonb_build_object(
         'sender_id', p_sender_id,
         'amount', p_coin_amount,
         'item', p_item,
         'gift_id', v_gift_id
       )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Ignore notification errors
  END;

  RETURN jsonb_build_object('success', true, 'gift_id', v_gift_id);
END;
$$;
