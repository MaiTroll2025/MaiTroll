-- ============================================================================
-- Migration: Realistic Credit Card System Overhaul
-- Date: 2026-06-01
-- Purpose: Replace flat-fee credit card with real-world billing cycle system
--
-- Key changes:
--   1. Monthly billing cycles with statement_date + grace_period + due_date
--   2. Daily compounding APR based on credit tier (replaces flat 8% purchase fee)
--   3. Minimum payment (1% of balance or 25 coins, whichever is greater)
--   4. Late fees (35 coins) for missed minimum payments
--   5. Credit card transaction line items (like real statements)
--   6. Daily interest accrual function
--   7. Credit limit auto-adjustment based on payment history
--   8. Updated repossession to use due dates instead of 60-day blanket
-- ============================================================================

-- ============================================================================
-- 1. SCHEMA CHANGES TO user_profiles
-- ============================================================================

DO $$
BEGIN
    -- Statement cycle tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'stmt_statement_date') THEN
        ALTER TABLE public.user_profiles ADD COLUMN stmt_statement_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'stmt_due_date') THEN
        ALTER TABLE public.user_profiles ADD COLUMN stmt_due_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'stmt_balance') THEN
        ALTER TABLE public.user_profiles ADD COLUMN stmt_balance BIGINT DEFAULT 0;  -- balance at last statement close
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'stmt_minimum_payment') THEN
        ALTER TABLE public.user_profiles ADD COLUMN stmt_minimum_payment BIGINT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'stmt_past_due') THEN
        ALTER TABLE public.user_profiles ADD COLUMN stmt_past_due BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'stmt_late_fees_accrued') THEN
        ALTER TABLE public.user_profiles ADD COLUMN stmt_late_fees_accrued BIGINT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'stmt_interest_accrued') THEN
        ALTER TABLE public.user_profiles ADD COLUMN stmt_interest_accrued BIGINT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'stmt_total_payments_ytd') THEN
        ALTER TABLE public.user_profiles ADD COLUMN stmt_total_payments_ytd BIGINT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'stmt_on_time_payments') THEN
        ALTER TABLE public.user_profiles ADD COLUMN stmt_on_time_payments INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'stmt_late_payments') THEN
        ALTER TABLE public.user_profiles ADD COLUMN stmt_late_payments INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'stmt_apr_percent') THEN
        ALTER TABLE public.user_profiles ADD COLUMN stmt_apr_percent NUMERIC DEFAULT 25.0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'stmt_last_accrual_date') THEN
        ALTER TABLE public.user_profiles ADD COLUMN stmt_last_accrual_date DATE;
    END IF;
END $$;

-- ============================================================================
-- 2. CREDIT CARD TRANSACTIONS TABLE (line items like a real statement)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.credit_card_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Transaction details
    amount              BIGINT NOT NULL,               -- principal charge in coins
    transaction_type    TEXT NOT NULL DEFAULT 'purchase',  -- 'purchase' | 'payment' | 'interest' | 'late_fee' | 'credit' | 'adjustment'
    description         TEXT,
    context             TEXT,                          -- 'shop_purchase' | 'vehicle_purchase' | etc.
    metadata            JSONB DEFAULT '{}'::jsonb,
    -- Statement cycle tracking
    billing_cycle_date  DATE NOT NULL DEFAULT CURRENT_DATE,  -- which statement period this falls in
    -- Status
    is_paid             BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at             TIMESTAMPTZ,
    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cct_user_id        ON public.credit_card_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cct_billing_cycle   ON public.credit_card_transactions(user_id, billing_cycle_date);
CREATE INDEX IF NOT EXISTS idx_cct_type           ON public.credit_card_transactions(transaction_type);

ALTER TABLE public.credit_card_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_card_transactions' AND policyname = 'cct_select_owner') THEN
        CREATE POLICY cct_select_owner ON public.credit_card_transactions FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_card_transactions' AND policyname = 'cct_service_role_all') THEN
        CREATE POLICY cct_service_role_all ON public.credit_card_transactions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.credit_card_transactions TO authenticated;

