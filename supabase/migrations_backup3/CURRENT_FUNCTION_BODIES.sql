-- ============================================================
-- CURRENT FUNCTION BODIES
-- Extracted from supabase/migrations/
-- Generated: 2026-06-16
-- ============================================================
-- NOTE: For each function, the LATEST migration file (by date prefix)
-- containing a CREATE OR REPLACE FUNCTION was used.
-- ============================================================


-- ============================================================
-- Function: spend_coins (overload 1 of 2)
-- Source: 20290616000001_fix_critical_rpc_auth.sql
-- Signature: (p_sender_id UUID, p_receiver_id UUID, p_coin_amount INTEGER, p_source VARCHAR(100), p_item VARCHAR(255))
-- Returns: JSONB
-- ============================================================

CREATE OR REPLACE FUNCTION public.spend_coins(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_coin_amount INTEGER,
  p_source VARCHAR(100),
  p_item VARCHAR(255)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_balance INTEGER;
  v_host_cut INTEGER;
  v_admin_cut INTEGER;
  v_gift_id UUID;
BEGIN
  -- Authorization: sender must be the caller, or caller must be admin
  IF p_sender_id <> auth.uid() AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'Unauthorized: can only spend your own coins'
    USING ERRCODE = '42501';
  END IF;

  -- Get sender balance (locking row)
  SELECT troll_coins INTO v_sender_balance
  FROM public.user_profiles
  WHERE id = p_sender_id
  FOR UPDATE;

  -- Check balance
  IF COALESCE(v_sender_balance, 0) < p_coin_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Calculate cuts
  v_host_cut := FLOOR(p_coin_amount * 0.10);
  v_admin_cut := FLOOR(p_coin_amount * 0.10);

  -- Deduct from sender
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - p_coin_amount
  WHERE id = p_sender_id;

  -- Credit receiver (minus cuts)
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + (p_coin_amount - v_host_cut - v_admin_cut)
  WHERE id = p_receiver_id;

  -- Record the gift
  v_gift_id := gen_random_uuid();
  INSERT INTO public.gifts (id, sender_id, receiver_id, amount, source, item, created_at)
  VALUES (v_gift_id, p_sender_id, p_receiver_id, p_coin_amount, p_source, p_item, now());

  RETURN jsonb_build_object('success', true, 'gift_id', v_gift_id);
END;
$$;


-- ============================================================
-- Function: spend_coins (overload 2 of 2)
-- Source: 20270327000001_secure_court_fines.sql
-- Signature: (p_user_id uuid, p_amount integer, p_reason text, p_metadata jsonb DEFAULT '{}'::jsonb)
-- Returns: JSONB
-- ============================================================

CREATE OR REPLACE FUNCTION spend_coins(p_user_id uuid, p_amount integer, p_reason text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance int;
  v_is_admin boolean;
BEGIN
  -- Authorization Check
  -- Allow if user is spending their own coins
  IF p_user_id = auth.uid() THEN
    -- OK
  ELSE
    -- Check if caller is admin/lead officer
    SELECT (role IN ('admin', 'lead_troll_officer') OR is_admin = true OR is_lead_officer = true)
    INTO v_is_admin
    FROM user_profiles
    WHERE id = auth.uid();
    
    IF v_is_admin IS NOT TRUE THEN
       RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: You can only spend your own coins.');
    END IF;
  END IF;

  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Check balance
  SELECT troll_coins INTO v_balance FROM user_profiles WHERE id = p_user_id;
  
  IF v_balance IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- Update balance
  UPDATE user_profiles 
  SET troll_coins = troll_coins - p_amount 
  WHERE id = p_user_id;

  -- Log transaction
  INSERT INTO coin_ledger (user_id, amount, event_type, description, metadata)
  VALUES (p_user_id, -p_amount, 'spend', p_reason, p_metadata);

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance - p_amount);
END;
$$;


-- ============================================================
-- Function: troll_bank_spend_coins
-- Source: 20290616000001_fix_critical_rpc_auth.sql
-- Signature: (p_user_id uuid, p_amount numeric, p_bucket text DEFAULT 'paid', p_source text DEFAULT 'purchase', p_ref_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb)
-- Returns: JSONB
-- ============================================================

CREATE OR REPLACE FUNCTION public.troll_bank_spend_coins(
  p_user_id uuid,
  p_amount numeric,
  p_bucket text DEFAULT 'paid',
  p_source text DEFAULT 'purchase',
  p_ref_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance numeric(20, 2);
  v_new_balance numeric(20, 2);
  v_ledger_id uuid;
BEGIN
  -- Authorization: caller must be the spender, or an admin
  IF p_user_id <> auth.uid() AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'Unauthorized: can only spend your own coins'
    USING ERRCODE = '42501';
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Lock user profile and check balance
  SELECT troll_coins INTO v_current_balance
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Deduct balance
  v_new_balance := v_current_balance - p_amount;
  UPDATE public.user_profiles
  SET troll_coins = v_new_balance
  WHERE id = p_user_id;

  -- Insert ledger row
  v_ledger_id := gen_random_uuid();
  INSERT INTO public.coin_ledger (id, user_id, delta, bucket, source, ref_id, metadata, direction)
  VALUES (v_ledger_id, p_user_id, -p_amount, p_bucket, p_source, p_ref_id, p_metadata, 'out');

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance, 'ledger_id', v_ledger_id);
END;
$$;


-- ============================================================
-- Function: troll_bank_credit_coins
-- Source: 20290616000001_fix_critical_rpc_auth.sql
-- Signature: (p_user_id uuid, p_coins int, p_bucket text, p_source text, p_ref_id text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb)
-- Returns: json
-- ============================================================

CREATE OR REPLACE FUNCTION public.troll_bank_credit_coins(
  p_user_id uuid,
  p_coins int,
  p_bucket text,
  p_source text,
  p_ref_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_balance bigint;
  v_user_gets bigint;
BEGIN
  -- Authorization: only admin or service_role can credit coins
  PERFORM public.require_admin();

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

  v_user_gets := p_coins;

  -- Insert ledger row
  INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
  VALUES (p_user_id, v_user_gets, p_bucket, p_source, p_ref_id, p_metadata, 'in');

  -- Update user balance
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + v_user_gets
  WHERE id = p_user_id;

  RETURN json_build_object('user_gets', v_user_gets);
END;
$$;


-- ============================================================
-- Function: send_gift_v2
-- Source: 20260607000000_admin_pool_v2.sql
-- Signature: (p_sender_id UUID, p_receiver_id UUID, p_amount INT, p_gift_id UUID DEFAULT NULL, p_description TEXT DEFAULT 'Gift')
-- Returns: JSON
-- ============================================================

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
  v_admin_pool_id UUID;
  v_usd_value_change NUMERIC(18,2);
  v_new_liability BIGINT;
  v_tx_id UUID;
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

  -- 3. Credit Receiver (Both spendable AND earned)
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + p_amount,
      earned_balance = COALESCE(earned_balance, 0) + p_amount,
      total_earned_coins = COALESCE(total_earned_coins, 0) + p_amount
  WHERE id = p_receiver_id;

  -- 4. Log User Transactions
  INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
  VALUES (p_sender_id, -p_amount, 'gift_sent', p_description, json_build_object('receiver_id', p_receiver_id));

  INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
  VALUES (p_receiver_id, p_amount, 'gift_received', p_description, json_build_object('sender_id', p_sender_id))
  RETURNING id INTO v_tx_id;

  -- 5. Update Admin Pool Liability
  SELECT id INTO v_admin_pool_id FROM public.admin_pool LIMIT 1;
  
  UPDATE public.admin_pool
  SET total_liability_coins = total_liability_coins + p_amount,
      updated_at = NOW()
  WHERE id = v_admin_pool_id;

  -- 6. Log to Admin Ledger
  INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, related_tx_id, usd_value)
  VALUES (p_amount, 'gift_liability_increase', p_receiver_id, v_tx_id, 0);

  RETURN json_build_object('success', true, 'message', 'Gift sent successfully');
END;
$$;


-- ============================================================
-- Function: process_gift_with_lucky
-- Source: 20270209000002_remove_trollmonds_final_v2.sql
-- Signature: (p_sender_id uuid, p_receiver_id uuid, p_paid_coins bigint, p_gift_type text DEFAULT 'standard')
-- Returns: JSONB
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_gift_with_lucky(
    p_sender_id uuid,
    p_receiver_id uuid,
    p_paid_coins bigint,
    p_gift_type text DEFAULT 'standard'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_spend_result jsonb;
    v_credit_result jsonb;
    v_lucky_multiplier integer;
    v_coins_returned bigint := 0;
    v_admin_check boolean := false;
    v_sender_balance bigint;
    v_credit_bonus_result jsonb;
BEGIN
    -- Input validation
    IF p_paid_coins <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid coin amount');
    END IF;

    IF p_sender_id = p_receiver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot send gift to yourself');
    END IF;

    -- Check if receiver is admin
    SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = p_receiver_id AND role = 'admin') INTO v_admin_check;

    -- 1. Spend coins (Atomic deduction via Troll Bank)
    SELECT public.troll_bank_spend_coins_secure(
        p_sender_id,
        p_paid_coins::int,
        'paid',
        'gift_sent',
        null,
        jsonb_build_object('receiver_id', p_receiver_id, 'gift_type', p_gift_type)
    ) INTO v_spend_result;

    IF (v_spend_result->>'success')::boolean = false THEN
        RETURN jsonb_build_object('success', false, 'error', v_spend_result->>'error');
    END IF;

    v_sender_balance := (v_spend_result->>'new_balance')::bigint;

    -- 2. Credit receiver
    SELECT public.troll_bank_credit_coins(
        p_receiver_id,
        p_paid_coins::int,
        'gifted',
        'gift_received',
        null
    ) INTO v_credit_result;

    -- 3. Update receiver's total_earned_coins
    UPDATE user_profiles
    SET total_earned_coins = COALESCE(total_earned_coins, 0) + p_paid_coins
    WHERE id = p_receiver_id;

    -- 4. Lucky Multiplier Logic (Modified to return Troll Coins)
    BEGIN
        SELECT public.calculate_lucky_multiplier(p_paid_coins) INTO v_lucky_multiplier;
    EXCEPTION WHEN OTHERS THEN
        v_lucky_multiplier := NULL;
    END;

    IF v_lucky_multiplier IS NOT NULL THEN
        v_coins_returned := p_paid_coins * v_lucky_multiplier;
        
        -- Credit Troll Coins back to sender (Lucky Bonus)
        SELECT public.troll_bank_credit_coins(
            p_sender_id,
            v_coins_returned::int,
            'reward',
            'lucky_gift_bonus',
            null,
            jsonb_build_object('multiplier', v_lucky_multiplier, 'original_gift', p_paid_coins)
        ) INTO v_credit_bonus_result;
        
        -- Update sender balance reference
        IF (v_credit_bonus_result->>'success')::boolean THEN
             v_sender_balance := (v_credit_bonus_result->>'new_balance')::bigint;
        END IF;
    END IF;

    -- 5. Process admin gift if needed
    IF v_admin_check THEN
        BEGIN
            PERFORM public.process_admin_gift(p_sender_id, p_receiver_id, p_paid_coins);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'spent_coins', p_paid_coins,
        'lucky_multiplier', v_lucky_multiplier,
        'coins_returned', v_coins_returned,
        'new_paid_balance', v_sender_balance
    );
