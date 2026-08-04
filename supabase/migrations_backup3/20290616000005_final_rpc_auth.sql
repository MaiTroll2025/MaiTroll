-- ============================================================
-- FINAL RPC AUTH PATCH: Surgical authorization-only changes
-- Created: 2026-06-16
--
-- Replaces: 20290616000001_fix_critical_rpc_auth.sql (which had
--           incorrect function bodies that broke loan repayment,
--           gift logic, and other production features)
--
-- Strategy:
--   For each function below, the body is the EXACT production
--   version from the latest migration that defined it, with
--   ONLY an authorization block inserted after DECLARE/BEGIN.
--   No business logic, ledger, loan, gift, or payout code was
--   changed, added, or removed.
--
-- Sources (latest production bodies):
--   troll_bank_credit_coins <- 20270327000020_secure_credit_coins.sql
--   try_pay_coins           <- 20270322000000_secure_coin_updates.sql
--   send_gift_v2            <- 20260607000000_admin_pool_v2.sql
-- ============================================================


-- ============================================================
-- 1. troll_bank_credit_coins
-- Production body source: 20270327000020_secure_credit_coins.sql
-- Signature: (p_user_id uuid, p_coins int, p_bucket text, p_source text, p_ref_id text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb)
-- Returns: json
--
-- Change: Added authorization block (lines 43-53 of the function body).
-- Everything else is identical to the 20270327000020 production version.
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
    v_loan_record record;
    v_repay_amount bigint := 0;
    v_user_gets bigint;
    v_new_loan_balance bigint;
    v_loan_status text;
    v_gift_repayment_enabled boolean := false;
BEGIN
    -- ========== AUTH ADDED: service_role bypass, otherwise require admin ==========
    IF auth.role() <> 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (is_admin = true OR role IN ('admin', 'superadmin', 'secretary'))
        ) THEN
            RAISE EXCEPTION 'Unauthorized: admin role required to credit coins'
            USING ERRCODE = '42501';
        END IF;
    END IF;
    -- ========== END AUTH ==========

    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    IF p_coins <= 0 THEN
        RAISE EXCEPTION 'Coins must be positive';
    END IF;

    SELECT troll_coins INTO v_user_balance
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    SELECT * INTO v_loan_record
    FROM public.loans
    WHERE user_id = p_user_id AND status = 'active'
    LIMIT 1
    FOR UPDATE;

    BEGIN
        SELECT is_enabled INTO v_gift_repayment_enabled
        FROM public.bank_feature_flags
        WHERE key = 'gift_repayment_enabled';
    EXCEPTION WHEN OTHERS THEN
        v_gift_repayment_enabled := false;
    END;

    IF v_loan_record IS NOT NULL THEN
        IF p_bucket = 'paid' OR (p_bucket = 'gifted' AND v_gift_repayment_enabled = true) THEN
            v_repay_amount := LEAST(v_loan_record.balance, FLOOR(p_coins * 0.50)::bigint);
        END IF;
    END IF;

    v_user_gets := p_coins - v_repay_amount;

    IF v_repay_amount > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
        VALUES (p_user_id, -v_repay_amount, 'repayment', 'auto_repay', p_ref_id, p_metadata, 'out');

        UPDATE public.loans
        SET balance = balance - v_repay_amount,
            status = CASE WHEN balance - v_repay_amount <= 0 THEN 'paid' ELSE status END,
            closed_at = CASE WHEN balance - v_repay_amount <= 0 THEN now() ELSE closed_at END
        WHERE id = v_loan_record.id
        RETURNING balance, status INTO v_new_loan_balance, v_loan_status;

        BEGIN
            INSERT INTO public.admin_allocation_buckets (bucket_name) VALUES ('Treasury') ON CONFLICT DO NOTHING;
            UPDATE public.admin_allocation_buckets
            SET balance_coins = balance_coins + v_repay_amount
            WHERE bucket_name = 'Treasury';
            INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at)
            VALUES (v_repay_amount, 'Loan Repayment from ' || p_user_id, p_user_id, NOW());
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    ELSE
        v_new_loan_balance := CASE WHEN v_loan_record IS NOT NULL THEN v_loan_record.balance ELSE 0 END;
        v_loan_status := CASE WHEN v_loan_record IS NOT NULL THEN v_loan_record.status ELSE 'none' END;
    END IF;

    IF v_user_gets > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
        VALUES (p_user_id, v_user_gets, p_bucket, p_source, p_ref_id, p_metadata, 'in');
    END IF;

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

