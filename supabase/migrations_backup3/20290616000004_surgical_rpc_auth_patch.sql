-- ============================================================
-- SURGICAL SECURITY PATCH: Add authorization to 3 high-risk functions
-- Targets only functions that lack server-side authorization checks:
--   1. troll_bank_credit_coins — any user can mint unlimited coins
--   2. try_pay_coins — any user can drain any user's coins
--   3. send_gift_v2 — any user can send gifts from any user's account
--
-- Approach: Add auth checks at the top of each function body.
-- Preserves all existing business logic (loan repayment, ledger writes, etc.).
-- Uses auth.role() = 'service_role' bypass for edge functions/cron.
-- ============================================================

-- ============================================================
-- 1. troll_bank_credit_coins
-- Current: (p_user_id uuid, p_coins int, p_bucket text, p_source text, p_ref_id text, p_metadata jsonb)
-- Risk: Any authenticated user can mint unlimited coins to any account
-- Fix: Add authorization check — caller must be admin or service_role
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
    -- SECURITY: Allow service_role (edge functions, cron) to bypass
    IF auth.role() <> 'service_role' THEN
        -- For authenticated users, verify admin status
        IF NOT EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (is_admin = true OR role IN ('admin', 'superadmin', 'secretary'))
        ) THEN
            RAISE EXCEPTION 'Unauthorized: admin role required to credit coins'
            USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Set bypass flag for the transaction
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

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

    -- Check Feature Flags (Safely handle if table doesn't exist)
    BEGIN
        SELECT is_enabled INTO v_gift_repayment_enabled
        FROM public.bank_feature_flags
        WHERE key = 'gift_repayment_enabled';
    EXCEPTION WHEN OTHERS THEN
        v_gift_repayment_enabled := false;
    END;

    -- Determine repayment eligibility
    IF v_loan_record IS NOT NULL THEN
        IF p_bucket = 'paid' OR (p_bucket = 'gifted' AND v_gift_repayment_enabled = true) THEN
            v_repay_amount := LEAST(v_loan_record.balance, FLOOR(p_coins * 0.50)::bigint);
        END IF;
    END IF;

    v_user_gets := p_coins - v_repay_amount;

    -- Insert ledger rows
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

    -- Credit
    IF v_user_gets > 0 THEN
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
        VALUES (p_user_id, v_user_gets, p_bucket, p_source, p_ref_id, p_metadata, 'in');
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

-- Keep existing grants (service_role + authenticated)
-- service_role: used by edge functions (coin purchases, gifts, etc.)
-- authenticated: now protected by admin check inside function

-- ============================================================
-- 2. try_pay_coins
-- Current: (p_user_id UUID, p_amount BIGINT, p_reason TEXT, p_metadata JSONB)
-- Risk: Any authenticated user can drain any user's coins
-- Fix: Add authorization — caller must be the spender or admin
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
    -- SECURITY: Allow service_role to bypass
    IF auth.role() <> 'service_role' THEN
        -- Caller must be the spender, or an admin
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

    -- Set bypass flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- Lock the row to prevent race conditions
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
-- Current: (p_sender_id UUID, p_receiver_id UUID, p_amount INT, p_gift_id UUID, p_description TEXT)
-- Risk: Any authenticated user can send gifts from any user's account
-- Fix: Add authorization — caller must be the sender or admin
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
    -- SECURITY: Allow service_role to bypass
    IF auth.role() <> 'service_role' THEN
        -- Caller must be the sender, or an admin
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
