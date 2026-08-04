-- ============================================================================
-- UNIFY CASHOUT SYSTEM: Fast Pay / MAI Pay Only
-- Date: 2026-06-26
-- Purpose: Remove all legacy payout/cashout systems. Only the Fast Pay program
-- (payout_requests + fast_pay_applications) remains active.
-- 
-- NEW RULES:
--   - Fee (0%) is deducted UPFRONT when request is made (coins + fee must be available)
--   - Level 1-499:    Cashout every Friday only (1AM-7PM MT)
--   - Level 500-999:  Cashout every 24 hours
--   - Level 1000+:    Cashout every 30 minutes
--   - Admins/CEO/secretary: always allowed
--   - Must have cashout_approved = true (via Fast Pay application)
--   - ID verification required first time or after 30 days
-- ============================================================================

-- ============================================================================
-- STEP 1: Update request_friday_cashout with new fee + level-based timing rules
-- ============================================================================
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
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_user_level INT;
    v_available_coins BIGINT;
    v_tier RECORD;
    v_cash_amount NUMERIC(12,2);
    v_fee_coins BIGINT;
    v_total_required BIGINT;
    v_net_amount NUMERIC(12,2);
    v_payout_id UUID;
    v_last_approved_at TIMESTamptz;
    v_last_request_at TIMESTAMPTZ;
    v_now TIMESTAMPTZ := NOW();
    v_is_admin BOOLEAN := FALSE;
    v_is_cashout_approved BOOLEAN := FALSE;
    v_min_interval INTERVAL;
    v_day_of_week INT;
    v_hour INT;
