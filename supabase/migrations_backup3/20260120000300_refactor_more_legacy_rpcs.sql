-- Refactor Legacy RPCs and Enhance Bank System

-- 1. Enhance coin_ledger with metadata for backward compatibility
ALTER TABLE public.coin_ledger ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Create Feature Flags table for Bank Settings
-- (Table created in 20260120000001_bank_feature_flags.sql)

-- Seed default flags
INSERT INTO public.bank_feature_flags (key, value, is_enabled, description)
VALUES ('gift_repayment_enabled', '{"percentage": 50}'::jsonb, false, 'If true, gifted coins trigger loan repayment')
ON CONFLICT (key) DO NOTHING;

-- 3. Update troll_bank_credit_coins to support metadata and feature flags
DROP FUNCTION IF EXISTS public.troll_bank_credit_coins(uuid, int, text, text, text);

CREATE OR REPLACE FUNCTION public.troll_bank_credit_coins(
    p_user_id uuid,
    p_coins int,
    p_bucket text,        -- 'paid' | 'gifted' | 'promo' | 'loan'
    p_source text,        -- 'coin_purchase' | 'gift' | 'admin_grant' | 'loan_disbursement' | etc.
    p_ref_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_balance bigint;
    v_loan_record record;
    v_repay_amount bigint := 0;
    v_user_gets bigint;
    v_new_loan_balance bigint;
    v_loan_status text;
    v_gift_repayment_enabled boolean;
BEGIN
    -- Validate p_coins > 0
    IF p_coins <= 0 THEN
        RAISE EXCEPTION 'Coins must be positive';
    END IF;

    -- Lock user profile
    SELECT troll_coins INTO v_user_balance
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Lock active loan row if exists
    SELECT * INTO v_loan_record
    FROM public.loans
    WHERE user_id = p_user_id AND status = 'active'
    LIMIT 1
    FOR UPDATE;

    -- Check Feature Flags
    SELECT is_enabled INTO v_gift_repayment_enabled
    FROM public.bank_feature_flags
    WHERE key = 'gift_repayment_enabled';

    -- Determine repayment eligibility
    -- Eligible buckets: 'paid' (always), 'gifted' (if flag enabled)
    IF v_loan_record IS NOT NULL THEN
        IF p_bucket = 'paid' OR (p_bucket = 'gifted' AND v_gift_repayment_enabled = true) THEN
            -- repay = min(loan_balance, floor(p_coins * 0.50))
            v_repay_amount := LEAST(v_loan_record.balance, FLOOR(p_coins * 0.50)::bigint);
        END IF;
    END IF;

    v_user_gets := p_coins - v_repay_amount;

    -- Insert ledger rows
    -- a) Repayment
    IF v_repay_amount > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata)
        VALUES (p_user_id, -v_repay_amount, 'repayment', 'auto_repay', p_ref_id, p_metadata);

        -- Update loan
        UPDATE public.loans
        SET balance = balance - v_repay_amount,
            status = CASE WHEN balance - v_repay_amount <= 0 THEN 'paid' ELSE status END,
            closed_at = CASE WHEN balance - v_repay_amount <= 0 THEN now() ELSE closed_at END
        WHERE id = v_loan_record.id
        RETURNING balance, status INTO v_new_loan_balance, v_loan_status;
    ELSE
        v_new_loan_balance := CASE WHEN v_loan_record IS NOT NULL THEN v_loan_record.balance ELSE 0 END;
        v_loan_status := CASE WHEN v_loan_record IS NOT NULL THEN v_loan_record.status ELSE 'none' END;
    END IF;

    -- b) Credit
    IF v_user_gets > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
        VALUES (p_user_id, v_user_gets, p_bucket, p_source, p_ref_id, p_metadata, 'in');
    END IF;

    -- Update user balance (troll_coins)
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_user_gets
    WHERE id = p_user_id;

    RETURN json_build_object(
        'repay', v_repay_amount,
        'user_gets', v_user_gets,
        'new_loan_balance', v_new_loan_balance,
        'loan_status', v_loan_status
    );
END;
$$;

