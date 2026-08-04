
-- Migration: Troll Pass Bundle & Loan Repayment to Admin Pool
-- 1. Ensure Troll Pass column exists
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS troll_pass_expires_at TIMESTAMPTZ;

-- 2. Define apply_troll_pass_bundle
CREATE OR REPLACE FUNCTION public.apply_troll_pass_bundle(
    p_user_id uuid
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
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

    -- 3. (Optional) Grant Perks logic could go here (e.g. insert into user_perks)
    -- For now, we assume frontend/other logic checks troll_pass_expires_at for benefits.

    RETURN v_new_expiry;
END;
$$;

-- 3. Update troll_bank_credit_coins to credit Admin Pool on Repayment
-- Re-definition with Admin Pool credit logic
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
    v_gift_repayment_enabled boolean := false;
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

    -- Check Feature Flags (Safely handle if table doesn't exist)
    BEGIN
        SELECT is_enabled INTO v_gift_repayment_enabled
        FROM public.bank_feature_flags
        WHERE key = 'gift_repayment_enabled';
    EXCEPTION WHEN OTHERS THEN
        v_gift_repayment_enabled := false;
    END;

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

        -- NEW: Credit Admin Pool (Treasury) with Repayment
        -- "instantly paid back automatically to admin pool"
        BEGIN
            INSERT INTO public.admin_allocation_buckets (bucket_name) VALUES ('Treasury') ON CONFLICT DO NOTHING;
            
            UPDATE public.admin_allocation_buckets
            SET balance_coins = balance_coins + v_repay_amount
            WHERE bucket_name = 'Treasury';

            -- Audit Log for Repayment to Pool
            INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at)
            VALUES (v_repay_amount, 'Loan Repayment from ' || p_user_id, p_user_id, NOW());
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors if admin tables don't exist yet (robustness)
            NULL;
        END;

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
