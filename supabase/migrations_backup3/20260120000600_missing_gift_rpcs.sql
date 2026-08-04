-- Fix coin_ledger and troll_bank_spend_coins, and implement missing gift RPCs

-- 1. Add metadata column to coin_ledger if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_ledger' AND column_name = 'metadata') THEN
        ALTER TABLE public.coin_ledger ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Update troll_bank_credit_coins to accept metadata
CREATE OR REPLACE FUNCTION public.troll_bank_credit_coins(
    p_user_id uuid,
    p_coins int,
    p_bucket text,        -- 'paid' | 'gifted' | 'promo' | 'loan'
    p_source text,        -- 'coin_purchase' | 'gift' | 'admin_grant' | 'loan_disbursement' | etc.
    p_ref_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
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
BEGIN
    -- Validate p_coins > 0
    IF p_coins <= 0 THEN
        RAISE EXCEPTION 'Coins must be positive';
    END IF;

    -- Lock user profile row
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
    IF v_loan_record IS NOT NULL AND p_bucket = 'paid' THEN
        -- repay = min(loan_balance, floor(p_coins * 0.50))
        v_repay_amount := LEAST(v_loan_record.balance, FLOOR(p_coins * 0.50)::bigint);
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

    -- Update user balance
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

-- 3. Fix troll_bank_spend_coins to use correct column names
CREATE OR REPLACE FUNCTION troll_bank_spend_coins(
  p_user_id uuid,
  p_amount int,
  p_bucket text default 'paid',
  p_source text default 'purchase',
  p_ref_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_current_balance int;
  v_new_balance int;
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
  -- Uses 'delta' and 'bucket' from init migration
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

-- 4. Implement spend_coins (Legacy wrapper)
CREATE OR REPLACE FUNCTION public.spend_coins(
    p_sender_id uuid,
    p_receiver_id uuid,
    p_coin_amount int,
    p_source text,
    p_item text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_spend_result jsonb;
    v_credit_result jsonb;
    v_metadata jsonb;
BEGIN
    v_metadata := jsonb_build_object(
        'item', p_item,
        'receiver_id', p_receiver_id
    );

    v_spend_result := public.troll_bank_spend_coins(
        p_sender_id,
        p_coin_amount,
        'paid',
        p_source,
        NULL,
        v_metadata
    );

    IF (v_spend_result->>'success')::boolean = false THEN
        RETURN v_spend_result;
    END IF;

    -- Credit receiver (100% for now)
    SELECT public.troll_bank_credit_coins(
        p_receiver_id,
        p_coin_amount,
        'gifted',
        'gift_received',
        NULL, -- ref_id
        jsonb_build_object('sender_id', p_sender_id, 'item', p_item)
    ) INTO v_credit_result;

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', (v_spend_result->>'new_balance')::int,
        'sender_deducted', p_coin_amount,
        'receiver_credited', p_coin_amount,
        'repay', (v_credit_result->>'repay')::int
    );
END;
$$;

-- 5. Implement process_boosted_gift
CREATE OR REPLACE FUNCTION public.process_boosted_gift(
    p_sender uuid,
    p_receiver uuid,
    p_gift_value int,
    p_gift_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_credit_result jsonb;
BEGIN
    SELECT public.troll_bank_credit_coins(
        p_receiver,
        p_gift_value,
        'gifted',
        'boosted_gift_received',
        p_gift_id,
        jsonb_build_object('sender_id', p_sender, 'gift_id', p_gift_id)
    ) INTO v_credit_result;

    RETURN jsonb_build_object(
        'success', true,
        'receiver_credited', v_credit_result->>'user_gets',
        'repay', v_credit_result->>'repay'
    );
END;
$$;

-- 6. Implement process_gift_with_lucky
CREATE OR REPLACE FUNCTION public.process_gift_with_lucky(
    p_sender_id uuid,
    p_receiver_id uuid,
    p_troll_coins int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_spend_result jsonb;
    v_credit_result jsonb;
    v_is_lucky boolean := false;
    v_lucky_multiplier int := 1;
    v_trollmonds_awarded int := 0;
BEGIN
    v_spend_result := public.troll_bank_spend_coins(
        p_sender_id,
        p_troll_coins,
        'paid',
        'gift_with_lucky'
    );

    IF (v_spend_result->>'success')::boolean = false THEN
        RETURN v_spend_result;
    END IF;

    IF random() < 0.1 THEN
        v_is_lucky := true;
        v_lucky_multiplier := 2;
    END IF;

    SELECT public.troll_bank_credit_coins(
        p_receiver_id,
        p_troll_coins,
        'gifted',
        'gift_received_lucky',
        NULL,
        jsonb_build_object('sender_id', p_sender_id, 'lucky', v_is_lucky)
    ) INTO v_credit_result;

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', (v_spend_result->>'new_balance')::int,
        'lucky_multiplier', CASE WHEN v_is_lucky THEN v_lucky_multiplier ELSE NULL END,
        'trollmonds_awarded', v_trollmonds_awarded
    );
END;
$$;