-- Keep existing grants: both service_role and authenticated need access
-- (auth check inside function body enforces admin-only for authenticated)
GRANT EXECUTE ON FUNCTION public.troll_bank_credit_coins(uuid, int, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.troll_bank_credit_coins(uuid, int, text, text, text, jsonb) TO authenticated;


-- ============================================================
-- 2. try_pay_coins
-- Production body source: 20270322000000_secure_coin_updates.sql
-- Signature: (p_user_id UUID, p_amount BIGINT, p_reason TEXT, p_metadata JSONB)
-- Returns: BOOLEAN
--
-- Change: Added authorization block (lines 172-184 of the function body).
-- Everything else is identical to the 20270322000000 production version.
-- ============================================================

CREATE OR REPLACE FUNCTION public.try_pay_coins(
    p_user_id UUID,
    p_amount BIGINT,
    p_reason TEXT,
    p_metadata JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance BIGINT;
    v_new_balance BIGINT;
BEGIN
    -- ========== AUTH ADDED: service_role bypass, otherwise require self or admin ==========
    IF auth.role() <> 'service_role' THEN
        IF p_user_id <> auth.uid() THEN
            IF NOT EXISTS (
                SELECT 1 FROM user_profiles
                WHERE id = auth.uid()
                AND (is_admin = true OR role IN ('admin', 'superadmin', 'secretary'))
            ) THEN
                RAISE EXCEPTION 'Unauthorized: can only spend your own coins'
                USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;
    -- ========== END AUTH ==========

    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;

    IF v_balance IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_balance >= p_amount THEN
        v_new_balance := v_balance - p_amount;

        UPDATE public.user_profiles
        SET troll_coins = v_new_balance,
            updated_at = NOW()
        WHERE id = p_user_id;

        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, metadata)
        VALUES (p_user_id, -p_amount, 'spend', p_reason, p_metadata);

        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;


-- ============================================================
-- 3. send_gift_v2
-- Production body source: 20260607000000_admin_pool_v2.sql
-- Signature: (p_sender_id UUID, p_receiver_id UUID, p_amount INT, p_gift_id UUID DEFAULT NULL, p_description TEXT DEFAULT 'Gift')
-- Returns: JSON
--
-- Change: Added authorization block (lines 241-253 of the function body).
-- Everything else is identical to the 20260607000000 production version.
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
SET search_path = public
AS $$
DECLARE
    v_sender_balance BIGINT;
    v_admin_pool_id UUID;
    v_usd_value_change NUMERIC(18,2);
    v_new_liability BIGINT;
    v_tx_id UUID;
BEGIN
    -- ========== AUTH ADDED: service_role bypass, otherwise require sender or admin ==========
    IF auth.role() <> 'service_role' THEN
        IF p_sender_id <> auth.uid() THEN
            IF NOT EXISTS (
                SELECT 1 FROM user_profiles
                WHERE id = auth.uid()
                AND (is_admin = true OR role IN ('admin', 'superadmin', 'secretary'))
            ) THEN
                RAISE EXCEPTION 'Unauthorized: can only send gifts from your own account'
                USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;
    -- ========== END AUTH ==========

    SELECT troll_coins INTO v_sender_balance FROM public.user_profiles WHERE id = p_sender_id;

    IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_amount,
        total_spent_coins = COALESCE(total_spent_coins, 0) + p_amount
    WHERE id = p_sender_id;

    UPDATE public.user_profiles
    SET troll_coins = troll_coins + p_amount,
        earned_balance = COALESCE(earned_balance, 0) + p_amount,
        total_earned_coins = COALESCE(total_earned_coins, 0) + p_amount
    WHERE id = p_receiver_id;

    INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
    VALUES (p_sender_id, -p_amount, 'gift_sent', p_description, json_build_object('receiver_id', p_receiver_id));

    INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
    VALUES (p_receiver_id, p_amount, 'gift_received', p_description, json_build_object('sender_id', p_sender_id))
    RETURNING id INTO v_tx_id;

    SELECT id INTO v_admin_pool_id FROM public.admin_pool LIMIT 1;

    UPDATE public.admin_pool
    SET total_liability_coins = total_liability_coins + p_amount,
        updated_at = NOW()
    WHERE id = v_admin_pool_id;

    INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, related_tx_id, usd_value)
    VALUES (p_amount, 'gift_liability_increase', p_receiver_id, v_tx_id, 0);

    RETURN json_build_object('success', true, 'message', 'Gift sent successfully');
END;
$$;
