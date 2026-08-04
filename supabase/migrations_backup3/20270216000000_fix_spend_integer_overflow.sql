-- Migration: Fix integer overflow in spending functions
-- Description: Updates core spending functions to use NUMERIC types instead of INT to support balances > 2.1B

-- 0. DROP OLD INTEGER FUNCTIONS TO PREVENT AMBIGUITY
-- We must drop the specific signatures that used 'int' or 'integer' for amount
DROP FUNCTION IF EXISTS public.troll_bank_spend_coins(uuid, int, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.troll_bank_spend_coins_secure(uuid, int, text, text, text, jsonb);
-- Drop all variations of purchase_broadcast_theme to fix ambiguity
DROP FUNCTION IF EXISTS public.purchase_broadcast_theme(uuid, text, boolean);
DROP FUNCTION IF EXISTS public.purchase_broadcast_theme(boolean, uuid, uuid);
DROP FUNCTION IF EXISTS public.purchase_broadcast_theme(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.troll_bank_credit_coins(uuid, int, text, text, text, jsonb);

-- Ensure table has cost column (fixes "column cost does not exist" error)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_broadcast_theme_purchases') THEN
        ALTER TABLE public.user_broadcast_theme_purchases ADD COLUMN IF NOT EXISTS cost NUMERIC(20, 2);
    END IF;
END $$;


-- 1. troll_bank_spend_coins
CREATE OR REPLACE FUNCTION public.troll_bank_spend_coins(
  p_user_id uuid,
  p_amount numeric, -- Changed from int
  p_bucket text default 'paid',
  p_source text default 'purchase',
  p_ref_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_balance numeric(20, 2); -- Changed from int
  v_new_balance numeric(20, 2);     -- Changed from int
  v_ledger_id uuid;
begin
  -- Validate amount
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be positive');
  end if;

  -- Lock user profile and check balance
  select troll_coins into v_current_balance
  from user_profiles
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'User not found');
  end if;

  if v_current_balance < p_amount then
    return jsonb_build_object('success', false, 'error', 'Insufficient funds', 'current_balance', v_current_balance);
  end if;

  -- Deduct coins
  v_new_balance := v_current_balance - p_amount;
  
  update user_profiles
  set troll_coins = v_new_balance
  where id = p_user_id;

  -- Insert into ledger (negative delta)
  insert into coin_ledger (
    user_id,
    delta,
    bucket,
    source,
    ref_id,
    metadata,
    direction
  ) values (
    p_user_id,
    -p_amount,
    p_bucket,
    p_source,
    p_ref_id,
    p_metadata,
    'out'
  ) returning id into v_ledger_id;

  return jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'ledger_id', v_ledger_id
  );
end;
$$;

-- 2. troll_bank_spend_coins_secure
CREATE OR REPLACE FUNCTION public.troll_bank_spend_coins_secure(
  p_user_id uuid,
  p_amount numeric, -- Changed from int
  p_bucket text default 'paid',
  p_source text default 'purchase',
  p_ref_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
as $$
begin
  -- Check if caller is the user or service role
  if auth.uid() != p_user_id and auth.role() != 'service_role' then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  return troll_bank_spend_coins(p_user_id, p_amount, p_bucket, p_source, p_ref_id, p_metadata);
end;
$$;

-- 3. purchase_broadcast_theme
CREATE OR REPLACE FUNCTION public.purchase_broadcast_theme(
  p_user_id uuid,
  p_theme_id uuid,
  p_set_active boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_theme record;
  v_spend_result jsonb;
  v_cost numeric; -- Changed from int
BEGIN
  -- 1. Get theme details
  SELECT * INTO v_theme
  FROM public.broadcast_background_themes
  WHERE id = p_theme_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Theme not found');
  END IF;

  v_cost := COALESCE(v_theme.price_coins, 0);

  -- 2. Check if already owned
  IF EXISTS (
    SELECT 1 FROM public.user_broadcast_theme_purchases
    WHERE user_id = p_user_id AND theme_id = p_theme_id
  ) THEN
    -- Already owned, just activate if requested
    IF p_set_active THEN
      INSERT INTO public.user_broadcast_theme_state (user_id, active_theme_id, updated_at)
      VALUES (p_user_id, p_theme_id, now())
      ON CONFLICT (user_id) DO UPDATE
      SET active_theme_id = EXCLUDED.active_theme_id,
          updated_at = now();
    END IF;
    RETURN jsonb_build_object('success', true, 'message', 'Already owned');
  END IF;

  -- 3. Deduct coins if cost > 0
  IF v_cost > 0 THEN
    v_spend_result := public.troll_bank_spend_coins_secure(
      p_user_id,
      v_cost,
      'paid',
      'broadcast_theme_purchase',
      NULL,
      jsonb_build_object('theme_id', p_theme_id, 'theme_name', v_theme.name)
    );

    IF (v_spend_result->>'success')::boolean = false THEN
      RETURN v_spend_result;
    END IF;
  END IF;

  -- 4. Record purchase
  INSERT INTO public.user_broadcast_theme_purchases (user_id, theme_id, purchased_at, cost)
  VALUES (p_user_id, p_theme_id, now(), v_cost);

  -- 5. Activate if requested
  IF p_set_active THEN
    INSERT INTO public.user_broadcast_theme_state (user_id, active_theme_id, updated_at)
    VALUES (p_user_id, p_theme_id, now())
    ON CONFLICT (user_id) DO UPDATE
    SET active_theme_id = EXCLUDED.active_theme_id,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. troll_bank_credit_coins
CREATE OR REPLACE FUNCTION public.troll_bank_credit_coins(
    p_user_id uuid,
    p_coins numeric, -- Changed from int
    p_bucket text,        -- 'paid' | 'gifted' | 'promo' | 'loan'
    p_source text,        -- 'coin_purchase' | 'gift' | 'admin_grant' | 'loan_disbursement' | etc.
    p_ref_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as owner (postgres/admin) to bypass RLS for updates
AS $$
DECLARE
    v_user_balance numeric(20, 2); -- Changed from bigint
    v_loan_record record;
    v_repay_amount numeric(20, 2) := 0; -- Changed from bigint
    v_user_gets numeric(20, 2); -- Changed from bigint
    v_new_loan_balance numeric(20, 2); -- Changed from bigint
    v_loan_status text;
    v_gift_repay_enabled boolean := false;
BEGIN
    -- Validate p_coins > 0
    IF p_coins <= 0 THEN
        RAISE EXCEPTION 'Coins must be positive';
    END IF;

    -- Check feature flags for gift repayment
    -- We assume bank_feature_flags table exists (created in 20260120000001)
    BEGIN
        SELECT is_enabled INTO v_gift_repay_enabled
        FROM public.bank_feature_flags
        WHERE key = 'gift_repayment_enabled';
    EXCEPTION WHEN OTHERS THEN
        -- If table doesn't exist or other error, default to false
        v_gift_repay_enabled := false;
    END;
    
    v_gift_repay_enabled := COALESCE(v_gift_repay_enabled, false);

    -- Lock user profile row to prevent race conditions on balance
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

    -- Determine repayment eligibility
    -- Eligible if:
    -- 1. Active loan exists
    -- 2. Bucket is 'paid' OR (bucket is 'gifted' AND feature flag is on)
    IF v_loan_record IS NOT NULL THEN
        IF p_bucket = 'paid' OR (p_bucket = 'gifted' AND v_gift_repay_enabled) THEN
             -- repay = min(loan_balance, floor(p_coins * 0.50))
             v_repay_amount := LEAST(v_loan_record.balance, FLOOR(p_coins * 0.50));
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
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata)
        VALUES (p_user_id, v_user_gets, p_bucket, p_source, p_ref_id, p_metadata);
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

-- 5. spend_coins (Gift logic)
-- Update to remove ::int cast and use correct types
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
  v_sender_balance NUMERIC(20, 2); -- Changed from BIGINT to match table
  v_sender_created_at TIMESTAMPTZ;
  v_gift_id UUID := gen_random_uuid();
  v_bank_result json;
  v_credit_increase INTEGER;
  v_current_score INTEGER;
  v_new_score INTEGER;
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
  -- Removed ::int cast on p_coin_amount
  SELECT public.troll_bank_credit_coins(
    p_receiver_id,
    p_coin_amount, -- Was p_coin_amount::int
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

      -- If no credit record exists, one should be created (triggers usually handle this, but to be safe)
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