END;
$$;


-- ============================================================
-- Function: try_pay_coins
-- Source: 20270322000000_secure_coin_updates.sql
-- Signature: (p_user_id UUID, p_amount BIGINT, p_reason TEXT, p_metadata JSONB)
-- Returns: BOOLEAN
-- ============================================================

CREATE OR REPLACE FUNCTION public.try_pay_coins(p_user_id UUID, p_amount BIGINT, p_reason TEXT, p_metadata JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance BIGINT;
    v_new_balance BIGINT;
BEGIN
    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- Lock the row to prevent race conditions
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;
    
    IF v_balance IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_balance >= p_amount THEN
        v_new_balance := v_balance - p_amount;
        
        -- Deduct
        UPDATE public.user_profiles 
        SET troll_coins = v_new_balance,
            updated_at = NOW()
        WHERE id = p_user_id;
        
        -- Ledger
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, metadata)
        VALUES (p_user_id, -p_amount, 'spend', p_reason, p_metadata);
        
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;


-- ============================================================
-- Function: add_troll_coins
-- Source: 20270214000000_upgrade_coins_to_bigint.sql
-- Signature: (user_id_input uuid, coins_to_add numeric)
-- Returns: void
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."add_troll_coins"("user_id_input" "uuid", "coins_to_add" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE user_profiles
  SET 
    troll_coins = COALESCE(troll_coins, 0) + coins_to_add,
    total_earned_coins = COALESCE(total_earned_coins, 0) + coins_to_add,
    updated_at = NOW()
  WHERE id = user_id_input;
END;
$$;


-- ============================================================
-- Function: add_free_coins
-- Source: 20270123100000_fix_function_search_paths.sql
-- Signature: (p_user_id uuid, p_amount int)
-- Returns: void
-- ============================================================

CREATE OR REPLACE FUNCTION public.add_free_coins(
    p_user_id uuid,
    p_amount int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        p_amount,
        'promo',
        'troll_surprise',
        NULL,
        jsonb_build_object('legacy_function', 'add_free_coins')
    ) INTO v_result;
END;
$$;


-- ============================================================
-- Function: credit_coins
-- Source: 20270123100000_fix_function_search_paths.sql
-- Signature: (p_user_id uuid, p_coins int, p_reason text DEFAULT 'legacy_credit')
-- Returns: JSONB
-- ============================================================

CREATE OR REPLACE FUNCTION public.credit_coins(
    p_user_id uuid,
    p_coins int,
    p_reason text DEFAULT 'legacy_credit'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        p_coins,
        'paid',
        'legacy_credit',
        NULL,
        jsonb_build_object('reason', p_reason, 'legacy_function', 'credit_coins')
    ) INTO v_result;

    RETURN v_result;
END;
$$;


-- ============================================================
-- Function: admin_grant_coins
-- Source: 20270123100000_fix_function_search_paths.sql
-- Signature: (p_user_id uuid, p_amount int, p_reason text)
-- Returns: JSONB
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_grant_coins(
    p_user_id uuid,
    p_amount int,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        p_amount,
        'promo',
        'admin_grant',
        NULL,
        jsonb_build_object('reason', p_reason)
    ) INTO v_result;

    RETURN v_result;
END;
$$;


-- ============================================================
-- Function: set_user_role
-- Source: 20270305000000_fix_set_user_role_for_service_role.sql
-- Signature: (target_user UUID, new_role TEXT, reason TEXT, acting_admin_id UUID DEFAULT NULL)
-- Returns: VOID
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_user_role(
  target_user UUID,
  new_role TEXT,
  reason TEXT,
  acting_admin_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_old_role TEXT;
  v_admin_id UUID;
BEGIN
  -- Get current user (admin)
  v_admin_id := auth.uid();
  
  -- If called by service role and acting_admin_id is provided, use it
  IF auth.role() = 'service_role' AND acting_admin_id IS NOT NULL THEN
      v_admin_id := acting_admin_id;
  END IF;
  
  -- Check permissions (simple check, RLS should handle more)
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_admin_id AND (role = 'admin' OR is_admin = true)) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can change roles. (Admin ID: %, Role: %)', v_admin_id, auth.role();
  END IF;

  -- Get old role
  SELECT role INTO v_old_role FROM user_profiles WHERE id = target_user;

  -- Update role
  UPDATE user_profiles 
  SET 
      role = new_role,
      is_admin = (new_role = 'admin'),
      is_lead_officer = (new_role = 'lead_troll_officer'),
      is_troll_officer = (new_role IN ('troll_officer', 'lead_troll_officer')),
      is_troller = (new_role = 'troller'),
      updated_at = now()
  WHERE id = target_user;

  -- Log change
  INSERT INTO role_change_log (target_user, changed_by, old_role, new_role, reason, created_at)
  VALUES (target_user, v_admin_id, v_old_role, new_role, reason, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- Function: remove_broadofficer
-- Source: 20290616000001_fix_critical_rpc_auth.sql
-- Signature: (p_target_user_id uuid)
-- Returns: void
-- ============================================================

CREATE OR REPLACE FUNCTION public.remove_broadofficer(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  UPDATE user_profiles
  SET
    is_troll_officer = false,
    is_lead_officer = false,
    is_prosecutor = false,
    is_attorney = false,
    troll_role = NULL,
    updated_at = now()
  WHERE id = p_target_user_id;
END;
$$;


-- ============================================================
-- Function: approve_manual_order
-- Source: 20270921001000_fix_approve_manual_order_fulfill.sql
-- Signature: (p_order_id uuid, p_admin_id uuid, p_external_tx_id text)
-- Returns: TABLE(success boolean, new_balance bigint, error_message text)
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_manual_order(
  p_order_id uuid,
  p_admin_id uuid,
  p_external_tx_id text
)
RETURNS TABLE(success boolean, new_balance bigint, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.manual_coin_orders%rowtype;
  v_balance bigint;
  v_purchase_type text;
  v_bank_result jsonb;
  v_credit_metadata jsonb;
BEGIN
  SELECT * INTO v_order
  FROM public.manual_coin_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::bigint, 'order not found'::text;
    RETURN;
  END IF;

  IF v_order.status <> 'pending' THEN
    IF v_order.status = 'fulfilled' THEN
      SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_order.user_id;
      RETURN QUERY SELECT true, v_balance, NULL::text;
      RETURN;
    END IF;
    RETURN QUERY SELECT false, NULL::bigint, 'invalid status'::text;
    RETURN;
  END IF;

  v_purchase_type := COALESCE(v_order.metadata->>'purchase_type', '');

  -- Mark paid immediately
  UPDATE public.manual_coin_orders
    SET status = 'paid',
        paid_at = now(),
        external_tx_id = COALESCE(p_external_tx_id, external_tx_id),
        processed_by = p_admin_id,
        updated_at = now()
  WHERE id = p_order_id;

  -- Troll Pass bundle path
  IF v_purchase_type = 'troll_pass_bundle' THEN
    PERFORM public.apply_troll_pass_bundle(v_order.user_id);
  ELSE
    v_credit_metadata := jsonb_build_object(
      'admin_id', p_admin_id,
      'manual_order_id', p_order_id,
      'external_tx_id', p_external_tx_id
    );

    -- Credit coins through Troll Bank (handle multiple possible function signatures)
    IF to_regprocedure('public.troll_bank_credit_coins(uuid,int,text,text,text,jsonb)') IS NOT NULL THEN
      SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins::int,
        'paid',
        'manual_purchase',
        p_order_id::text,
        v_credit_metadata
      )::jsonb INTO v_bank_result;
    ELSIF to_regprocedure('public.troll_bank_credit_coins(uuid,bigint,text,text,text,jsonb)') IS NOT NULL THEN
      SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins::bigint,
        'paid',
        'manual_purchase',
        p_order_id::text,
        v_credit_metadata
      )::jsonb INTO v_bank_result;
    ELSIF to_regprocedure('public.troll_bank_credit_coins(uuid,numeric,text,text,text,jsonb)') IS NOT NULL THEN
      SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins::numeric,
        'paid',
        'manual_purchase',
        p_order_id::text,
        v_credit_metadata
      )::jsonb INTO v_bank_result;
    ELSIF to_regprocedure('public.troll_bank_credit_coins(uuid,int,text,text,jsonb)') IS NOT NULL THEN
      -- Older signature: no ref_id param, metadata is 5th arg
      SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins::int,
        'paid',
        'manual_purchase',
        v_credit_metadata
      )::jsonb INTO v_bank_result;
    ELSIF to_regprocedure('public.troll_bank_credit_coins(uuid,bigint,text,text,jsonb)') IS NOT NULL THEN
      SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins::bigint,
        'paid',
        'manual_purchase',
        v_credit_metadata
      )::jsonb INTO v_bank_result;
    ELSIF to_regprocedure('public.troll_bank_credit_coins(uuid,int,text,text,json)') IS NOT NULL THEN
      -- Older signature: metadata is JSON (not JSONB)
      SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins::int,
        'paid',
        'manual_purchase',
        v_credit_metadata::json
      )::jsonb INTO v_bank_result;
    ELSIF to_regprocedure('public.troll_bank_credit_coins(uuid,bigint,text,text,json)') IS NOT NULL THEN
      SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins::bigint,
        'paid',
        'manual_purchase',
        v_credit_metadata::json
      )::jsonb INTO v_bank_result;
    ELSE
      RAISE EXCEPTION 'troll_bank_credit_coins signature not found';
    END IF;

    -- Update stats
    UPDATE public.user_profiles
    SET
      paid_coins = COALESCE(paid_coins, 0) + v_order.coins,
      total_earned_coins = COALESCE(total_earned_coins, 0) + v_order.coins
    WHERE id = v_order.user_id;
  END IF;

  -- Mark fulfilled
  UPDATE public.manual_coin_orders
    SET status = 'fulfilled',
        fulfilled_at = now(),
        updated_at = now()
  WHERE id = p_order_id;

  -- Send notification
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (v_order.user_id, 'coin_purchase', 'Coins Credited', 'Your manual coin purchase of ' || v_order.coins || ' coins has been approved and credited to your account.', jsonb_build_object('order_id', p_order_id));

  SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_order.user_id;
  RETURN QUERY SELECT true, v_balance, NULL::text;
