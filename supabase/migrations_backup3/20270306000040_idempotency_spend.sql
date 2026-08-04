-- Migration: Add idempotency to coin spending
-- Description: Adds idempotency_key to coin_transactions and updates spend_coins RPC to handle retries.

-- 1. Add idempotency_key column
ALTER TABLE public.coin_transactions 
ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 2. Add unique index for idempotency
-- We scope this to user_id to allow different users to potentially (rarely) collide on keys if generated poorly,
-- but mainly to speed up lookup by user_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_transactions_idempotency 
ON public.coin_transactions (user_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 3. Update spend_coins RPC
CREATE OR REPLACE FUNCTION public.spend_coins(
    p_sender_id uuid,
    p_receiver_id uuid,
    p_coin_amount bigint,
    p_source text DEFAULT 'gift'::text,
    p_item text DEFAULT NULL::text,
    p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance NUMERIC(20, 2);
  v_sender_created_at TIMESTAMPTZ;
  v_gift_id UUID;
  v_bank_result json;
  v_credit_increase INTEGER;
  v_current_score INTEGER;
  v_new_score INTEGER;
  v_existing_tx RECORD;
BEGIN
  -- 0. Idempotency Check (Optimistic)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, metadata INTO v_existing_tx
    FROM public.coin_transactions
    WHERE user_id = p_sender_id 
    AND idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      -- Transaction already processed successfully.
      v_gift_id := (v_existing_tx.metadata->>'gift_id')::uuid;
      
      RETURN jsonb_build_object(
        'success', true, 
        'gift_id', v_gift_id, 
        'message', 'Transaction already processed (idempotent)'
      );
    END IF;
  END IF;

  -- Generate new gift_id for this new transaction
  v_gift_id := gen_random_uuid();

  -- Start transaction block for safe rollback on unique violation
  BEGIN
    -- Check sender's paid coin balance and get created_at
    SELECT Troll_coins, created_at INTO v_sender_balance, v_sender_created_at
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
    PERFORM public.grant_xp(
      p_sender_id,
      p_coin_amount,
      'spend_coins',
      v_gift_id::text
    );

    -- Log Sender Transaction (WITH idempotency_key)
    -- This is the critical step that will fail if duplicate
    INSERT INTO coin_transactions (
      user_id, type, amount, coin_type, description, metadata, created_at, idempotency_key
    ) VALUES (
      p_sender_id, 'gift_sent', -p_coin_amount, 'troll_coins', 
      format('Sent gift: %s', COALESCE(p_item, 'Gift')),
      jsonb_build_object('receiver_id', p_receiver_id, 'source', p_source, 'item', p_item, 'gift_id', v_gift_id),
      now(),
      p_idempotency_key
    );

  EXCEPTION WHEN unique_violation THEN
    -- Race condition caught: another transaction inserted the key while we were processing.
    -- We must return the result of that transaction to be idempotent.
    -- The changes in this block (UPDATE user_profiles) are automatically rolled back.
    
    IF p_idempotency_key IS NOT NULL THEN
      SELECT id, metadata INTO v_existing_tx
      FROM public.coin_transactions
      WHERE user_id = p_sender_id 
      AND idempotency_key = p_idempotency_key
      LIMIT 1;
      
      IF FOUND THEN
        v_gift_id := (v_existing_tx.metadata->>'gift_id')::uuid;
        RETURN jsonb_build_object(
          'success', true, 
          'gift_id', v_gift_id, 
          'message', 'Transaction already processed (idempotent race)'
        );
      END IF;
    END IF;
    
    -- If we got here, something weird happened (unique violation but row not found?), re-raise
    RAISE;
  END;

  -- Credit Receiver via Troll Bank


  -- Credit Receiver via Troll Bank
  SELECT public.troll_bank_credit_coins(
    p_receiver_id,
    p_coin_amount,
    'gifted',
    'gift',
    v_gift_id::text,
    jsonb_build_object('sender_id', p_sender_id, 'item', p_item, 'source', p_source)
  ) INTO v_bank_result;

  -- Grant XP to Receiver (Receiving Gift XP) - 1 XP per coin value
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

  -- =================================================================
  -- CREDIT SCORE LOGIC UPDATE
  -- Rule: Increase credit score if account > 2 months old.
  -- Rate: 1 point for every 1000 coins.
  -- =================================================================
  
  -- Calculate potential increase
  v_credit_increase := FLOOR(p_coin_amount / 1000);

  -- Check eligibility: Account age > 2 months AND increase > 0
  IF v_credit_increase > 0 AND v_sender_created_at < (now() - INTERVAL '2 months') THEN
      
      -- Lock and get current score
      SELECT score INTO v_current_score
      FROM public.user_credit
      WHERE user_id = p_sender_id
      FOR UPDATE;

      -- If no credit record exists, one should be created
      IF v_current_score IS NULL THEN
          INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
          VALUES (p_sender_id, 400, 'Building', 0, now())
          RETURNING score INTO v_current_score;
      END IF;

      -- Calculate new score (Max 800)
      v_new_score := LEAST(800, v_current_score + v_credit_increase);

      IF v_new_score > v_current_score THEN
          -- Update User Credit
          UPDATE public.user_credit
          SET 
              score = v_new_score,
              tier = public.get_credit_tier(v_new_score),
              updated_at = now(),
              last_event_at = now()
          WHERE user_id = p_sender_id;

          -- Log Credit Event
          INSERT INTO public.credit_events (
              user_id,
              event_type,
              delta,
              source_table,
              source_id,
              metadata
          ) VALUES (
              p_sender_id,
              'gift_sent_bonus',
              v_new_score - v_current_score, -- Actual delta applied
              'gifts',
              v_gift_id,
              jsonb_build_object('coins_spent', p_coin_amount, 'calculation', '1 pt per 1000 coins')
          );
      END IF;
  END IF;

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
