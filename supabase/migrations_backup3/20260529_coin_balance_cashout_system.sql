-- ============================================================
-- Coin Balance Cashout System - Core Functions & Updates
-- Date: 2026-05-29
-- Purpose:
--   1. Enable Friday cashout requests from wallet page
--   2. Use only cashout_coins (escrow) for payout eligibility
--   3. Track ID uploads with 30-day reupload exemption
--   4. Route requests through assistant review to admin
-- ============================================================

-- ============================================================
-- 1. Add user_tag column to payout_requests for admin visibility
-- ============================================================

ALTER TABLE public.payout_requests
ADD COLUMN IF NOT EXISTS user_tag TEXT,
ADD COLUMN IF NOT EXISTS provider_type TEXT,
ADD COLUMN IF NOT EXISTS provider_username TEXT,
ADD COLUMN IF NOT EXISTS forwarded_to_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS forwarded_to_admin_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_by_assistant_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_by_assistant_username TEXT,
ADD COLUMN IF NOT EXISTS assistant_reviewed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.payout_requests.user_tag IS 'User-entered tag/identifier for payout (e.g. CashApp $Cashtag, PayPal email)';
COMMENT ON COLUMN public.payout_requests.provider_type IS 'Payment provider chosen by user (cash_app, paypal, venmo, zelle, etc.)';
COMMENT ON COLUMN public.payout_requests.provider_username IS 'Username/email/tag entered by user for the chosen provider';
COMMENT ON COLUMN public.payout_requests.forwarded_to_admin IS 'Whether this request has been forwarded from assistant dashboard to admin';

-- ============================================================
-- 2. Create weekly_working_earnings table to track role earnings
-- ============================================================

CREATE TABLE IF NOT EXISTS public.weekly_working_earnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_key TEXT NOT NULL,
    role_label TEXT NOT NULL,
    earning_type TEXT NOT NULL DEFAULT 'weekly' CHECK (earning_type IN ('weekly', 'case', 'bonus')),
    source_type TEXT,
    source_id UUID,
    amount_coins BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'cashed_out', 'skipped')),
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    converted_to_balance_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_working_earnings_user_id ON public.weekly_working_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_working_earnings_week ON public.weekly_working_earnings(week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_weekly_working_earnings_status ON public.weekly_working_earnings(status);

-- Enable RLS
ALTER TABLE public.weekly_working_earnings ENABLE ROW LEVEL SECURITY;

-- Users can view their own earnings
CREATE POLICY "Users can view their own working earnings"
    ON public.weekly_working_earnings FOR SELECT
    USING (user_id = auth.uid());

-- Admins can manage all earnings
CREATE POLICY "Admins can manage all working earnings"
    ON public.weekly_working_earnings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
              AND (role = 'admin' OR is_admin = true)
        )
    );

-- ============================================================
-- 3. Create function to convert working earnings to troll_coins (Thursday)
-- ============================================================