END;
$$;


-- ============================================================
-- Function: process_boosted_gift
-- Source: 20260120000600_missing_gift_rpcs.sql
-- Signature: (p_sender uuid, p_receiver uuid, p_gift_value int, p_gift_id text)
-- Returns: JSONB
-- ============================================================

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


-- ============================================================
-- Function: apply_troll_pass_bundle
-- Source: 20270123100000_fix_function_search_paths.sql
-- Signature: (p_user_id uuid)
-- Returns: timestamptz
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_troll_pass_bundle(
    p_user_id uuid
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_new_expiry timestamptz;
    v_coins int := 1500; -- Bundle includes 1500 coins
    v_bank_result json;
BEGIN
    -- 1. Credit Coins using Troll Bank (Atomic, handles loan repayment if any)
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        v_coins,
        'paid', -- Treat as paid coins since Troll Pass is purchased
        'troll_pass_bundle',
        NULL, -- No specific ref_id passed here, could be added if needed
        jsonb_build_object('item', 'Troll Pass Bundle')
    ) INTO v_bank_result;

    -- 2. Update Expiry (Extend if active, set new if expired)
    SELECT 
        CASE 
            WHEN troll_pass_expires_at > now() THEN troll_pass_expires_at + interval '30 days'
            ELSE now() + interval '30 days'
        END
    INTO v_new_expiry
    FROM public.user_profiles
    WHERE id = p_user_id;

    -- Handle case where user might not be found (unlikely) or null date
    IF v_new_expiry IS NULL THEN
        v_new_expiry := now() + interval '30 days';
    END IF;

    UPDATE public.user_profiles
    SET troll_pass_expires_at = v_new_expiry
    WHERE id = p_user_id;

    RETURN v_new_expiry;