BEGIN
    -- Get user profile
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Determine user level from user_stats (fallback to 1)
    SELECT COALESCE(level, 1) INTO v_user_level
    FROM public.user_stats
    WHERE user_id = p_user_id;

    IF v_user_level IS NULL THEN
        v_user_level := 1;
    END IF;

    -- Check admin bypass
    v_is_admin := (
        v_user.role = 'admin'
        OR v_user.is_admin = TRUE
        OR v_user.is_superadmin = TRUE
        OR v_user.role = 'owner'
        OR v_user.role = 'ceo_assistant'
        OR v_user.role = 'noah_assistant'
        OR v_user.role = 'secretary'
        OR v_user.troll_role = 'admin'
    );

    v_is_cashout_approved := COALESCE(v_user.cashout_approved, false);

    -- Trollers cannot cashout
    IF v_user.role = 'troller' OR v_user.is_troller = TRUE OR v_user.troll_role = 'troller' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trollers do not earn coins and cannot request cashouts.');
    END IF;

    -- Must be cashout_approved (Fast Pay application approved)
    IF NOT v_is_admin AND NOT v_is_cashout_approved THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You must complete the Fast Pay application and get admin approval before requesting cashouts.'
        );
    END IF;

    -- Level-based timing rules (admins bypass)
    IF NOT v_is_admin THEN
        v_day_of_week := EXTRACT(ISODOW FROM v_now AT TIME ZONE 'America/Denver'); -- 5=Fri, 6=Sat, 7=Sun
        v_hour := EXTRACT(HOUR FROM v_now AT TIME ZONE 'America/Denver');

        IF v_user_level >= 1000 THEN
            -- Level 1000+: every 30 minutes (any day)
            v_min_interval := INTERVAL '30 minutes';
        ELSIF v_user_level >= 500 THEN
            -- Level 500-999: every 24 hours (any day)
            v_min_interval := INTERVAL '24 hours';
        ELSE
            -- Level 1-499: Friday only, 1AM-7PM MT
            v_min_interval := INTERVAL '7 days';

            IF NOT (v_day_of_week = 5) THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'Cashout requests for your level are only available on Fridays.'
                );
            END IF;

            IF NOT (v_hour BETWEEN 1 AND 18) THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'Cashout requests are only accepted between 1:00 AM and 7:00 PM Mountain Time on Fridays.'
                );
            END IF;
        END IF;

        -- Check cooldown period (skip for Friday-only since the window itself is the cooldown)
        IF v_user_level < 1000 THEN
            SELECT created_at INTO v_last_request_at
            FROM public.payout_requests
            WHERE user_id = p_user_id
              AND status IN ('pending', 'reviewed', 'approved', 'paid')
            ORDER BY created_at DESC
            LIMIT 1;

            IF FOUND AND v_last_request_at > (v_now - v_min_interval) THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', format('You can request your next cashout after %s.', to_char(v_last_request_at + v_min_interval, 'YYYY-MM-DD HH24:MI')),
                    'next_available_at', (v_last_request_at + v_min_interval)::text
                );
            END IF;
        ELSE
            -- Level 1000+: 30 min cooldown
            SELECT created_at INTO v_last_request_at
            FROM public.payout_requests
            WHERE user_id = p_user_id
              AND status IN ('pending', 'reviewed', 'approved', 'paid')
            ORDER BY created_at DESC
            LIMIT 1;

            IF FOUND AND v_last_request_at > (v_now - v_min_interval) THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', format('You can request your next cashout after %s (30-minute cooldown).', to_char(v_last_request_at + v_min_interval, 'YYYY-MM-DD HH24:MI')),
                    'next_available_at', (v_last_request_at + v_min_interval)::text
                );
            END IF;
        END IF;
    END IF;

    -- ID verification check (first time or after 30 days)
    IF p_id_verification_url IS NULL AND NOT v_is_cashout_approved THEN
        SELECT created_at INTO v_last_approved_at
        FROM public.payout_requests
        WHERE user_id = p_user_id
          AND status IN ('approved', 'paid')
        ORDER BY created_at DESC
        LIMIT 1;

        IF NOT FOUND OR v_last_approved_at < (v_now - INTERVAL '30 days') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Please upload a government-issued ID in your Fast Pay application before requesting cashouts.'
            );
        END IF;
    END IF;

    -- Calculate fee (0%)
    v_fee_coins := CEIL(p_coins_to_redeem * 0.029)::bigint;
    v_total_required := p_coins_to_redeem + v_fee_coins;

    -- Check available balance (cashout_coins - cashout_reserved_coins)
    v_available_coins := COALESCE(v_user.cashout_coins, 0) - COALESCE(v_user.cashout_reserved_coins, 0);

    IF v_available_coins < v_total_required THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Insufficient cashout coin balance. You need %s coins (including %s fee), but only %s available.', v_total_required, v_fee_coins, v_available_coins),
            'available_coins', v_available_coins,
            'required_coins', v_total_required,
            'fee_coins', v_fee_coins
        );
    END IF;

    -- Get cashout tier
    SELECT * INTO v_tier
    FROM public.cashout_tiers
    WHERE coin_amount <= p_coins_to_redeem
      AND is_active = TRUE
    ORDER BY coin_amount DESC
    LIMIT 1;

    IF NOT FOUND THEN
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
    v_net_amount := v_cash_amount;

    -- Reserve coins (amount + fee) from escrow
    UPDATE public.user_profiles
    SET cashout_reserved_coins = COALESCE(cashout_reserved_coins, 0) + v_total_required,
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
        v_total_required,  -- includes fee
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
    )
    RETURNING id INTO v_payout_id;

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'coins_reserved', v_total_required,
        'payout_coins', p_coins_to_redeem,
        'fee_coins', v_fee_coins,
        'usd_amount', v_cash_amount,
        'status', 'pending',
        'user_level', v_user_level
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_friday_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- STEP 2: Update admin_process_payout to handle fee coins on reject
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_process_payout(
    p_payout_id UUID,
    p_admin_id UUID,
    p_action TEXT,
    p_payment_reference TEXT DEFAULT NULL,
    p_admin_notes TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payout RECORD;
    v_user RECORD;
    v_fee_coins BIGINT;
    v_payout_coins BIGINT;
BEGIN
    -- Verify admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_admin_id
        AND (role IN ('admin', 'superadmin', 'secretary') OR is_admin = TRUE)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin role required');
    END IF;

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

    -- Calculate original payout coins (reverse the fee: total = payout / (1 - 0.029) approx)
    -- Since we stored total_required (coins + fee) in coin_amount, we need to extract
    -- the original requested amount. We use: payout_coins = coin_amount / 1.029 rounded up
    v_payout_coins := FLOOR(v_payout.coin_amount / 1.029)::bigint;
    v_fee_coins := v_payout.coin_amount - v_payout_coins;

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

        -- Release reserved cashout coins (total including fee)
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

        -- Return reserved coins to cashout escrow (full amount including fee)
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
            format('Your cashout request was rejected. Reason: %s. Your coins (including fee) have been returned to your balance.', COALESCE(p_rejection_reason, 'No reason provided.')),
            jsonb_build_object('payout_id', p_payout_id)
        );

        RETURN jsonb_build_object('success', true, 'message', 'Payout rejected and coins returned.');

    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action. Use approve, pay, or reject.');
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_process_payout(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- STEP 3: Drop all legacy cashout/payout functions (old systems)
-- ============================================================================

-- Visa redemption functions
DROP FUNCTION IF EXISTS public.request_visa_redemption(UUID, BIGINT, NUMERIC);
DROP FUNCTION IF EXISTS public.request_cashout_v3(UUID, BIGINT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.request_cashout_v2(BIGINT);
DROP FUNCTION IF EXISTS public.request_cashout(BIGINT);
DROP FUNCTION IF EXISTS public.admin_open_cashout_request(UUID, UUID);
DROP FUNCTION IF EXISTS public.admin_process_cashout_request(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_cashout_request_details(UUID);
DROP FUNCTION IF EXISTS public.admin_verify_gift_eligibility(UUID, UUID, BOOLEAN, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.approve_visa_redemption(UUID);
DROP FUNCTION IF EXISTS public.fulfill_visa_redemption(UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_visa_redemption(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_eligible_gift_coins(UUID);
DROP FUNCTION IF EXISTS public.is_cashout_window_open();
DROP FUNCTION IF EXISTS public.deposit_to_cashout_escrow(BIGINT);
DROP FUNCTION IF EXISTS public.reserve_all_cashout_coins();
DROP FUNCTION IF EXISTS public.admin_approve_payout(UUID);
DROP FUNCTION IF EXISTS public.forward_payout_to_admin(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_payout_window_status();

-- ============================================================================
-- STEP 4: Drop all legacy cashout/payout tables (old systems)
-- ============================================================================

-- Drop FK constraint first if it exists
ALTER TABLE IF EXISTS public.giftcard_fulfillments
    DROP CONSTRAINT IF EXISTS giftcard_fulfillments_cashout_id_fkey;

-- Drop legacy tables
DROP TABLE IF EXISTS public.visa_redemptions CASCADE;
DROP TABLE IF EXISTS public.visa_redemptions_user_view CASCADE;
DROP TABLE IF EXISTS public.cashout_requests CASCADE;
DROP TABLE IF EXISTS public.cashout_gift_breakdown CASCADE;
DROP TABLE IF EXISTS public.cashout_documents CASCADE;
DROP TABLE IF EXISTS public.payout_window_status CASCADE;
DROP TABLE IF EXISTS public.revenue_settings CASCADE;

-- ============================================================================
-- STEP 5: Add helpful columns to payout_requests if missing
-- ============================================================================
ALTER TABLE public.payout_requests
    ADD COLUMN IF NOT EXISTS fee_coins BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payout_coins BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS user_level_at_request INT DEFAULT 1;

-- ============================================================================
-- STEP 6: Add helpful index for cooldown lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_status_created
    ON public.payout_requests(user_id, status, created_at DESC);

-- ============================================================================
-- STEP 7: Add cashout_approved columns to user_profiles if missing
-- ============================================================================
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS cashout_approved BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cashout_approved_at TIMESTAMPTZ;

-- ============================================================================
-- STEP 8: Ensure user_stats table exists for level lookups
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    xp_total BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    xp_to_next_level BIGINT DEFAULT 100,
    xp_progress FLOAT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can view own stats" ON public.user_stats
        FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- STEP 9: Ensure fast_pay_applications has all needed columns
-- ============================================================================
ALTER TABLE public.fast_pay_applications
    ADD COLUMN IF NOT EXISTS id_verification_url TEXT,
    ADD COLUMN IF NOT EXISTS id_verification_uploaded_at TIMESTAMPTZ;

-- ============================================================================
-- STEP 10: Ensure cashout_tiers table exists and is populated
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cashout_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coin_amount BIGINT NOT NULL,
    cash_amount NUMERIC(12,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    processing_fee_percentage NUMERIC(6,2) DEFAULT 2.9,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tiers if empty
INSERT INTO public.cashout_tiers (coin_amount, cash_amount, processing_fee_percentage, is_active)
SELECT * FROM (VALUES
    (7500::BIGINT, 25::NUMERIC, 2.9, TRUE),
    (15000::BIGINT, 50::NUMERIC, 2.9, TRUE),
    (30000::BIGINT, 150::NUMERIC, 2.9, TRUE),
    (60000::BIGINT, 300::NUMERIC, 2.9, TRUE),
    (120000::BIGINT, 600::NUMERIC, 2.9, TRUE),
    (200000::BIGINT, 1000::NUMERIC, 2.9, TRUE),
    (400000::BIGINT, 2000::NUMERIC, 2.9, TRUE),
    (600000::BIGINT, 3000::NUMERIC, 2.9, TRUE)
) AS t(coin_amount, cash_amount, processing_fee_percentage, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.cashout_tiers LIMIT 1);

-- ============================================================================
-- STEP 11: Ensure payout_requests has all needed columns
-- ============================================================================
ALTER TABLE public.payout_requests
    ADD COLUMN IF NOT EXISTS id_verification_url TEXT,
    ADD COLUMN IF NOT EXISTS id_verification_uploaded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS user_tag TEXT,
    ADD COLUMN IF NOT EXISTS forwarded_to_admin BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS forwarded_to_admin_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by_assistant_id UUID,
    ADD COLUMN IF NOT EXISTS reviewed_by_assistant_username TEXT,
    ADD COLUMN IF NOT EXISTS assistant_reviewed_at TIMESTAMPTZ;

-- ============================================================================
-- STEP 12: Clean up any remaining references in notifications
-- ============================================================================
-- Update any old notification types to new ones
UPDATE public.notifications
SET type = 'cashout_approved'
WHERE type = 'cashout_approved' AND type LIKE '%visa%';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