-- 4. Sync Trigger: coin_ledger -> coin_transactions (Backward Compatibility)
CREATE OR REPLACE FUNCTION public.sync_ledger_to_transactions()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.coin_transactions (
        user_id,
        amount,
        type,
        description,
        metadata,
        created_at
    )
    VALUES (
        NEW.user_id,
        NEW.delta,
        CASE 
            WHEN NEW.bucket = 'repayment' THEN 'loan_repayment'
            WHEN NEW.source = 'gift' THEN 'gift_received'
            ELSE NEW.source 
        END,
        'Synced from Troll Bank Ledger: ' || NEW.bucket,
        COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('ledger_id', NEW.id, 'bucket', NEW.bucket),
        NEW.created_at
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_ledger_to_transactions ON public.coin_ledger;
CREATE TRIGGER trg_sync_ledger_to_transactions
AFTER INSERT ON public.coin_ledger
FOR EACH ROW
EXECUTE FUNCTION public.sync_ledger_to_transactions();


-- 5. Refactor spend_coins (Sender/Receiver Version)
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

  -- Deduct coins from sender (Direct update or could be bank debit if we had it)
  UPDATE user_profiles
  SET 
    Troll_coins = Troll_coins - p_coin_amount,
    total_spent_coins = COALESCE(total_spent_coins, 0) + p_coin_amount,
    updated_at = now()
  WHERE id = p_sender_id;

  -- Log Sender Transaction (Spending) - Manual insertion because bank credit handles receiver only
  INSERT INTO coin_transactions (
    user_id, type, amount, coin_type, description, metadata, created_at
  ) VALUES (
    p_sender_id, 'gift_sent', -p_coin_amount, 'troll_coins', 
    format('Sent gift: %s', COALESCE(p_item, 'Gift')),
    jsonb_build_object('receiver_id', p_receiver_id, 'source', p_source, 'item', p_item, 'gift_id', v_gift_id),
    now()
  );

  -- Credit Receiver via Troll Bank
  -- bucket='gifted', source='gift'
  SELECT public.troll_bank_credit_coins(
    p_receiver_id,
    p_coin_amount::int,
    'gifted',
    'gift',
    v_gift_id::text,
    jsonb_build_object('sender_id', p_sender_id, 'item', p_item, 'source', p_source)
  ) INTO v_bank_result;

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
      '🎁 Gift Received!',
      format('You received %s coins from a gift!', p_coin_amount),
      jsonb_build_object('sender_id', p_sender_id, 'amount', p_coin_amount, 'item', p_item)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true, 'gift_id', v_gift_id);
END;
$$;


-- 6. Refactor spend_coins (Bonus Version)
CREATE OR REPLACE FUNCTION public.spend_coins(
    p_user_id uuid,
    p_amount bigint,
    p_reason text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance BIGINT;
  v_lucky_bonus BIGINT := 0;
  v_is_lucky BOOLEAN := false;
  v_multiplier NUMERIC;
  v_bonus_message TEXT := NULL;
  v_bank_result json;
BEGIN
  -- Check current balance
  SELECT troll_coins INTO v_current_balance
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_current_balance IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  IF v_current_balance < p_amount THEN RAISE EXCEPTION 'Insufficient funds'; END IF;

  -- Deduct coins
  UPDATE user_profiles
  SET troll_coins = troll_coins - p_amount
  WHERE id = p_user_id;

  -- Log Spending
  INSERT INTO coin_transactions (
    user_id, amount, type, description, metadata
  ) VALUES (
    p_user_id, -p_amount, 
    CASE WHEN p_reason = 'gift_sent' THEN 'gift' ELSE 'spend' END,
    p_reason, p_metadata
  );

  -- Lucky Gift Logic
  IF p_reason = 'gift_sent' AND p_amount > 0 THEN
    IF random() < 0.05 THEN
      v_is_lucky := true;
      DECLARE
        v_tier_roll FLOAT;
      BEGIN
        v_tier_roll := random();
        IF v_tier_roll < 0.90 THEN v_multiplier := 0.1 + (random() * 0.9);
        ELSIF v_tier_roll < 0.99 THEN v_multiplier := 2.0 + (random() * 8.0);
        ELSE v_multiplier := 10.0 + (random() * 990.0);
        END IF;
      END;
      v_lucky_bonus := floor(p_amount * v_multiplier);
      
      -- Credit Bonus via Troll Bank
      IF v_lucky_bonus > 0 THEN
          SELECT public.troll_bank_credit_coins(
            p_user_id,
            v_lucky_bonus::int,
            'promo',
            'lucky_bonus',
            NULL,
            jsonb_build_object('original_gift', p_amount, 'multiplier', v_multiplier)
          ) INTO v_bank_result;
      END IF;

      v_bonus_message := format('LUCKY GIFT! You won %s coins back! (%.1fx multiplier)', v_lucky_bonus, v_multiplier);
    END IF;
  END IF;

  -- Get final balance
  SELECT troll_coins INTO v_current_balance FROM user_profiles WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_current_balance,
    'lucky_bonus', v_lucky_bonus,
    'message', v_bonus_message
  );
END;
$$;


-- 7. Refactor send_gift_v2
CREATE OR REPLACE FUNCTION public.send_gift_v2(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_amount INT,
  p_gift_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT 'Gift'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_bank_result json;
BEGIN
  -- 1. Check Sender Balance
  SELECT troll_coins INTO v_sender_balance FROM public.user_profiles WHERE id = p_sender_id;
  
  IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient funds');
  END IF;

  -- 2. Deduct from Sender
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - p_amount,
      total_spent_coins = COALESCE(total_spent_coins, 0) + p_amount
  WHERE id = p_sender_id;

  -- Log Sender
  INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
  VALUES (p_sender_id, -p_amount, 'gift_sent', p_description, json_build_object('receiver_id', p_receiver_id));

  -- 3. Credit Receiver via Troll Bank
  SELECT public.troll_bank_credit_coins(
    p_receiver_id,
    p_amount,
    'gifted',
    'gift',
    p_gift_id::text,
    json_build_object('sender_id', p_sender_id)
  ) INTO v_bank_result;

  -- Receiver transaction logged via sync trigger

  RETURN json_build_object('success', true);
END;
$$;


-- 8. Refactor send_wall_post_gift
-- (Moved to 20260120000250_fix_troll_wall_gifts.sql or handled separately to avoid errors)
-- If we need to update it to use troll_bank_credit_coins, we should do it in a new migration
-- after we ensure table stability.