END;
$$;


-- ============================================================
-- Function: process_stream_billing
-- Source: 20290617000002_credit_broadcaster_stream_fees.sql
-- Signature: (p_stream_id UUID, p_user_id UUID, p_is_host BOOLEAN)
-- Returns: JSON
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_stream_billing(
  p_stream_id UUID,
  p_user_id UUID,
  p_is_host BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream RECORD;
  v_user_profile RECORD;
  v_cost NUMERIC(20, 2);
  v_guest RECORD;
  v_broadcaster_id UUID;
BEGIN
  SELECT * INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id;

  IF NOT FOUND OR v_stream.is_live = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stream not found or not active');
  END IF;

  v_broadcaster_id := v_stream.user_id;

  SELECT * INTO v_user_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- A. Broadcaster Billing (0.5 coins/min)
  IF p_is_host THEN
    v_cost := 0.5;

    IF v_cost > 0 THEN
        IF v_user_profile.troll_coins < v_cost THEN
           UPDATE public.streams
           SET is_live = false, ended_at = NOW()
           WHERE id = p_stream_id;

           RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds', 'action', 'end_stream');
        END IF;

        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_cost,
            total_spent_coins = total_spent_coins + v_cost
        WHERE id = p_user_id;

        INSERT INTO public.coin_transactions (
          user_id, amount, type, description, stream_id, from_user_id, to_user_id
        ) VALUES (
          p_user_id, -v_cost, 'stream_cost', 'Broadcasting fee (1 min)', p_stream_id, p_user_id, NULL
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'cost', v_cost, 'remaining', v_user_profile.troll_coins - v_cost);
  END IF;

  -- B. Guest Billing (0.5 coins/min)
  SELECT * INTO v_guest
  FROM public.stream_guests
  WHERE stream_id = p_stream_id AND user_id = p_user_id AND status = 'active';

  IF FOUND THEN
      v_cost := 0.5;

      IF v_cost > 0 THEN
          IF v_user_profile.troll_coins < v_cost THEN
            UPDATE public.stream_guests
            SET status = 'removed', left_at = NOW()
            WHERE stream_id = p_stream_id AND user_id = p_user_id;

            RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds', 'action', 'remove_guest');
          END IF;

          -- Deduct coins from guest
          UPDATE public.user_profiles
          SET troll_coins = troll_coins - v_cost,
              total_spent_coins = total_spent_coins + v_cost
          WHERE id = p_user_id;

          -- Credit broadcaster
          UPDATE public.user_profiles
          SET troll_coins = troll_coins + v_cost
          WHERE id = v_broadcaster_id;

          -- Record transactions for guest (debit) and broadcaster (credit)
          INSERT INTO public.coin_transactions (user_id, amount, type, description, stream_id, from_user_id, to_user_id)
          VALUES
            (p_user_id, -v_cost, 'stream_cost', 'Guest participation fee (1 min)', p_stream_id, p_user_id, v_broadcaster_id),
            (v_broadcaster_id, v_cost, 'guest_box_income', 'Guest participation fee (1 min)', p_stream_id, p_user_id, v_broadcaster_id);
      END IF;

      RETURN jsonb_build_object('success', true, 'cost', v_cost, 'remaining', v_user_profile.troll_coins - v_cost);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'User not associated with stream billing');
END;
$$;
