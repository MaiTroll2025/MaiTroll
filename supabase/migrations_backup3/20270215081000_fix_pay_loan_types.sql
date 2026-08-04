-- Fix integer out of range in pay_bank_loan by using BIGINT
-- Also ensures variables handling coin balances are BIGINT
-- And ensures the user_profiles.troll_coins column is BIGINT

DO $$
BEGIN
    -- Ensure troll_coins is BIGINT to prevent overflow
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'user_profiles' 
          AND column_name = 'troll_coins' 
          AND data_type = 'integer'
    ) THEN
        ALTER TABLE public.user_profiles ALTER COLUMN troll_coins TYPE BIGINT;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pay_bank_loan(
    p_loan_id UUID,
    p_amount BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_loan RECORD;
    v_balance BIGINT;
    v_credit_increase BIGINT;
    v_new_score INTEGER;
    v_current_score INTEGER;
    v_actual_pay BIGINT;
BEGIN
    -- 1. Verify Loan
    SELECT * INTO v_loan FROM public.loans WHERE id = p_loan_id;

    IF NOT FOUND OR v_loan.user_id != v_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan not found');
    END IF;

    IF v_loan.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Loan is not active');
    END IF;

    -- Cap amount to remaining balance
    v_actual_pay := p_amount;
    IF v_actual_pay > v_loan.balance THEN
        v_actual_pay := v_loan.balance;
    END IF;

    IF v_actual_pay <= 0 THEN
         RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
    END IF;

    -- 2. Check User Balance
    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < v_actual_pay THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
    END IF;

    -- 3. Process Payment
    -- Deduct coins
    UPDATE public.user_profiles 
    SET troll_coins = troll_coins - v_actual_pay 
    WHERE id = v_user_id;

    -- Log Ledger
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, metadata)
    VALUES (v_user_id, -v_actual_pay, 'loan_repayment', 'bank', 'Manual Loan Repayment', jsonb_build_object('loan_id', p_loan_id));

    -- Update Loan
    UPDATE public.loans
    SET balance = balance - v_actual_pay,
        status = CASE WHEN (balance - v_actual_pay) <= 0 THEN 'paid' ELSE 'active' END
    WHERE id = p_loan_id;

    -- 4. Check for Full Payment & Credit Score Increase
    IF (v_loan.balance - v_actual_pay) <= 0 THEN
        -- Calculate 5% of principal
        v_credit_increase := FLOOR(v_loan.principal * 0.05);

        IF v_credit_increase > 0 THEN
            -- Get current score (lock for update)
            SELECT score INTO v_current_score FROM public.user_credit WHERE user_id = v_user_id FOR UPDATE;
            
            IF v_current_score IS NULL THEN
                v_current_score := 400; -- Default
                INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
                VALUES (v_user_id, 400, 'Building', 0, NOW());
            END IF;

            -- Update Score (Cap at 800)
            v_new_score := LEAST(800, v_current_score + v_credit_increase);

            IF v_new_score > v_current_score THEN
                UPDATE public.user_credit
                SET score = v_new_score,
                    tier = public.get_credit_tier(v_new_score),
                    updated_at = NOW(),
                    last_event_at = NOW()
                WHERE user_id = v_user_id;

                -- Log Credit Event
                INSERT INTO public.credit_events (
                    user_id,
                    event_type,
                    delta,
                    source_table,
                    source_id,
                    metadata
                ) VALUES (
                    v_user_id,
                    'loan_repaid',
                    v_new_score - v_current_score,
                    'loans',
                    p_loan_id,
                    jsonb_build_object('principal', v_loan.principal, 'percentage', '5%', 'increase', v_credit_increase)
                );
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'paid', v_actual_pay, 'remaining', v_loan.balance - v_actual_pay);
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_bank_loan(UUID, BIGINT) TO authenticated;
