-- ============================================================
-- Enhanced Cashout System Migration
-- Date: 2026-05-13
-- Purpose: Implement comprehensive cashout system with Friday gating,
--          gift-eligibility tracking, ID verification, and multi-provider payouts
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Add new columns to visa_redemptions for enhanced tracking
-- ============================================================

ALTER TABLE public.visa_redemptions
ADD COLUMN IF NOT EXISTS payout_method TEXT CHECK (payout_method IN ('cash_app', 'paypal', 'venmo')),
ADD COLUMN IF NOT EXISTS payout_provider_username TEXT,
ADD COLUMN IF NOT EXISTS id_verification_url TEXT,
ADD COLUMN IF NOT EXISTS id_verification_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS receipt_url TEXT,
ADD COLUMN IF NOT EXISTS receipt_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS opened_by_admin_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS prior_status TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS eligible_gift_coins_used BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS fee_percentage NUMERIC(5,2) DEFAULT 2.9,
ADD COLUMN IF NOT EXISTS fee_coins BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_coins BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS cashout_type TEXT DEFAULT 'gift' CHECK (cashout_type IN ('gift', 'friday_bonus', 'admin_override')),
ADD COLUMN IF NOT EXISTS is_friday_battle_bonus BOOLEAN DEFAULT FALSE;

-- ============================================================
-- 2. Create cashout_documents table for ID and receipt storage
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cashout_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cashout_request_id UUID NOT NULL REFERENCES public.visa_redemptions(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('id_verification', 'payment_receipt', 'admin_notes')),
    file_url TEXT NOT NULL,
    file_name TEXT,
    mime_type TEXT,
    file_size BIGINT,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_cashout_documents_request_id ON public.cashout_documents(cashout_request_id);
CREATE INDEX IF NOT EXISTS idx_cashout_documents_type ON public.cashout_documents(document_type);

