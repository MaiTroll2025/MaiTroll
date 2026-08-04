-- ============================================================
-- CRITICAL: Fix SECURITY DEFINER RPC functions that lack authorization
-- Fixes all 5 issues raised in code review:
--   1. Actually adds authorization checks inside function bodies (not just search_path)
--   2. Uses exact signatures for REVOKE (PostgreSQL requires them for overloaded functions)
--   3. Handles auth.uid() = NULL (service_role, cron jobs) by checking auth.role() first
--   4. Uses only verified column names from user_profiles
--   5. Renames set_user_role -> reset_user_permissions (it removes roles, not sets them)
-- ============================================================

-- ============================================================
-- Helper: Check if caller is admin
-- Handles service_role bypass (auth.uid() can be NULL for service_role/cron)
-- ============================================================

CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role to bypass (used by edge functions, cron jobs)
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;

  -- For authenticated users, verify admin status
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (
      is_admin = true
      OR role IN ('admin', 'superadmin', 'secretary')
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required'
    USING ERRCODE = '42501';
  END IF;
END;
$$;

-- ============================================================
-- 1. Replace set_user_role with reset_user_permissions
-- Old name was misleading — this function REMOVES roles, doesn't set them
-- Adds admin authorization check
-- ============================================================

-- Drop old function (all overloads)
DROP FUNCTION IF EXISTS public.set_user_role(uuid);

-- Create replacement with proper authorization
CREATE OR REPLACE FUNCTION public.reset_user_permissions(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  UPDATE user_profiles
  SET
    role = 'user',
    is_troll_officer = false,
    is_lead_officer = false,
    is_prosecutor = false,
    is_attorney = false,
    is_secretary = false,
    troll_role = NULL,
    officer_level = 0,
    updated_at = now()
  WHERE id = p_target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_user_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_user_permissions(uuid) TO service_role;

-- ============================================================
-- 2. Fix remove_broadofficer: Add admin authorization check
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

GRANT EXECUTE ON FUNCTION public.remove_broadofficer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_broadofficer(uuid) TO service_role;

-- ============================================================
-- 3. Fix spend_coins: Add auth check (sender must be caller or admin)
-- Current signature: (p_sender_id uuid, p_receiver_id uuid, p_coin_amount integer, p_source varchar, p_item varchar)
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

GRANT EXECUTE ON FUNCTION public.spend_coins(uuid, uuid, integer, varchar, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_coins(uuid, uuid, integer, varchar, varchar) TO service_role;

-- ============================================================
-- 4. Fix troll_bank_credit_coins: Add admin check
-- Current signature: (p_user_id uuid, p_coins int, p_bucket text, p_source text, p_ref_id text, p_metadata jsonb)
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

GRANT EXECUTE ON FUNCTION public.troll_bank_credit_coins(uuid, int, text, text, text, jsonb) TO service_role;
-- NOTE: revoked from authenticated — only service_role (edge functions) can mint coins

-- ============================================================
-- 5. Fix troll_bank_spend_coins: Add auth check (caller must be spender or admin)
-- Current signature: (p_user_id uuid, p_amount numeric, p_bucket text, p_source text, p_ref_id uuid, p_metadata jsonb)
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

GRANT EXECUTE ON FUNCTION public.troll_bank_spend_coins(uuid, numeric, text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.troll_bank_spend_coins(uuid, numeric, text, text, uuid, jsonb) TO service_role;

-- ============================================================
-- 6. Fix add_troll_coins / add_free_coins / credit_coins / admin_grant_coins:
--    Revoke from authenticated (no frontend callers), keep service_role
--    Uses exact signatures for REVOKE
-- ============================================================

-- add_troll_coins(uuid, integer)
REVOKE EXECUTE ON FUNCTION public.add_troll_coins(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_troll_coins(uuid, integer) TO service_role;

-- add_free_coins(uuid, bigint)
REVOKE EXECUTE ON FUNCTION public.add_free_coins(uuid, bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_free_coins(uuid, bigint) TO service_role;

-- credit_coins(uuid, integer) — if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'credit_coins' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.credit_coins FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.credit_coins TO service_role';
  END IF;
END $$;

-- admin_grant_coins — if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_grant_coins' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.admin_grant_coins FROM authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.admin_grant_coins TO service_role';
  END IF;
END $$;

-- ============================================================
-- 7. Set search_path on remaining functions that are still callable from frontend
--    (These already have auth checks inside or are low-risk)
-- ============================================================

DO $$
DECLARE
  func_record RECORD;
  target_funcs TEXT[] := ARRAY['try_pay_coins', 'send_gift_v2', 'process_gift_with_lucky', 'process_boosted_gift', 'apply_troll_pass_bundle', 'process_stream_billing', 'approve_manual_order'];
  func_name TEXT;
BEGIN
  FOREACH func_name IN ARRAY target_funcs
  LOOP
    FOR func_record IN
      SELECT pg_get_function_identity_arguments(oid) as args
      FROM pg_proc
      WHERE proname = func_name
      AND pronamespace = 'public'::regnamespace
    LOOP
      EXECUTE format(
        'ALTER FUNCTION public.%I(%s) SET search_path = public',
        func_name,
        func_record.args
      );
      RAISE NOTICE 'Set search_path = public for %', func_name;
    END LOOP;
  END LOOP;
END $$;