-- ============================================================================
-- 3. BILLING CYCLES TABLE (tracks each monthly statement period)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.credit_card_billing_cycles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cycle_start_date    DATE NOT NULL,
    statement_date      DATE NOT NULL,
    due_date            DATE NOT NULL,
    -- Balances
    opening_balance     BIGINT NOT NULL DEFAULT 0,
    closing_balance     BIGINT NOT NULL DEFAULT 0,     -- statement balance
    total_charges       BIGINT NOT NULL DEFAULT 0,
    total_payments      BIGINT NOT NULL DEFAULT 0,
    interest_charged    BIGINT NOT NULL DEFAULT 0,
    late_fees_charged   BIGINT NOT NULL DEFAULT 0,
    minimum_payment     BIGINT NOT NULL DEFAULT 0,
    -- Status
    is_closed           BOOLEAN NOT NULL DEFAULT FALSE,
    is_paid             BOOLEAN NOT NULL DEFAULT FALSE,
    is_past_due         BOOLEAN NOT NULL DEFAULT FALSE,
    payment_received_at TIMESTAMPTZ,
    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ccbc_user_id      ON public.credit_card_billing_cycles(user_id, cycle_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_ccbc_past_due     ON public.credit_card_billing_cycles(is_past_due) WHERE is_past_due = TRUE;
CREATE INDEX IF NOT EXISTS idx_ccbc_due_date     ON public.credit_card_billing_cycles(due_date) WHERE is_paid = FALSE AND is_closed = TRUE;

ALTER TABLE public.credit_card_billing_cycles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_card_billing_cycles' AND policyname = 'ccbc_select_owner') THEN
        CREATE POLICY ccbc_select_owner ON public.credit_card_billing_cycles FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_card_billing_cycles' AND policyname = 'ccbc_service_role_all') THEN
        CREATE POLICY ccbc_service_role_all ON public.credit_card_billing_cycles FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.credit_card_billing_cycles TO authenticated;

-- ============================================================================
-- 4. HELPER: Get APR rate based on credit score tier
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_cc_apr(p_score INTEGER)
RETURNS NUMERIC AS $$
BEGIN
    -- Realistic APR tiers based on credit worthiness
    IF p_score >= 800 THEN RETURN 15.0;   -- Elite: prime rate
    ELSIF p_score >= 700 THEN RETURN 18.0;  -- Trusted: good rate
    ELSIF p_score >= 600 THEN RETURN 22.0;  -- Reliable: average rate
    ELSIF p_score >= 450 THEN RETURN 28.0;  -- Building: subprime
    ELSIF p_score >= 300 THEN RETURN 35.0;  -- Shaky: high risk
    ELSE RETURN 45.0;                        -- Untrusted: very high risk
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 5. HELPER: Initialize first billing cycle for a user
-- ============================================================================

CREATE OR REPLACE FUNCTION public.init_credit_billing_cycle(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_statement_date DATE;
    v_due_date DATE;
BEGIN
    -- Statement closes today, due 25 days later (realistic grace period)
    v_statement_date := CURRENT_DATE;
    v_due_date := CURRENT_DATE + INTERVAL '25 days';

    UPDATE public.user_profiles
    SET stmt_statement_date = v_statement_date,
        stmt_due_date = v_due_date,
        stmt_apr_percent = public.get_cc_apr(COALESCE(credit_score, 400))
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. REWRITE: draw_credit_internal - No flat fee, just principal charge
-- ============================================================================

DROP FUNCTION IF EXISTS public.draw_credit_internal(UUID, BIGINT);

CREATE OR REPLACE FUNCTION public.draw_credit_internal(
    p_user_id UUID,
    p_amount BIGINT,
    p_description TEXT DEFAULT 'Credit Card Purchase',
    p_context TEXT DEFAULT 'shop_purchase',
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BIGINT  -- Returns the amount charged (just principal, no fee)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_billing_cycle_date DATE;
BEGIN
    SELECT * INTO v_profile FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;

    IF v_profile IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Validate credit limit
    IF (v_profile.credit_limit - v_profile.credit_used) < p_amount THEN
        RAISE EXCEPTION 'Credit limit exceeded';
    END IF;

    -- Initialize billing cycle on first purchase if needed
    IF v_profile.stmt_statement_date IS NULL THEN
        PERFORM public.init_credit_billing_cycle(p_user_id);
        -- Re-fetch profile after init
        SELECT * INTO v_profile FROM public.user_profiles WHERE id = p_user_id FOR UPDATE;
    END IF;

    -- Determine billing cycle: if we're past the statement date, a new cycle started
    IF v_profile.stmt_statement_date IS NOT NULL AND CURRENT_DATE > v_profile.stmt_statement_date THEN
        -- Close old cycle and start new one
        -- (Daily accrual handles closing; just update statement tracking)
        v_billing_cycle_date := v_profile.stmt_statement_date;
    ELSE
        v_billing_cycle_date := COALESCE(v_profile.stmt_statement_date, CURRENT_DATE);
    END IF;

    -- Update credit_used on profile (just principal, no fee)
    UPDATE public.user_profiles
    SET credit_used = credit_used + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Log as individual line item transaction
    INSERT INTO public.credit_card_transactions (
        user_id, amount, transaction_type, description, context,
        metadata, billing_cycle_date
    ) VALUES (
        p_user_id, p_amount, 'purchase', p_description, p_context,
        p_metadata, v_billing_cycle_date
    );

    -- Update or create billing cycle record
    INSERT INTO public.credit_card_billing_cycles (
        user_id, cycle_start_date, statement_date, due_date,
        total_charges, closing_balance
    )
    VALUES (
        p_user_id,
        v_billing_cycle_date - INTERVAL '29 days',  -- approx cycle start
        v_profile.stmt_statement_date,
        v_profile.stmt_due_date,
        p_amount,
        (SELECT credit_used FROM public.user_profiles WHERE id = p_user_id)
    )
    ON CONFLICT DO NOTHING;  -- cycle record will be managed by closing function

    RETURN p_amount;
END;
$$;

-- ============================================================================
-- 7. REWRITE: try_pay_with_credit_card - Uses new draw_credit_internal
-- ============================================================================

DROP FUNCTION IF EXISTS public.try_pay_with_credit_card(UUID, BIGINT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.try_pay_with_credit_card(
    p_user_id UUID,
    p_amount BIGINT,
    p_context TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_allowed_contexts TEXT[] := ARRAY['shop_purchase', 'vehicle_purchase', 'insurance_payment', 'platform_fee', 'consumable_purchase'];
    v_forbidden_contexts TEXT[] := ARRAY['gift', 'transfer', 'rent', 'p2p_purchase', 'tip', 'payout'];
    v_charged BIGINT;
    v_description TEXT;
BEGIN
    -- Validate context
    IF p_context = ANY(v_forbidden_contexts) THEN
        RETURN FALSE;
    END IF;
    IF NOT (p_context = ANY(v_allowed_contexts)) THEN
        RETURN FALSE;
    END IF;

    BEGIN
        v_description := 'Credit Card: ' || COALESCE(p_context, 'purchase');
        v_charged := public.draw_credit_internal(
            p_user_id,
            p_amount,
            v_description,
            p_context,
            p_metadata
        );

        -- Log to coin_ledger (no coin change, just record the credit spend)
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, metadata)
        VALUES (
            p_user_id,
            0,
            'credit_spend',
            'credit_card',
            v_description,
            p_metadata || jsonb_build_object('principal', v_charged, 'context', p_context)
        );

        -- Credit score penalty for using credit (smaller than before — only -5)
        -- Real credit cards don't ding you for using them, only for carrying balance
        INSERT INTO public.credit_events (user_id, event_type, delta, event_key, metadata)
        VALUES (
            p_user_id,
            'credit_cc_purchase',
            -5,
            'cc_purchase:' || p_user_id::text || ':' || EXTRACT(EPOCH FROM NOW())::bigint,
            jsonb_build_object('principal', v_charged, 'context', p_context)
        );

        -- Recalculate score
        UPDATE public.user_credit uc
           SET score = GREATEST(0, LEAST(400 + e.net_delta, 800)),
               tier = public.get_credit_tier(GREATEST(0, LEAST(400 + e.net_delta, 800))),
               updated_at = NOW(),
               last_event_at = NOW()
         FROM (SELECT user_id, SUM(delta) AS net_delta
                 FROM public.credit_events
                WHERE user_id = p_user_id
                GROUP BY user_id) e
         WHERE uc.user_id = e.user_id;

        UPDATE public.user_profiles
           SET credit_score = (SELECT score FROM public.user_credit WHERE user_id = p_user_id)
         WHERE id = p_user_id;

        RETURN TRUE;
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END;
END;
$$;

-- ============================================================================
-- 8. NEW: Daily interest accrual function (run via pg_cron)
--    - Accrues daily interest on past-due balances
--    - Closes billing cycles that hit statement_date
--    - Applies late fees for missed minimum payments
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accrue_credit_card_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_daily_rate NUMERIC;
    v_interest BIGINT;
    v_new_due_date DATE;
    v_new_statement_date DATE;
    v_min_payment BIGINT;
    v_balance BIGINT;
BEGIN
    FOR v_user IN
        SELECT
            up.id,
            up.credit_used,
            up.credit_limit,
            up.credit_score,
            up.stmt_apr_percent,
            up.stmt_statement_date,
            up.stmt_due_date,
            up.stmt_balance,
            up.stmt_minimum_payment,
            up.stmt_past_due,
            up.stmt_late_fees_accrued,
            up.stmt_interest_accrued,
            up.stmt_last_accrual_date,
            up.stmt_on_time_payments,
            up.stmt_late_payments
        FROM public.user_profiles up
        WHERE up.credit_used > 0
    LOOP
        -- ── A. Close billing cycles where statement_date has passed ──
        IF v_user.stmt_statement_date IS NOT NULL
           AND CURRENT_DATE >= v_user.stmt_statement_date
           AND (v_user.stmt_last_accrual_date IS NULL OR v_user.stmt_last_accrual_date < v_user.stmt_statement_date)
        THEN
            -- Close this cycle: record the statement balance
            UPDATE public.user_profiles
            SET stmt_balance = credit_used,
                -- Calculate minimum payment: MAX(1% of balance, 25 coins)
                stmt_minimum_payment = GREATEST(CEIL(credit_used * 0.01), 25),
                -- Set previous cycle as past_due if minimum wasn't met
                stmt_past_due = CASE
                    WHEN credit_used > 0
                     AND stmt_minimum_payment > 0
                     AND stmt_balance > 0  -- had a previous balance
                    THEN TRUE
                    ELSE stmt_past_due
                END,
                updated_at = NOW()
            WHERE id = v_user.id;

            -- Set next cycle dates
            v_new_statement_date := CURRENT_DATE + INTERVAL '30 days';
            v_new_due_date := v_new_statement_date + INTERVAL '25 days';

            UPDATE public.user_profiles
            SET stmt_statement_date = v_new_statement_date,
                stmt_due_date = v_new_due_date,
                updated_at = NOW()
            WHERE id = v_user.id;
        END IF;

        -- ── B. Accrue daily interest on past-due balances ──
        IF v_user.stmt_past_due AND v_user.credit_used > 0 THEN
            -- Daily rate = APR / 365
            v_daily_rate := COALESCE(v_user.stmt_apr_percent, 25.0) / 365.0 / 100.0;
            v_interest := GREATEST(CEIL(v_user.credit_used * v_daily_rate), 1);  -- min 1 coin/day

            UPDATE public.user_profiles
            SET credit_used = credit_used + v_interest,
                stmt_interest_accrued = COALESCE(stmt_interest_accrued, 0) + v_interest,
                updated_at = NOW()
            WHERE id = v_user.id;

            -- Log interest charge as transaction
            INSERT INTO public.credit_card_transactions (
                user_id, amount, transaction_type, description,
                billing_cycle_date
            ) VALUES (
                v_user.id,
                v_interest,
                'interest',
                'Daily interest at ' || ROUND(v_user.stmt_apr_percent::numeric, 1) || '% APR',
                COALESCE(v_user.stmt_statement_date, CURRENT_DATE)
            );
        END IF;

        -- ── C. Apply late fees for past-due minimum payments ──
        IF v_user.stmt_due_date IS NOT NULL
           AND CURRENT_DATE > v_user.stmt_due_date
           AND v_user.stmt_past_due
        THEN
            -- Only apply late fee once per billing cycle
            -- Check if we already applied a late fee this cycle
            IF NOT EXISTS (
                SELECT 1 FROM public.credit_card_transactions
                WHERE user_id = v_user.id
                  AND transaction_type = 'late_fee'
                  AND billing_cycle_date = v_user.stmt_statement_date
            ) THEN
                UPDATE public.user_profiles
                SET credit_used = credit_used + 35,
                    stmt_late_fees_accrued = COALESCE(stmt_late_fees_accrued, 0) + 35,
                    stmt_late_payments = COALESCE(stmt_late_payments, 0) + 1,
                    updated_at = NOW()
                WHERE id = v_user.id;

                INSERT INTO public.credit_card_transactions (
                    user_id, amount, transaction_type, description,
                    billing_cycle_date
                ) VALUES (
                    v_user.id,
                    35,
                    'late_fee',
                    'Late fee - minimum payment not received by due date ' || v_user.stmt_due_date,
                    COALESCE(v_user.stmt_statement_date, CURRENT_DATE)
                );

                -- Credit score penalty for late payment (-30 points)
                INSERT INTO public.credit_events (user_id, event_type, delta, event_key, metadata)
                VALUES (
                    v_user.id,
                    'credit_late_payment',
                    -30,
                    'late:' || v_user.id::text || ':' || COALESCE(v_user.stmt_statement_date::text, CURRENT_DATE::text),
                    jsonb_build_object('late_fee', 35, 'due_date', v_user.stmt_due_date)
                );

                -- Recalculate score
                UPDATE public.user_credit uc
                   SET score = GREATEST(0, LEAST(400 + e.net_delta, 800)),
                       tier = public.get_credit_tier(GREATEST(0, LEAST(400 + e.net_delta, 800))),
                       updated_at = NOW(),
                       last_event_at = NOW()
                 FROM (SELECT user_id, SUM(delta) AS net_delta
                         FROM public.credit_events
                        WHERE user_id = v_user.id
                        GROUP BY user_id) e
                 WHERE uc.user_id = e.user_id;

                UPDATE public.user_profiles
                   SET credit_score = (SELECT score FROM public.user_credit WHERE user_id = v_user.id)
                 WHERE id = v_user.id;
            END IF;

            -- Move to next billing cycle if due date has passed
            UPDATE public.user_profiles
            SET stmt_statement_date = CURRENT_DATE + INTERVAL '30 days',
                stmt_due_date = CURRENT_DATE + INTERVAL '55 days',  -- 30 + 25 grace
                updated_at = NOW()
            WHERE id = v_user.id;
        END IF;

        -- ── D. Update APR based on current credit score ──
        UPDATE public.user_profiles
        SET stmt_apr_percent = public.get_cc_apr(COALESCE(credit_score, 400)),
            stmt_last_accrual_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE id = v_user.id;
    END LOOP;
END;
$$;

-- ============================================================================
-- 9. REWRITE: pay_credit_card - Works with billing cycles
-- ============================================================================

DROP FUNCTION IF EXISTS public.pay_credit_card(BIGINT);

CREATE OR REPLACE FUNCTION public.pay_credit_card(p_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_admin_id UUID := '8dff9f37-21b5-4b8e-adc2-b9286874be1a'::uuid;
    v_profile RECORD;
    v_pay_amount BIGINT;
    v_new_credit_used BIGINT;
    v_current_month TEXT;
    v_bill_payment_event_key TEXT;
    v_late_fee_credit BIGINT;
    v_on_time BOOLEAN;
    v_new_apr NUMERIC;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Amount must be positive');
    END IF;

    -- Run daily accrual first to ensure interest/fees are up to date
    PERFORM public.accrue_credit_card_daily();

    SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_user_id FOR UPDATE;

    IF v_profile.credit_used <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No credit debt to pay');
    END IF;

    -- Cap payment to total debt
    v_pay_amount := LEAST(p_amount, v_profile.credit_used);

    -- Check coin balance
    IF v_profile.troll_coins < v_pay_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient Troll Coins');
    END IF;

    -- Determine if this is an on-time payment (before or on due date)
    v_on_time := v_profile.stmt_due_date IS NULL OR CURRENT_DATE <= v_profile.stmt_due_date;

    -- Execute payment
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_pay_amount,
        credit_used = credit_used - v_pay_amount,
        last_credit_payment_at = NOW(),
        credit_default_warning_sent = FALSE,
        -- If fully paid off, clear past_due
        stmt_past_due = CASE
            WHEN (credit_used - v_pay_amount) <= 0 THEN FALSE
            ELSE stmt_past_due
        END,
        -- Track payment history
        stmt_total_payments_ytd = COALESCE(stmt_total_payments_ytd, 0) + v_pay_amount,
        stmt_on_time_payments = CASE WHEN v_on_time THEN COALESCE(stmt_on_time_payments, 0) + 1 ELSE stmt_on_time_payments END,
        stmt_late_payments = CASE WHEN NOT v_on_time THEN COALESCE(stmt_late_payments, 0) + 1 ELSE stmt_late_payments END,
        updated_at = NOW()
    WHERE id = v_user_id
    RETURNING credit_used, stmt_apr_percent INTO v_new_credit_used, v_new_apr;

    -- Log payment transaction
    INSERT INTO public.credit_card_transactions (
        user_id, amount, transaction_type, description,
        billing_cycle_date, is_paid, paid_at
    ) VALUES (
        v_user_id,
        v_pay_amount,
        'payment',
        'Credit Card Payment' || CASE WHEN NOT v_on_time THEN ' (Late)' ELSE '' END,
        COALESCE(v_profile.stmt_statement_date, CURRENT_DATE),
        TRUE,
        NOW()
    );

    -- Log to coin ledger
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, metadata)
    VALUES (
        v_user_id,
        -v_pay_amount,
        'repayment',
        'credit_card_repay',
        'Credit Card Payment',
        jsonb_build_object(
            'remaining_debt', v_new_credit_used,
            'was_on_time', v_on_time,
            'apr_at_payment', v_new_apr
        )
    );

    -- ── Credit Score Award ──
    -- On-time minimum payment: +25 points (once per billing cycle)
    -- Late payment: +5 points (reduced reward)
    -- Full payoff bonus: +10 extra points (one-time per cycle)
    v_current_month := TO_CHAR(NOW(), 'YYYY-MM');
    v_bill_payment_event_key := 'bill_pay:' || v_user_id::text || ':' || v_current_month;

    -- Check if already rewarded this billing cycle
    IF NOT EXISTS (
        SELECT 1 FROM public.credit_events
        WHERE event_key = v_bill_payment_event_key
    ) THEN
        INSERT INTO public.credit_events (user_id, event_type, delta, event_key, metadata)
        VALUES (
            v_user_id,
            CASE WHEN v_on_time THEN 'credit_bill_payment' ELSE 'credit_bill_payment_late' END,
            CASE WHEN v_on_time THEN 25 ELSE 5 END,
            v_bill_payment_event_key,
            jsonb_build_object(
                'paid_amount', v_pay_amount,
                'remaining_debt', v_new_credit_used,
                'was_on_time', v_on_time,
                'statement_month', v_current_month
            )
        );

        -- Full payoff bonus
        IF v_new_credit_used <= 0 THEN
            INSERT INTO public.credit_events (user_id, event_type, delta, event_key, metadata)
            VALUES (
                v_user_id,
                'credit_full_payoff',
                10,
                'payoff:' || v_user_id::text || ':' || v_current_month,
                jsonb_build_object('paid_amount', v_pay_amount)
            );
        END IF;

        -- Recalculate score from all events
        UPDATE public.user_credit uc
           SET score = GREATEST(0, LEAST(400 + e.net_delta, 800)),
               tier = public.get_credit_tier(GREATEST(0, LEAST(400 + e.net_delta, 800))),
               updated_at = NOW(),
               last_event_at = NOW()
         FROM (SELECT user_id, SUM(delta) AS net_delta
                 FROM public.credit_events
                WHERE user_id = v_user_id
                GROUP BY user_id) e
         WHERE uc.user_id = e.user_id;

        UPDATE public.user_profiles
           SET credit_score = (SELECT score FROM public.user_credit WHERE user_id = v_user_id)
         WHERE id = v_user_id;
    END IF;

    -- If debt fully cleared, reset billing cycle
    IF v_new_credit_used <= 0 THEN
        UPDATE public.user_profiles
        SET stmt_statement_date = NULL,
            stmt_due_date = NULL,
            stmt_balance = 0,
            stmt_minimum_payment = 0,
            stmt_past_due = FALSE,
            stmt_late_fees_accrued = 0,
            stmt_interest_accrued = 0,
            billing_month = NULL,
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'paid', v_pay_amount,
        'remaining_debt', v_new_credit_used,
        'was_on_time', v_on_time,
        'current_apr', v_new_apr,
        'debt_cleared', v_new_credit_used <= 0
    );
END;
$$;

-- ============================================================================
-- 10. REWRITE: Credit limit auto-adjustment based on payment history
-- ============================================================================

CREATE OR REPLACE FUNCTION public.adjust_credit_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_new_limit BIGINT;
BEGIN
    FOR v_user IN
        SELECT
            up.id,
            up.credit_limit,
            up.credit_score,
            up.stmt_on_time_payments,
            up.stmt_late_payments,
            up.stmt_total_payments_ytd
        FROM public.user_profiles up
        WHERE up.stmt_on_time_payments > 0 OR up.stmt_late_payments > 0
    LOOP
        -- Base limit increases for good payment history
        -- Every 3 on-time payments = +100 coin limit increase
        v_new_limit := 250 + (COALESCE(v_user.stmt_on_time_payments, 0) / 3) * 100;

        -- Cap based on credit score tier
        IF v_user.credit_score >= 800 THEN
            v_new_limit := LEAST(GREATEST(v_new_limit, 1000), 10000);
        ELSIF v_user.credit_score >= 700 THEN
            v_new_limit := LEAST(GREATEST(v_new_limit, 750), 5000);
        ELSIF v_user.credit_score >= 600 THEN
            v_new_limit := LEAST(GREATEST(v_new_limit, 500), 2500);
        ELSIF v_user.credit_score >= 450 THEN
            v_new_limit := LEAST(GREATEST(v_new_limit, 350), 1000);
        ELSIF v_user.credit_score >= 300 THEN
            v_new_limit := LEAST(GREATEST(v_new_limit, 250), 500);
        ELSE
            v_new_limit := 250;  -- floor
        END IF;

        -- Late payment penalty: reduce limit by 50 per late payment (min 250)
        v_new_limit := GREATEST(v_new_limit - (COALESCE(v_user.stmt_late_payments, 0) * 50), 250);

        UPDATE public.user_profiles
        SET credit_limit = v_new_limit,
            updated_at = NOW()
        WHERE id = v_user.id
          AND credit_limit != v_new_limit;  -- only update if changed
    END END LOOP;
END;
$$;

-- ============================================================================
-- 11. REWRITE: Repossession to use billing cycle dates
-- ============================================================================

DROP FUNCTION IF EXISTS public.check_credit_card_defaults();

CREATE OR REPLACE FUNCTION public.check_credit_card_defaults()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_admin_id UUID := '8dff9f37-21b5-4b8e-adc2-b9286874be1a'::uuid;
    v_property RECORD;
    v_vehicle RECORD;
    v_days_past_due INTEGER;
BEGIN
    -- Run daily accrual first
    PERFORM public.accrue_credit_card_daily();

    -- Find users who are past due on their credit card
    FOR v_user IN
        SELECT
            up.id,
            up.username,
            up.credit_used,
            up.credit_limit,
            up.stmt_due_date,
            up.stmt_past_due,
            up.stmt_late_payments,
            up.last_credit_payment_at
        FROM public.user_profiles up
        WHERE up.credit_used > 0
          AND up.stmt_past_due = TRUE
          AND (
              -- Past due by 7+ days after grace period (realistic: 1 week grace for repos)
              up.stmt_due_date IS NOT NULL
              AND up.stmt_due_date < CURRENT_DATE - INTERVAL '7 days'
          )
    LOOP
        v_days_past_due := CURRENT_DATE - v_user.stmt_due_date;

        -- Only repossess if 7+ days past due (bank tries to collect first)
        IF v_days_past_due < 7 THEN
            CONTINUE;
        END IF;

        -- First try: repossess a property
        SELECT * INTO v_property
        FROM public.properties
        WHERE owner_user_id = v_user.id
          AND is_repossessed = FALSE
        ORDER BY created_at ASC  -- oldest property first (like real bank repos)
        LIMIT 1;

        IF v_property.id IS NOT NULL THEN
            UPDATE public.properties
            SET is_repossessed = TRUE,
                repossessed_at = NOW(),
                repossessed_by = v_admin_id,
                repossession_reason = 'Credit card default - ' || v_user.credit_used || ' coins, ' || v_days_past_due || ' days past due'
            WHERE id = v_property.id;

            INSERT INTO public.admin_actions (
                admin_id, action_type, target_id, details
            ) VALUES (
                v_admin_id,
                'credit_card_repo',
                v_user.id,
                json_build_object(
                    'property_id', v_property.id,
                    'property_name', v_property.property_name,
                    'credit_debt', v_user.credit_used,
                    'days_past_due', v_days_past_due,
                    'reason', 'credit_card_default'
                )
            );

            CONTINUE;
        END IF;

        -- Second try: repossess a vehicle
        SELECT uv.*, vc.name as vehicle_name INTO v_vehicle
        FROM public.user_vehicles uv
        JOIN public.vehicles_catalog vc ON uv.catalog_id = vc.id
        WHERE uv.user_id = v_user.id
          AND uv.is_repossessed = FALSE
        ORDER BY uv.created_at ASC
        LIMIT 1;

        IF v_vehicle.id IS NOT NULL THEN
            UPDATE public.user_vehicles
            SET is_repossessed = TRUE,
                repossessed_at = NOW(),
                repossessed_by = v_admin_id,
                repossession_reason = 'Credit card default - ' || v_user.credit_used || ' coins, ' || v_days_past_due || ' days past due'
            WHERE id = v_vehicle.id;

            INSERT INTO public.admin_actions (
                admin_id, action_type, target_id, details
            ) VALUES (
                v_admin_id,
                'credit_card_repo',
                v_user.id,
                json_build_object(
                    'vehicle_id', v_vehicle.id,
                    'vehicle_name', v_vehicle.vehicle_name,
                    'credit_debt', v_user.credit_used,
                    'days_past_due', v_days_past_due,
                    'reason', 'credit_card_default'
                )
            );
        END IF;

        -- Credit score penalty for default
        INSERT INTO public.credit_events (user_id, event_type, delta, event_key, metadata)
        VALUES (
            v_user.id,
            'credit_default',
            -75,
            'default:' || v_user.id::text || ':' || CURRENT_DATE::text,
            jsonb_build_object('debt', v_user.credit_used, 'days_past_due', v_days_past_due)
        );

        UPDATE public.user_credit uc
           SET score = GREATEST(0, LEAST(400 + e.net_delta, 800)),
               tier = public.get_credit_tier(GREATEST(0, LEAST(400 + e.net_delta, 800))),
               updated_at = NOW(),
               last_event_at = NOW()
         FROM (SELECT user_id, SUM(delta) AS net_delta
                 FROM public.credit_events
                WHERE user_id = v_user.id
                GROUP BY user_id) e
         WHERE uc.user_id = e.user_id;

        UPDATE public.user_profiles
           SET credit_score = (SELECT score FROM public.user_credit WHERE user_id = v_user.id),
               -- Also reduce credit limit on default
               credit_limit = GREATEST(credit_limit - 100, 250),
               updated_at = NOW()
         WHERE id = v_user.id;
    END LOOP;
END;
$$;

-- ============================================================================
-- 12. MIGRATION: Convert existing credit_used balances to new system
-- ============================================================================

-- For users with existing credit debt, initialize billing cycle
DO $$
DECLARE
    v_user RECORD;
BEGIN
    FOR v_user IN
        SELECT id, credit_used, credit_score
        FROM public.user_profiles
        WHERE credit_used > 0 AND stmt_statement_date IS NULL
    LOOP
        -- Set up an "active" billing cycle
        UPDATE public.user_profiles
        SET stmt_statement_date = CURRENT_DATE + INTERVAL '30 days',
            stmt_due_date = CURRENT_DATE + INTERVAL '55 days',
            stmt_balance = credit_used,
            stmt_minimum_payment = GREATEST(CEIL(credit_used * 0.01), 25),
            stmt_apr_percent = public.get_cc_apr(COALESCE(v_user.credit_score, 400)),
            stmt_last_accrual_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE id = v_user.id;

        -- Migrate existing debt into a credit_card_transactions record
        INSERT INTO public.credit_card_transactions (
            user_id, amount, transaction_type, description,
            billing_cycle_date, created_at
        )
        VALUES (
            v_user.id,
            v_user.credit_used,
            'purchase',
            'Legacy balance (from old credit system)',
            CURRENT_DATE - INTERVAL '1 day',
            NOW()
        );
    END LOOP;
END $$;

-- ============================================================================
-- 13. GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.accrue_credit_card_daily() TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_credit_limits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_credit_card(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_credit_card(BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_credit_card_defaults() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cc_apr(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.init_credit_billing_cycle(UUID) TO authenticated;

-- ============================================================================
-- 14. CRON JOB: Run daily interest accrual at 00:00 UTC
-- ============================================================================

DO $$
BEGIN
    -- Unschedule if exists (idempotent)
    PERFORM cron.unschedule('credit-card-daily-accrual');

    PERFORM cron.schedule(
        'credit-card-daily-accrual',
        '0 0 * * *',  -- midnight UTC daily
        $$ SELECT public.accrue_credit_card_daily() $$
    );

    PERFORM cron.unschedule('credit-card-limit-adjustment');
    PERFORM cron.schedule(
        'credit-card-limit-adjustment',
        '0 1 1 * *',  -- 1st of each month at 01:00 UTC
        $$ SELECT public.adjust_credit_limits() $$
    );

    RAISE NOTICE '✅ Credit card cron jobs scheduled';
EXCEPTION
    WHEN undefined_function THEN
        RAISE NOTICE '⚠️ pg_cron not available, skip cron scheduling';
END $$;

-- ============================================================================
-- 15. COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.accrue_credit_card_daily() IS
'Daily function: closes billing cycles, accrues compound interest on past-due balances, applies late fees. Run via cron at midnight UTC.';

COMMENT ON FUNCTION public.adjust_credit_limits() IS
'Monthly function: increases/decreases credit limits based on on-time/late payment history. Run via cron on the 1st of each month.';

COMMENT ON FUNCTION public.check_credit_card_defaults() IS
'Weekly function: reposesses property/vehicle from users 7+ days past due on credit card. ';