-- ============================================================
-- 3. Create cashout_gift_breakdown table for admin detail view
--     This stores aggregated gift info per sender per cashout request
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cashout_gift_breakdown (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cashout_request_id UUID NOT NULL REFERENCES public.visa_redemptions(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    sender_username TEXT NOT NULL,
    total_gift_coins BIGINT NOT NULL,
    gift_count INT NOT NULL,
    coin_type TEXT CHECK (coin_type IN ('paid', 'free')) DEFAULT 'paid',
    is_eligible BOOLEAN DEFAULT TRUE,
    is_manually_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cashout_request_id, sender_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_cashout_gift_breakdown_request ON public.cashout_gift_breakdown(cashout_request_id);
CREATE INDEX IF NOT EXISTS idx_cashout_gift_breakdown_sender ON public.cashout_gift_breakdown(sender_id);

-- ============================================================
-- 4. Add columns to user_profiles to track Friday bonus separately
-- ============================================================

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS friday_battle_bonus_coins BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_friday_bonus_date DATE;

-- ============================================================
-- 5. Create function to check if cashouts are allowed (Friday only)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_cashout_window_open()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_day_of_week INT := EXTRACT(DOW FROM v_now AT TIME ZONE 'America/Denver'); -- 0=Sun, 1=Mon, ..., 5=Fri
    v_hour INT := EXTRACT(HOUR FROM v_now AT TIME ZONE 'America/Denver');
    v_enabled BOOLEAN;
BEGIN
    -- Check the payout window status from the Secretary's control table
    SELECT enabled INTO v_enabled
    FROM public.payout_window_status
    LIMIT 1;

    -- Cashouts are only allowed on Friday (5) during enabled hours
    -- Plus if the admin has enabled the window
    IF v_enabled IS NULL THEN
        v_enabled := FALSE;
    END IF;

    RETURN v_enabled AND v_day_of_week = 5; -- Friday only
END;
$$;

-- ============================================================
-- 6. Create function to calculate eligible gift coins for cashout
--     Only coins received from gifts (type = 'gift_received') count.
--     Excludes Friday Battle 5% cashback, free coins, purchase coins.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_eligible_gift_coins(p_user_id UUID)
RETURNS TABLE (
    total_eligible_coins BIGINT,
    gift_summary JSONB,
    breakdown JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_total_eligible BIGINT := 0;
    v_gift_summary JSONB := '[]'::JSONB;
    v_breakdown JSONB := '[]'::JSONB;
BEGIN
    -- Get total eligible coins from gift_received transactions (paid coin_type only) excluding Friday battle bonuses,
    -- plus the initial signup bonus coins for new users.
    SELECT
        COALESCE(SUM(amount), 0)::BIGINT,
        jsonb_agg(
            jsonb_build_object(
                'sender_id', from_user_id,
                'sender_username', COALESCE(from_user_name, 'Signup Bonus'),
                'total_coins', SUM(amount),
                'gift_count', COUNT(*),
                'coin_type', 'paid'
            )
        )
    INTO v_total_eligible, v_breakdown
    FROM (
        SELECT
            from_user_id,
            from_user_name,
            amount
        FROM public.coin_transactions
        WHERE user_id = p_user_id
          AND amount > 0
          AND (
            (type = 'gift_received' AND (metadata->>'is_friday_bonus') IS NOT DISTINCT FROM NULL AND coin_type = 'paid')
            OR description = 'Welcome bonus coins'
          )
    ) sub
    GROUP BY from_user_id, from_user_name
    ORDER BY SUM(amount) DESC;

    -- Build summary stats
    SELECT jsonb_build_object(
        'total_eligible', v_total_eligible,
        'sender_count', jsonb_array_length(v_breakdown),
        'breakdown', v_breakdown
    ) INTO v_gift_summary;

    RETURN QUERY SELECT v_total_eligible, v_gift_summary, v_breakdown;
END;
$$;

-- ============================================================
-- 7. Create main cashout request RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_cashout_v3(
    p_user_id UUID,
    p_coins_to_redeem BIGINT,
    p_payout_method TEXT,
    p_payout_provider_username TEXT,
    p_id_document_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_eligible_result RECORD;
    v_available_coins BIGINT;
    v_reserved_coins BIGINT;
    v_fee_coins BIGINT;
    v_net_coins BIGINT;
    v_cashout_id UUID;
    v_tier_id UUID;
    v_cashout_amount_usd NUMERIC(10,2);
    v_error TEXT := '';
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Get user profile
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Check Friday restriction
    IF NOT public.is_cashout_window_open() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cashouts are only available on Fridays');
    END IF;

    -- Check for active loans
    IF EXISTS (
        SELECT 1 FROM public.loans
        WHERE user_id = p_user_id
          AND status IN ('active', 'late', 'overdue', 'delinquent', 'defaulted')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Active loans must be paid before cashout');
    END IF;

    -- Calculate eligible gift coins
    SELECT * INTO v_eligible_result
    FROM public.get_eligible_gift_coins(p_user_id);

    v_available_coins := v_eligible_result.total_eligible;

    -- Validate coins available
    IF v_available_coins < p_coins_to_redeem THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient eligible gift coins. Only gift-received coins can be cashed out.',
            'eligible_coins', v_available_coins,
            'requested', p_coins_to_redeem
        );
    END IF;

    -- Get cashout tier
    SELECT id, cash_amount
    INTO v_tier_id, v_cashout_amount_usd
    FROM public.cashout_tiers
    WHERE coin_amount = p_coins_to_redeem
      AND is_active = TRUE
    LIMIT 1;

    IF v_tier_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid cashout tier');
    END IF;

    -- Calculate fee (0%)
    v_fee_coins := CEIL(p_coins_to_redeem * 0.029);
    v_net_coins := p_coins_to_redeem - v_fee_coins;

    -- Reserve coins for cashout (track both legacy and current reservation columns)
    UPDATE public.user_profiles
    SET
        reserved_troll_coins = COALESCE(reserved_troll_coins, 0) + (p_coins_to_redeem + v_fee_coins),
        cashout_reserved_coins = COALESCE(cashout_reserved_coins, 0) + (p_coins_to_redeem + v_fee_coins)
    WHERE id = p_user_id;

    -- Create cashout request
    INSERT INTO public.visa_redemptions (
        user_id,
        coins_reserved,
        usd_amount,
        status,
        payout_method,
        payout_details,
        id_verification_url,
        eligible_gift_coins_used,
        fee_percentage,
        fee_coins,
        net_coins,
        cashout_type,
        created_at
    ) VALUES (
        p_user_id,
        p_coins_to_redeem + v_fee_coins,
        v_cashout_amount_usd,
        'pending',
        p_payout_method,
        p_payout_provider_username,
        p_id_document_url,
        p_coins_to_redeem,
        2.9,
        v_fee_coins,
        v_net_coins,
        'gift',
        v_now
    ) RETURNING id INTO v_cashout_id;

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
        'paid',
        'Cashout request submitted',
        v_user.troll_coins - (p_coins_to_redeem + v_fee_coins),
        jsonb_build_object(
            'cashout_request_id', v_cashout_id,
            'payout_method', p_payout_method,
            'payout_provider', p_payout_provider_username,
            'fee_coins', v_fee_coins,
            'net_coins', v_net_coins
        ),
        v_now
    );

    -- Send notification
    PERFORM public.create_notification(
        p_user_id,
        'cashout_submitted',
        'Cashout Request Submitted',
        format(
            'Your cashout request for %s coins ($%s) has been submitted and is pending review.',
            p_coins_to_redeem,
            v_cashout_amount_usd
        ),
        jsonb_build_object(
            'cashout_id', v_cashout_id,
            'amount_usd', v_cashout_amount_usd,
            'coins', p_coins_to_redeem
        )
    );

    -- Log audit
    INSERT INTO public.admin_audit_log (
        admin_id,
        action,
        target_user_id,
        details,
        created_at
    ) VALUES (
        p_user_id, -- self-action
        'cashout_requested',
        p_user_id,
        jsonb_build_object(
            'cashout_id', v_cashout_id,
            'coins', p_coins_to_redeem,
            'usd', v_cashout_amount_usd,
            'payout_method', p_payout_method,
            'provider', p_payout_provider_username
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'cashout_id', v_cashout_id,
        'coins_reserved', p_coins_to_redeem + v_fee_coins,
        'fee_coins', v_fee_coins,
        'net_coins', v_net_coins,
        'usd_amount', v_cashout_amount_usd,
        'eligible_coins', v_available_coins
    );

EXCEPTION
    WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
        RETURN jsonb_build_object('success', false, 'error', v_error);
END;
$$;

-- ============================================================
-- 8. Create function for admin to open cashout request (changes to processing)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_open_cashout_request(
    p_admin_id UUID,
    p_cashout_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request RECORD;
    v_user RECORD;
    v_prior_status TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Check if admin
    IF NOT public.is_admin_or_secretary(p_admin_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Get request
    SELECT * INTO v_request
    FROM public.visa_redemptions
    WHERE id = p_cashout_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cashout request not found');
    END IF;

    IF v_request.status NOT IN ('pending', 'submitted') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot open request in current status');
    END IF;

    -- Store prior status
    v_prior_status := v_request.status;

    -- Update to processing
    UPDATE public.visa_redemptions
    SET status = 'processing',
        opened_by_admin_id = p_admin_id,
        opened_at = v_now,
        prior_status = v_prior_status,
        updated_at = v_now
    WHERE id = p_cashout_id;

    -- Get user info
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = v_request.user_id;

    -- Send notification to user
    PERFORM public.create_notification(
        v_request.user_id,
        'cashout_approved',
        'Cashout Under Review',
        'Your cashout request is now being processed by our team.',
        jsonb_build_object(
            'cashout_id', p_cashout_id,
            'status', 'processing'
        )
    );

    -- Audit log
    INSERT INTO public.admin_audit_log (
        admin_id,
        action,
        target_user_id,
        details,
        created_at
    ) VALUES (
        p_admin_id,
        'cashout_opened',
        v_request.user_id,
        jsonb_build_object(
            'cashout_id', p_cashout_id,
            'prior_status', v_prior_status
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', 'processing',
        'opened_by', p_admin_id,
        'opened_at', v_now
    );

END;
$$;

-- ============================================================
-- 9. Create function for admin to approve/deny cashout
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_process_cashout_request(
    p_admin_id UUID,
    p_cashout_id UUID,
    p_action TEXT, -- 'approve' or 'deny'
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request RECORD;
    v_user RECORD;
    v_new_status TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Check if admin
    IF NOT public.is_admin_or_secretary(p_admin_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Validate action
    IF p_action NOT IN ('approve', 'deny') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
    END IF;

    -- Get request
    SELECT * INTO v_request
    FROM public.visa_redemptions
    WHERE id = p_cashout_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cashout request not found');
    END IF;

    IF v_request.status != 'processing' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request must be in processing status');
    END IF;

    v_new_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'denied' END;

    -- Update request
    UPDATE public.visa_redemptions
    SET status = v_new_status,
        processed_at = v_now,
        processed_by = p_admin_id,
        rejection_reason = CASE WHEN p_action = 'deny' THEN p_reason ELSE NULL END,
        updated_at = v_now
    WHERE id = p_cashout_id;

    -- Get user
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = v_request.user_id;

    -- Send notification
    PERFORM public.create_notification(
        v_request.user_id,
        CASE WHEN p_action = 'approve' THEN 'cashout_approved' ELSE 'cashout_rejected' END,
        CASE WHEN p_action = 'approve' THEN 'Cashout Approved' ELSE 'Cashout Denied' END,
        CASE
            WHEN p_action = 'approve'
            THEN 'Your cashout request for $' || v_request.usd_amount || ' has been approved.'
            ELSE 'Your cashout request was denied. Reason: ' || COALESCE(p_reason, 'Not specified')
        END,
        jsonb_build_object(
            'cashout_id', p_cashout_id,
            'status', v_new_status,
            'amount_usd', v_request.usd_amount
        )
    );

    -- If denied, refund coins (add back to troll_coins and reduce reserved)
    IF p_action = 'deny' THEN
        UPDATE public.user_profiles
        SET
            troll_coins = COALESCE(troll_coins, 0) + v_request.eligible_gift_coins_used,
            reserved_troll_coins = COALESCE(reserved_troll_coins, 0) - (v_request.eligible_gift_coins_used + v_request.fee_coins),
            cashout_reserved_coins = COALESCE(cashout_reserved_coins, 0) - (v_request.eligible_gift_coins_used + v_request.fee_coins)
        WHERE id = v_request.user_id;

        -- Create refund transaction
        INSERT INTO public.coin_transactions (
            user_id, type, amount, coin_type, description, balance_after, metadata, created_at
        ) VALUES (
            v_request.user_id,
            'cashout_refund',
            v_request.eligible_gift_coins_used,
            'paid',
            'Cashout denied - coins refunded',
            v_user.troll_coins + v_request.eligible_gift_coins_used,
            jsonb_build_object('cashout_id', p_cashout_id, 'reason', p_reason),
            v_now
        );
    END IF;

    -- Audit log
    INSERT INTO public.admin_audit_log (
        admin_id, action, target_user_id, details, created_at
    ) VALUES (
        p_admin_id,
        'cashout_' || p_action,
        v_request.user_id,
        jsonb_build_object(
            'cashout_id', p_cashout_id,
            'usd_amount', v_request.usd_amount,
            'coins', v_request.eligible_gift_coins_used
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', v_new_status,
        'action', p_action
    );

END;
$$;

-- ============================================================
-- 10. Create function for admin to mark cashout as completed (with receipt upload)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_complete_cashout_with_receipt(
    p_admin_id UUID,
    p_cashout_id UUID,
    p_receipt_url TEXT,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request RECORD;
    v_user RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Check if admin
    IF NOT public.is_admin_or_secretary(p_admin_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Get request
    SELECT * INTO v_request
    FROM public.visa_redemptions
    WHERE id = p_cashout_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cashout request not found');
    END IF;

    IF v_request.status != 'approved' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request must be approved before marking completed');
    END IF;

    -- Update request status
    UPDATE public.visa_redemptions
    SET status = 'completed',
        fulfilled_at = v_now,
        fulfilled_by = p_admin_id,
        receipt_url = p_receipt_url,
        receipt_uploaded_at = v_now,
        admin_notes = p_admin_notes,
        updated_at = v_now
    WHERE id = p_cashout_id;

    -- Get user
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = v_request.user_id;

    -- Send completion notification
    PERFORM public.create_notification(
        v_request.user_id,
        'cashout_paid',
        'Cashout Completed',
        'Your cashout of $' || v_request.usd_amount || ' has been sent! Check your ' || v_request.payout_method || ' account.',
        jsonb_build_object(
            'cashout_id', p_cashout_id,
            'amount_usd', v_request.usd_amount,
            'payout_method', v_request.payout_method,
            'provider_username', v_request.payout_details,
            'receipt_url', p_receipt_url
        )
    );

    -- Audit log
    INSERT INTO public.admin_audit_log (
        admin_id, action, target_user_id, details, created_at
    ) VALUES (
        p_admin_id,
        'cashout_completed',
        v_request.user_id,
        jsonb_build_object(
            'cashout_id', p_cashout_id,
            'usd_amount', v_request.usd_amount,
            'receipt_url', p_receipt_url
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', 'completed',
        'receipt_url', p_receipt_url
    );

END;
$$;

-- ============================================================
-- 11. Create function to get cashout request details with gift breakdown
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_cashout_request_details(p_cashout_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_cashout RECORD;
    v_user RECORD;
    v_gift_breakdown JSONB;
    v_total_gifts BIGINT;
    v_distinct_senders INT;
    v_eligible_gift_coins BIGINT;
BEGIN
    -- Get cashout request
    SELECT * INTO v_cashout
    FROM public.visa_redemptions vr
    WHERE id = p_cashout_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cashout request not found');
    END IF;

    -- Get user
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = v_cashout.user_id;

    -- Get aggregated gift breakdown by sender for the user's entire gift history
    SELECT
        jsonb_agg(
            jsonb_build_object(
                'sender_id', sender_id,
                'sender_username', sender_username,
                'total_coins', total_gift_coins,
                'gift_count', gift_count,
                'coin_type', coin_type,
                'is_eligible', is_eligible,
                'is_manually_verified', is_manually_verified,
                'verified_by', verified_by,
                'verified_at', verified_at,
                'notes', notes
            )
            ORDER BY total_gift_coins DESC
        ),
        COALESCE(SUM(total_gift_coins), 0),
        COUNT(*)
    INTO v_gift_breakdown, v_total_gifts, v_distinct_senders
    FROM public.cashout_gift_breakdown
    WHERE cashout_request_id = p_cashout_id;

    -- If breakdown not yet created, build it from coin_transactions
    IF v_gift_breakdown IS NULL THEN
        SELECT
            jsonb_agg(
                jsonb_build_object(
                    'sender_id', from_user_id,
                    'sender_username', from_user_name,
                    'total_coins', SUM(amount),
                    'gift_count', COUNT(*),
                    'coin_type', 'paid',
                    'is_eligible', TRUE,
                    'is_manually_verified', FALSE,
                    'verified_by', NULL,
                    'verified_at', NULL,
                    'notes', NULL
                )
                ORDER BY SUM(amount) DESC
            ),
            COALESCE(SUM(amount), 0)::BIGINT,
            COUNT(DISTINCT from_user_id)
        INTO v_gift_breakdown, v_total_gifts, v_distinct_senders
        FROM public.coin_transactions
        WHERE user_id = v_cashout.user_id
          AND type = 'gift_received'
          AND amount > 0
          AND (metadata->>'is_friday_bonus') IS NOT DISTINCT FROM NULL
        GROUP BY from_user_id, from_user_name;
    END IF;

    -- Calculate eligible coins (same as get_eligible_gift_coins)
    SELECT COALESCE(SUM(amount), 0)::BIGINT INTO v_eligible_gift_coins
    FROM coin_transactions
    WHERE user_id = v_cashout.user_id
      AND type = 'gift_received'
      AND amount > 0
      AND (metadata->>'is_friday_bonus') IS NOT DISTINCT FROM NULL
      AND coin_type = 'paid';

    RETURN jsonb_build_object(
        'success', true,
        'cashout', jsonb_build_object(
            'id', v_cashout.id,
            'user_id', v_cashout.user_id,
            'username', v_user.username,
            'coins_redeemed', v_cashout.coins_reserved - v_cashout.fee_coins,
            'eligible_gift_coins_used', v_cashout.eligible_gift_coins_used,
            'fee_coins', v_cashout.fee_coins,
            'net_coins', v_cashout.net_coins,
            'usd_amount', v_cashout.usd_amount,
            'status', v_cashout.status,
            'payout_method', v_cashout.payout_method,
            'payout_provider_username', v_cashout.payout_details,
            'id_verification_url', v_cashout.id_verification_url,
            'id_verification_uploaded_at', v_cashout.id_verification_uploaded_at,
            'receipt_url', v_cashout.receipt_url,
            'receipt_uploaded_at', v_cashout.receipt_uploaded_at,
            'admin_notes', v_cashout.admin_notes,
            'opened_by_admin_id', v_cashout.opened_by_admin_id,
            'opened_at', v_cashout.opened_at,
            'rejection_reason', v_cashout.rejection_reason,
            'requested_at', v_cashout.created_at,
            'processed_at', v_cashout.processed_at,
            'processed_by', v_cashout.processed_by
        ),
        'user', jsonb_build_object(
            'id', v_user.id,
            'username', v_user.username,
            'email', v_user.email,
            'troll_coins', v_user.troll_coins,
            'reserved_troll_coins', v_user.reserved_troll_coins,
            'cashout_reserved_coins', COALESCE(v_user.cashout_reserved_coins, 0),
            'available_coins', v_user.troll_coins - COALESCE(v_user.cashout_reserved_coins, COALESCE(v_user.reserved_troll_coins, 0))
        ),
        'gift_breakdown', v_gift_breakdown,
        'summary', jsonb_build_object(
            'total_gift_coins', v_total_gifts,
            'distinct_senders', v_distinct_senders,
            'eligible_gift_coins', v_eligible_gift_coins,
            'eligible_for_cashout', v_eligible_gift_coins >= v_cashout.eligible_gift_coins_used
        )
    );
END;
$$;

-- ============================================================
-- 12. Create function for admin to manually verify gift eligibility
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_verify_gift_eligibility(
    p_admin_id UUID,
    p_cashout_id UUID,
    p_sender_id UUID,
    p_is_eligible BOOLEAN,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF NOT public.is_admin_or_secretary(p_admin_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Update the breakdown record
    UPDATE public.cashout_gift_breakdown
    SET
        is_eligible = p_is_eligible,
        is_manually_verified = TRUE,
        verified_by = p_admin_id,
        verified_at = v_now,
        notes = p_notes
    WHERE cashout_request_id = p_cashout_id
      AND sender_id = p_sender_id;

    IF NOT FOUND THEN
        -- Create record if doesn't exist
        INSERT INTO public.cashout_gift_breakdown (
            cashout_request_id,
            sender_id,
            sender_username,
            total_gift_coins,
            gift_count,
            coin_type,
            is_eligible,
            is_manually_verified,
            verified_by,
            verified_at,
            notes
        )
        SELECT
            p_cashout_id,
            from_user_id,
            from_user_name,
            SUM(amount)::BIGINT,
            COUNT(*),
            'paid',
            p_is_eligible,
            TRUE,
            p_admin_id,
            v_now,
            p_notes
        FROM coin_transactions
        WHERE user_id = (SELECT user_id FROM visa_redemptions WHERE id = p_cashout_id)
          AND from_user_id = p_sender_id
          AND type = 'gift_received'
        GROUP BY from_user_id, from_user_name;
    END IF;

    -- Audit log
    INSERT INTO public.admin_audit_log (
        admin_id, action, target_user_id, details, created_at
    ) VALUES (
        p_admin_id,
        'gift_eligibility_verified',
        (SELECT user_id FROM visa_redemptions WHERE id = p_cashout_id),
        jsonb_build_object(
            'cashout_id', p_cashout_id,
            'sender_id', p_sender_id,
            'is_eligible', p_is_eligible
        ),
        v_now
    );

    RETURN jsonb_build_object('success', true, 'verified', p_is_eligible);

END;
$$;

-- ============================================================
-- 13. Create notification trigger for cashout status changes
-- ============================================================

-- Note: Notifications are sent via the RPCs above. This is a placeholder
-- for any automatic triggers on table changes.

CREATE OR REPLACE FUNCTION public.notify_cashout_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_notification_type TEXT;
    v_title TEXT;
    v_message TEXT;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        -- Determine notification type based on new status
        v_notification_type := CASE NEW.status
            WHEN 'pending' THEN 'cashout_submitted'
            WHEN 'processing' THEN 'cashout_approved'  -- approval starts processing
            WHEN 'approved' THEN 'cashout_approved'
            WHEN 'completed' THEN 'cashout_paid'
            WHEN 'denied' THEN 'cashout_rejected'
            ELSE NULL
        END;

        IF v_notification_type IS NOT NULL THEN
            v_title := CASE NEW.status
                WHEN 'pending' THEN 'Cashout Request Submitted'
                WHEN 'processing' THEN 'Cashout Under Review'
                WHEN 'approved' THEN 'Cashout Approved'
                WHEN 'completed' THEN 'Cashout Completed'
                WHEN 'denied' THEN 'Cashout Denied'
            END;

            v_message := CASE NEW.status
                WHEN 'pending' THEN 'Your cashout request has been submitted.'
                WHEN 'processing' THEN 'Your cashout request is now being processed.'
                WHEN 'approved' THEN 'Your cashout request for $' || NEW.usd_amount || ' has been approved!'
                WHEN 'completed' THEN 'Your cashout of $' || NEW.usd_amount || ' has been sent!'
                WHEN 'denied' THEN 'Your cashout request was denied. ' || COALESCE(NEW.rejection_reason, '')
            END;

            PERFORM public.create_notification(
                NEW.user_id,
                v_notification_type,
                v_title,
                v_message,
                jsonb_build_object(
                    'cashout_id', NEW.id,
                    'status', NEW.status,
                    'amount_usd', NEW.usd_amount
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_notify_cashout_status_change ON public.visa_redemptions;

-- Create trigger
CREATE TRIGGER trg_notify_cashout_status_change
    AFTER UPDATE OF status ON public.visa_redemptions
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.notify_cashout_status_change();

-- ============================================================
-- 14. Enable RLS on new tables
-- ============================================================

ALTER TABLE public.cashout_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashout_gift_breakdown ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 15. RLS Policies for cashout_documents
-- ============================================================

-- Users can view documents for their own cashout requests
CREATE POLICY "Users can view their own cashout documents"
    ON public.cashout_documents
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.visa_redemptions vr
            WHERE vr.id = cashout_request_id
              AND vr.user_id = auth.uid()
        )
    );

-- Admins can view all
CREATE POLICY "Admins can view all cashout documents"
    ON public.cashout_documents
    FOR SELECT
    USING (
        public.is_admin_or_secretary(auth.uid())
    );

-- Only admins can insert (for receipt uploads, ID verification from admin side)
CREATE POLICY "Admins can insert cashout documents"
    ON public.cashout_documents
    FOR INSERT
    WITH CHECK (
        public.is_admin_or_secretary(auth.uid())
        AND document_type IN ('payment_receipt', 'admin_notes')
    );

-- Users can insert their own ID verification
CREATE POLICY "Users can insert their own ID verification"
    ON public.cashout_documents
    FOR INSERT
    WITH CHECK (
        document_type = 'id_verification'
        AND uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.visa_redemptions vr
            WHERE vr.id = cashout_request_id
              AND vr.user_id = auth.uid()
              AND vr.status = 'pending'
        )
    );

-- ============================================================
-- 16. RLS Policies for cashout_gift_breakdown
-- ============================================================

-- Users can view their own breakdown
CREATE POLICY "Users can view their own gift breakdown"
    ON public.cashout_gift_breakdown
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.visa_redemptions vr
            WHERE vr.id = cashout_request_id
              AND vr.user_id = auth.uid()
        )
    );

-- Admins can view all
CREATE POLICY "Admins can view all gift breakdowns"
    ON public.cashout_gift_breakdown
    FOR SELECT
    USING (
        public.is_admin_or_secretary(auth.uid())
    );

-- Admins can insert/update
CREATE POLICY "Admins can manage gift breakdown"
    ON public.cashout_gift_breakdown
    FOR ALL
    USING (
        public.is_admin_or_secretary(auth.uid())
    )
    WITH CHECK (
        public.is_admin_or_secretary(auth.uid())
    );

-- ============================================================
-- 17. Create payout_window_status table if not exists
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payout_window_status (
    id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
    enabled BOOLEAN DEFAULT FALSE,
    min_coins INTEGER DEFAULT 5000,
    special_tier_enabled BOOLEAN DEFAULT FALSE,
    special_tier_coins INTEGER DEFAULT 5000,
    special_tier_usd NUMERIC(10,2) DEFAULT 1.00,
    duration_minutes INTEGER DEFAULT 20,
    enabled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    message TEXT DEFAULT 'Cashout window is closed',
    notified_users BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row if none exists
INSERT INTO public.payout_window_status (id, enabled)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 18. Helper function: is_admin_or_secretary (if not exists)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin_or_secretary(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_profile RECORD;
BEGIN
    SELECT role, troll_role INTO v_profile
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    RETURN v_profile.role IN ('admin', 'secretary', 'Secretary', 'Troll_City_Secretary', 'Executive_Secretary')
        OR v_profile.troll_role IN ('admin', 'secretary', 'Secretary', 'Troll_City_Secretary', 'Executive_Secretary');
END;
$$;

-- ============================================================
-- 19. Grant appropriate permissions
-- ============================================================

-- Grant execute on RPCs
GRANT EXECUTE ON FUNCTION public.is_cashout_window_open() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_eligible_gift_coins(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_cashout_v3(UUID, BIGINT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_open_cashout_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_process_cashout_request(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_complete_cashout_with_receipt(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cashout_request_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_gift_eligibility(UUID, UUID, UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_secretary(UUID) TO authenticated;

-- ============================================================
-- End of Migration
-- ============================================================