CREATE OR REPLACE FUNCTION public.convert_weekly_earnings_to_balance(
    p_week_start DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_week_start DATE;
    v_week_end DATE;
    v_total_converted BIGINT := 0;
    v_users_converted INT := 0;
    v_earning RECORD;
    v_user RECORD;
BEGIN
    -- Default to current week's Monday if not provided
    v_week_start := COALESCE(p_week_start, date_trunc('week', CURRENT_DATE)::date);
    v_week_end := v_week_start + INTERVAL '6 days';

    -- Process all pending working earnings for the week
    FOR v_earning IN
        SELECT * FROM public.weekly_working_earnings
        WHERE status = 'pending'
          AND week_start = v_week_start
        ORDER BY created_at ASC
    LOOP
        -- Skip trollers - they don't get coin earnings
        SELECT * INTO v_user
        FROM public.user_profiles
        WHERE id = v_earning.user_id;

        IF NOT FOUND THEN
            CONTINUE;
        END IF;

        -- Skip if user is a troller (they are just friendly trolls, no coin perks)
        IF v_user.role = 'troller' OR v_user.is_troller = TRUE OR v_user.troll_role = 'troller' THEN
            UPDATE public.weekly_working_earnings
            SET status = 'skipped',
                updated_at = NOW()
            WHERE id = v_earning.id;
            CONTINUE;
        END IF;

        -- Add coins to user's troll_coins balance
        UPDATE public.user_profiles
        SET troll_coins = COALESCE(troll_coins, 0) + v_earning.amount_coins,
            updated_at = NOW()
        WHERE id = v_earning.user_id;

        -- Mark earning as converted
        UPDATE public.weekly_working_earnings
        SET status = 'converted',
            converted_to_balance_at = NOW(),
            updated_at = NOW()
        WHERE id = v_earning.id;

        v_total_converted := v_total_converted + v_earning.amount_coins;
        v_users_converted := v_users_converted + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'week_start', v_week_start,
        'week_end', v_week_end,
        'total_coins_converted', v_total_converted,
        'users_converted', v_users_converted
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_weekly_earnings_to_balance(DATE) TO authenticated;

-- ============================================================
-- 4. Create function to submit a role working earning event
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_working_earning(
    p_user_id UUID,
    p_role_key TEXT,
    p_role_label TEXT,
    p_earning_type TEXT,
    p_source_type TEXT DEFAULT NULL,
    p_source_id UUID DEFAULT NULL,
    p_amount_coins BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_week_start DATE;
    v_week_end DATE;
    v_earning_id UUID;
BEGIN
    -- Calculate current week boundaries (Monday-Sunday)
    v_week_start := date_trunc('week', CURRENT_DATE)::date;
    v_week_end := v_week_start + INTERVAL '6 days';

    -- Insert the earning record
    INSERT INTO public.weekly_working_earnings (
        user_id,
        role_key,
        role_label,
        earning_type,
        source_type,
        source_id,
        amount_coins,
        status,
        week_start,
        week_end
    ) VALUES (
        p_user_id,
        p_role_key,
        p_role_label,
        p_earning_type,
        p_source_type,
        p_source_id,
        p_amount_coins,
        'pending',
        v_week_start,
        v_week_end
    ) RETURNING id INTO v_earning_id;

    RETURN jsonb_build_object(
        'success', true,
        'earning_id', v_earning_id,
        'amount_coins', p_amount_coins,
        'week_start', v_week_start,
        'week_end', v_week_end
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_working_earning(UUID, TEXT, TEXT, TEXT, TEXT, UUID, BIGINT) TO authenticated;

-- ============================================================
-- 5. Create function for Friday cashout request from wallet
--    This creates a payout_request that flows to assistant dashboards then admin
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_friday_cashout(
    p_user_id UUID,
    p_coins_to_redeem BIGINT,
    p_provider_type TEXT,
    p_provider_username TEXT,
    p_user_tag TEXT DEFAULT NULL,
    p_id_verification_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_available_coins BIGINT;
    v_tier RECORD;
    v_cash_amount NUMERIC(12,2);
    v_fee_amount NUMERIC(12,2) := 0;
    v_net_amount NUMERIC(12,2);
    v_payout_id UUID;
    v_last_approved_at TIMESTAMPTZ;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Get user profile
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Block trollers from cashout (they don't earn coins)
    IF v_user.role = 'troller' OR v_user.is_troller = TRUE OR v_user.troll_role = 'troller' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trollers do not earn coins and cannot request cashouts.');
    END IF;

    -- Check weekend restriction (cashouts only on Fri/Sat/Sun)
    IF NOT (EXTRACT(ISODOW FROM v_now AT TIME ZONE 'America/Denver') IN (5, 6, 7)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cashout requests are only available on Fridays, Saturdays, and Sundays.');
    END IF;

    -- Check payout time window (1:00 AM - 7:00 PM Mountain Time)
    IF NOT (EXTRACT(HOUR FROM v_now AT TIME ZONE 'America/Denver') BETWEEN 1 AND 18) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cashout requests are only accepted between 1:00 AM and 7:00 PM Mountain Time on weekends.');
    END IF;

    -- Require ID upload for first cashout or when last approved payout is older than 30 days
    IF p_id_verification_url IS NULL THEN
        SELECT created_at INTO v_last_approved_at
        FROM public.payout_requests
        WHERE user_id = p_user_id
          AND status IN ('approved', 'completed')
        ORDER BY created_at DESC
        LIMIT 1;

        IF NOT FOUND OR v_last_approved_at < (v_now - INTERVAL '30 days') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Please upload a government-issued ID. Once you have an approved payout, you may skip ID upload for 30 days.'
            );
        END IF;
    END IF;

    -- Check available cashout_coins balance (only coins in cashout escrow are eligible for payout)
    v_available_coins := COALESCE(v_user.cashout_coins, 0) - COALESCE(v_user.cashout_reserved_coins, 0);

    IF v_available_coins < p_coins_to_redeem THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient cashout coin balance. Please move eligible coins to Cashout Escrow first.',
            'available_coins', v_available_coins,
            'requested', p_coins_to_redeem
        );
    END IF;

    -- Find matching cashout tier
    SELECT * INTO v_tier
    FROM public.cashout_tiers
    WHERE coin_amount <= p_coins_to_redeem
      AND is_active = TRUE
    ORDER BY coin_amount DESC
    LIMIT 1;

    IF NOT FOUND THEN
        -- Use the minimum tier
        SELECT * INTO v_tier
        FROM public.cashout_tiers
        WHERE is_active = TRUE
        ORDER BY coin_amount ASC
        LIMIT 1;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'No active cashout tiers configured.');
        END IF;
    END IF;

    v_cash_amount := v_tier.cash_amount;
    v_fee_amount := ROUND(p_coins_to_redeem * 0.029, 0);
    v_net_amount := v_cash_amount;

    -- Reserve the coins in cashout escrow
    UPDATE public.user_profiles
    SET cashout_reserved_coins = COALESCE(cashout_reserved_coins, 0) + p_coins_to_redeem,
        updated_at = v_now
    WHERE id = p_user_id;

    -- Create payout request
    INSERT INTO public.payout_requests (
        user_id,
        coin_amount,
        cash_amount,
        net_amount,
        status,
        provider_type,
        provider_username,
        user_tag,
        id_verification_url,
        id_verification_uploaded_at,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_coins_to_redeem,
        v_cash_amount,
        v_net_amount,
        'pending',
        p_provider_type,
        p_provider_username,
        p_user_tag,
        p_id_verification_url,
        CASE WHEN p_id_verification_url IS NOT NULL THEN v_now ELSE NULL END,
        v_now,
        v_now
    ) RETURNING id INTO v_payout_id;

    -- Create coin transaction record
    INSERT INTO public.coin_transactions (
        user_id,
        type,
        amount,
        coin_type,
        description,
        balance_after,
        metadata,
        created_at
    ) VALUES (
        p_user_id,
        'cashout_request',
        -p_coins_to_redeem,
        'cashout_coins',
        'Friday cashout request submitted (deducted from cashout escrow)',
        v_user.cashout_coins - p_coins_to_redeem,
        jsonb_build_object(
            'payout_request_id', v_payout_id,
            'provider_type', p_provider_type,
            'provider_username', p_provider_username,
            'user_tag', p_user_tag,
            'cash_amount', v_cash_amount
        ),
        v_now
    );

    -- Deduct from cashout_coins (users move earned coins into this escrow)
    UPDATE public.user_profiles
    SET cashout_coins = GREATEST(0, COALESCE(cashout_coins, 0) - p_coins_to_redeem),
        updated_at = v_now
    WHERE id = p_user_id;

    -- Send notification to user
    PERFORM public.create_notification(
        p_user_id,
        'cashout_submitted',
        'Cashout Request Submitted',
        format('Your cashout request for %s coins ($%s) has been submitted. It will be reviewed by the CEO Assistant and Noah Assistant before being sent to the admin for processing.', p_coins_to_redeem, v_cash_amount),
        jsonb_build_object(
            'payout_id', v_payout_id,
            'cash_amount', v_cash_amount,
            'coins', p_coins_to_redeem
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'payout_request_id', v_payout_id,
        'cash_amount', v_cash_amount,
        'coins_redeemed', p_coins_to_redeem,
        'message', 'Cashout request submitted. It will be reviewed by CEO Assistant and Noah Assistant before admin processing.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_friday_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 6. Create function for assistant to forward payout to admin
-- ============================================================

CREATE OR REPLACE FUNCTION public.forward_payout_to_admin(
    p_payout_id UUID,
    p_assistant_id UUID,
    p_assistant_username TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payout RECORD;
BEGIN
    -- Get the payout request
    SELECT * INTO v_payout
    FROM public.payout_requests
    WHERE id = p_payout_id
      AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payout request not found or not in pending status.');
    END IF;

    -- Update payout as forwarded to admin
    UPDATE public.payout_requests
    SET forwarded_to_admin = TRUE,
        forwarded_to_admin_at = NOW(),
        reviewed_by_assistant_id = p_assistant_id,
        reviewed_by_assistant_username = p_assistant_username,
        assistant_reviewed_at = NOW(),
        status = 'reviewed',
        updated_at = NOW()
    WHERE id = p_payout_id;

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', p_payout_id,
        'message', 'Payout request forwarded to admin Operations & Control Deck.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.forward_payout_to_admin(UUID, UUID, TEXT) TO authenticated;

-- ============================================================
-- 7. Create function for admin to process/approve payout
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_process_payout(
    p_payout_id UUID,
    p_admin_id UUID,
    p_action TEXT,  -- 'approve', 'pay', 'reject'
    p_payment_reference TEXT DEFAULT NULL,
    p_admin_notes TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payout RECORD;
    v_user RECORD;
BEGIN
    -- Get the payout request
    SELECT * INTO v_payout
    FROM public.payout_requests
    WHERE id = p_payout_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payout request not found.');
    END IF;

    -- Get user profile
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = v_payout.user_id;

    IF p_action = 'approve' THEN
        IF v_payout.status NOT IN ('pending', 'reviewed') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Payout is not in a reviewable status.');
        END IF;

        UPDATE public.payout_requests
        SET status = 'approved',
            approved_by = p_admin_id::text,
            approved_at = NOW(),
            admin_id = p_admin_id,
            notes = COALESCE(p_admin_notes, notes),
            updated_at = NOW()
        WHERE id = p_payout_id;

        -- Notify user
        PERFORM public.create_notification(
            v_payout.user_id,
            'cashout_approved',
            'Cashout Approved',
            format('Your cashout request for $%s has been approved and is being processed.', v_payout.cash_amount),
            jsonb_build_object('payout_id', p_payout_id)
        );

        RETURN jsonb_build_object('success', true, 'message', 'Payout approved.');

    ELSIF p_action = 'pay' THEN
        IF v_payout.status != 'approved' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Payout must be approved before marking as paid.');
        END IF;

        UPDATE public.payout_requests
        SET status = 'paid',
            paid_at = NOW(),
            processed_at = NOW(),
            processed_by = p_admin_id,
            payment_reference = COALESCE(p_payment_reference, payment_reference),
            notes = COALESCE(p_admin_notes, notes),
            updated_at = NOW()
        WHERE id = p_payout_id;

        -- Release reserved cashout coins
        UPDATE public.user_profiles
        SET cashout_reserved_coins = GREATEST(0, COALESCE(cashout_reserved_coins, 0) - v_payout.coin_amount),
            updated_at = NOW()
        WHERE id = v_payout.user_id;

        -- Notify user
        PERFORM public.create_notification(
            v_payout.user_id,
            'cashout_paid',
            'Cashout Paid! 💰',
            format('Your cashout of $%s has been sent via %s to %s.', v_payout.cash_amount, v_payout.provider_type, v_payout.provider_username),
            jsonb_build_object('payout_id', p_payout_id)
        );

        RETURN jsonb_build_object('success', true, 'message', 'Payout marked as paid.');

    ELSIF p_action = 'reject' THEN
        IF v_payout.status NOT IN ('pending', 'reviewed', 'approved') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Cannot reject payout in current status.');
        END IF;

        -- Return reserved coins to cashout escrow
        UPDATE public.user_profiles
        SET cashout_reserved_coins = GREATEST(0, COALESCE(cashout_reserved_coins, 0) - v_payout.coin_amount),
            cashout_coins = COALESCE(cashout_coins, 0) + v_payout.coin_amount,
            updated_at = NOW()
        WHERE id = v_payout.user_id;

        UPDATE public.payout_requests
        SET status = 'rejected',
            rejection_reason = COALESCE(p_rejection_reason, 'Rejected by admin.'),
            processed_at = NOW(),
            processed_by = p_admin_id,
            notes = COALESCE(p_admin_notes, notes),
            updated_at = NOW()
        WHERE id = p_payout_id;

        -- Notify user
        PERFORM public.create_notification(
            v_payout.user_id,
            'cashout_rejected',
            'Cashout Rejected',
            format('Your cashout request was rejected. Reason: %s. Your coins have been returned to your balance.', COALESCE(p_rejection_reason, 'No reason provided.')),
            jsonb_build_object('payout_id', p_payout_id)
        );

        RETURN jsonb_build_object('success', true, 'message', 'Payout rejected and coins returned.');

    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action. Use approve, pay, or reject.');
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_process_payout(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 8. Grant permissions on new tables
-- ============================================================

GRANT SELECT ON public.weekly_working_earnings TO authenticated;
GRANT INSERT ON public.weekly_working_earnings TO authenticated;
GRANT UPDATE ON public.weekly_working_earnings TO authenticated;

-- ============================================================
-- 9. Update existing cashout_tiers if needed (ensure they exist)
-- ============================================================

INSERT INTO public.cashout_tiers (coin_amount, cash_amount, currency, is_active, created_at, updated_at)
VALUES
    (7500, 25, 'USD', true, NOW(), NOW()),
    (15000, 50, 'USD', true, NOW(), NOW()),
    (30000, 150, 'USD', true, NOW(), NOW()),
    (60000, 300, 'USD', true, NOW(), NOW()),
    (120000, 600, 'USD', true, NOW(), NOW()),
    (200000, 1000, 'USD', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. Create function for assistant to review user coin history
--     (fraud check) - returns full coin transaction history
-- ============================================================

CREATE OR REPLACE FUNCTION public.assistant_review_user_coins(
    p_user_id UUID,
    p_week_start DATE DEFAULT NULL,
    p_week_end DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_week_start DATE;
    v_week_end DATE;
    v_user_info JSONB;
BEGIN
    v_week_start := COALESCE(p_week_start, date_trunc('week', CURRENT_DATE)::date);
    v_week_end := COALESCE(p_week_end, v_week_start + INTERVAL '6 days');

    -- Get user profile info
    SELECT jsonb_build_object(
        'user_id', up.id,
        'username', up.username,
        'display_name', up.display_name,
        'role', up.role,
        'troll_coins', up.troll_coins,
        'reserved_troll_coins', up.reserved_troll_coins,
        'current_balance', COALESCE(up.troll_coins, 0) - COALESCE(up.reserved_troll_coins, 0)
    ) INTO v_user_info
    FROM public.user_profiles up
    WHERE up.id = p_user_id;

    IF v_user_info IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'user', v_user_info,
        'week_start', v_week_start,
        'week_end', v_week_end,
        'working_earnings', (
            SELECT COALESCE(jsonb_agg(e.* ORDER BY e.created_at DESC), '[]'::jsonb)
            FROM public.weekly_working_earnings e
            WHERE e.user_id = p_user_id
              AND e.week_start >= v_week_start
              AND e.week_end <= v_week_end
        ),
        'coin_transactions', (
            SELECT COALESCE(jsonb_agg(t.* ORDER BY t.created_at DESC), '[]'::jsonb)
            FROM public.coin_transactions t
            WHERE t.user_id = p_user_id
              AND t.created_at >= v_week_start
              AND t.created_at <= (v_week_end + INTERVAL '1 day')
        ),
        'total_earned_this_week', (
            SELECT COALESCE(SUM(amount_coins), 0)
            FROM public.weekly_working_earnings
            WHERE user_id = p_user_id
              AND week_start >= v_week_start
              AND week_end <= v_week_end
              AND status IN ('pending', 'converted')
        ),
        'total_cashed_out_this_week', (
            SELECT COALESCE(SUM(coin_amount), 0)
            FROM public.payout_requests
            WHERE user_id = p_user_id
              AND created_at >= v_week_start
              AND created_at <= (v_week_end + INTERVAL '1 day')
              AND status NOT IN ('rejected')
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assistant_review_user_coins(UUID, DATE, DATE) TO authenticated;

-- ============================================================
-- 11. Create function for assistant to forward reviewed payouts
--     to admin as an official batch
-- ============================================================

CREATE OR REPLACE FUNCTION public.assistant_forward_payout_batch(
    p_payout_ids UUID[],
    p_assistant_id UUID,
    p_assistant_username TEXT,
    p_batch_label TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_batch_id UUID;
    v_week_end DATE;
    v_total_coins BIGINT := 0;
    v_total_cash NUMERIC(12,2) := 0;
    v_request_count INT := 0;
BEGIN
    -- Validate all payouts are in pending status
    IF EXISTS (
        SELECT 1 FROM public.payout_requests
        WHERE id = ANY(p_payout_ids)
          AND status != 'pending'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'All payouts must be in pending status. One or more are not pending.'
        );
    END IF;

    -- Calculate totals
    SELECT COALESCE(SUM(coin_amount), 0), COALESCE(SUM(cash_amount), 0), COUNT(*)
    INTO v_total_coins, v_total_cash, v_request_count
    FROM public.payout_requests
    WHERE id = ANY(p_payout_ids);

    -- Determine week end (Friday)
    v_week_end := date_trunc('week', CURRENT_DATE)::date + INTERVAL '4 days';

    -- Create the batch
    INSERT INTO public.payout_batches (
        week_end,
        payout_date,
        status,
        total_requests,
        total_usd,
        created_at
    ) VALUES (
        v_week_end,
        CURRENT_DATE,
        'open',
        v_request_count,
        v_total_cash,
        NOW()
    ) RETURNING id INTO v_batch_id;

    -- Update all payouts to link to batch and mark as forwarded
    UPDATE public.payout_requests
    SET batch_id = v_batch_id,
        forwarded_to_admin = TRUE,
        forwarded_to_admin_at = NOW(),
        reviewed_by_assistant_id = p_assistant_id,
        reviewed_by_assistant_username = p_assistant_username,
        assistant_reviewed_at = NOW(),
        status = 'reviewed',
        updated_at = NOW()
    WHERE id = ANY(p_payout_ids);

    RETURN jsonb_build_object(
        'success', true,
        'batch_id', v_batch_id,
        'batch_label', COALESCE(p_batch_label, 'Batch ' || v_batch_id::text),
        'total_requests', v_request_count,
        'total_coins', v_total_coins,
        'total_cash', v_total_cash,
        'week_end', v_week_end,
        'message', format('Payout batch created with %s requests totaling $%s. Forwarded to admin Operations & Control Deck.', v_request_count, v_total_cash)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assistant_forward_payout_batch(UUID[], UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 12. Create function to get pending payouts for assistant review
--     (only those not yet forwarded to admin)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_pending_payouts_for_review()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'success', true,
        'payouts', COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', p.id,
                    'user_id', p.user_id,
                    'username', up.username,
                    'display_name', up.display_name,
                    'role', up.role,
                    'coin_amount', p.coin_amount,
                    'cash_amount', p.cash_amount,
                    'net_amount', p.net_amount,
                    'provider_type', p.provider_type,
                    'provider_username', p.provider_username,
                    'user_tag', p.user_tag,
                    'status', p.status,
                    'created_at', p.created_at,
                    'troll_coins_balance', COALESCE(up.troll_coins, 0),
                    'total_earned_this_week', (
                        SELECT COALESCE(SUM(w.amount_coins), 0)
                        FROM public.weekly_working_earnings w
                        WHERE w.user_id = p.user_id
                          AND w.status IN ('pending', 'converted')
                          AND w.week_start = date_trunc('week', CURRENT_DATE)::date
                    )
                ) ORDER BY p.created_at ASC
            ),
            '[]'::jsonb
        ),
        'total_pending', COUNT(p.id),
        'total_coins', COALESCE(SUM(p.coin_amount), 0),
        'total_cash', COALESCE(SUM(p.cash_amount), 0)
    ) INTO v_result
    FROM public.payout_requests p
    JOIN public.user_profiles up ON up.id = p.user_id
    WHERE p.status = 'pending'
      AND p.forwarded_to_admin = FALSE;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_payouts_for_review() TO authenticated;
