-- ============================================================
-- Coin Liability RPC Functions
-- Secure server-side functions for the Coin Liability Dashboard.
-- All functions authenticate the caller and verify staff roles.
-- ============================================================

-- ============================================================
-- get_coin_liability_summary
-- Returns real-time summary statistics for the dashboard.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_coin_liability_summary(
    p_period_start TIMESTAMPTZ DEFAULT NULL,
    p_period_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_authorized BOOLEAN := FALSE;
    v_result JSONB;
BEGIN
    -- Authenticate the caller
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- Verify the staff role (server-side, not trusting frontend)
    SELECT EXISTS(
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = v_user_id
        AND (
            up.role IN ('admin', 'owner', 'ceo', 'secretary', 'executive_secretary', 'troll_city_secretary', 'troll_city_treasurer')
            OR up.is_admin = true
            OR up.is_superadmin = true
            OR up.is_staff = true
        )
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;

    -- Default period: last 30 days if not specified
    IF p_period_start IS NULL THEN
        p_period_start := NOW() - INTERVAL '30 days';
    END IF;
    IF p_period_end IS NULL THEN
        p_period_end := NOW();
    END IF;

    SELECT jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'total_cashable_coins', (SELECT COALESCE(SUM(cashable_coin_balance), 0) FROM public.coin_liability_summary),
            'estimated_payout_liability', (SELECT COALESCE(SUM(
                CASE
                    WHEN cashable_coin_balance >= 2000 THEN cashable_coin_balance
                    ELSE 0
                END
            ), 0) FROM public.coin_liability_summary),
            'users_with_2000_plus', (SELECT COUNT(*) FROM public.coin_liability_summary WHERE cashable_coin_balance >= 2000),
            'users_eligible_for_cashout', (SELECT COUNT(*) FROM public.coin_liability_summary WHERE cashable_coin_balance >= 2000 AND is_active = true),
            'pending_payout_requests', (SELECT COUNT(*) FROM public.payout_requests WHERE status = 'pending'),
            'approved_unpaid_payouts', (SELECT COUNT(*) FROM public.payout_requests WHERE status = 'approved'),
            'paid_payouts_period', (SELECT COUNT(*) FROM public.payout_requests WHERE status = 'paid' AND updated_at >= p_period_start AND updated_at <= p_period_end),
            'total_non_cashable_promo_coins', (SELECT COALESCE(SUM(non_cashable_coin_balance), 0) FROM public.coin_liability_summary),
            'total_purchased_coins_sold', (SELECT COALESCE(SUM(total_purchased_coins), 0) FROM public.coin_liability_summary WHERE total_purchased_coins > 0)
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_coin_liability_summary TO authenticated;

-- ============================================================
-- get_user_coin_liability_page
-- Server-side paginated, filtered user list for the dashboard.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_coin_liability_page(
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 25,
    p_search TEXT DEFAULT NULL,
    p_filter TEXT DEFAULT NULL,
    p_sort_by TEXT DEFAULT 'cashable_coin_balance',
    p_sort_dir TEXT DEFAULT 'desc'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_authorized BOOLEAN := FALSE;
    v_offset INT;
    v_total INT;
    v_data JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = v_user_id
        AND (
            up.role IN ('admin', 'owner', 'ceo', 'secretary', 'executive_secretary', 'troll_city_secretary', 'troll_city_treasurer')
            OR up.is_admin = true
            OR up.is_superadmin = true
            OR up.is_staff = true
        )
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;

    v_offset := (p_page - 1) * p_page_size;

    -- Build the base query with filters
    WITH filtered_users AS (
        SELECT *
        FROM public.coin_liability_summary
        WHERE 1 = 1
        AND (
            p_search IS NULL
            OR username ILIKE '%' || p_search || '%'
            OR user_tag ILIKE '%' || p_search || '%'
            OR id::TEXT ILIKE '%' || p_search || '%'
        )
        AND (
            p_filter IS NULL
            OR (p_filter = 'high_balance' AND cashable_coin_balance >= 2000)
            OR (p_filter = 'eligible_for_cashout' AND cashable_coin_balance >= 2000 AND is_active = true)
            OR (p_filter = 'below_first_tier' AND cashable_coin_balance < 2000)
            OR (p_filter = 'pending_payout' AND pending_payout_coins > 0)
            OR (p_filter = 'approved_payout' AND approved_unpaid_payout_coins > 0)
            OR (p_filter = 'paid_payout' AND total_paid_out > 0)
            OR (p_filter = 'suspended' AND is_active = false)
            OR (p_filter = 'non_cashable_only' AND non_cashable_coin_balance > 0 AND cashable_coin_balance = 0)
            OR (p_filter = 'no_recent_activity' AND updated_at < NOW() - INTERVAL '30 days')
        )
    ),
    sorted_users AS (
        SELECT *
        FROM filtered_users
        ORDER BY
            CASE WHEN p_sort_by = 'cashable_coin_balance' AND p_sort_dir = 'desc' THEN cashable_coin_balance END DESC,
            CASE WHEN p_sort_by = 'cashable_coin_balance' AND p_sort_dir = 'asc' THEN cashable_coin_balance END ASC,
            CASE WHEN p_sort_by = 'estimated_liability' AND p_sort_dir = 'desc' THEN cashable_coin_balance END DESC,
            CASE WHEN p_sort_by = 'most_gifts_received' AND p_sort_dir = 'desc' THEN total_gifts_received END DESC,
            CASE WHEN p_sort_by = 'most_recent_transaction' AND p_sort_dir = 'desc' THEN updated_at END DESC,
            CASE WHEN p_sort_by = 'oldest_unresolved_payout' AND p_sort_dir = 'asc' THEN pending_payout_coins END ASC,
            CASE WHEN p_sort_by = 'username' AND p_sort_dir = 'asc' THEN username END ASC,
            CASE WHEN p_sort_by = 'username' AND p_sort_dir = 'desc' THEN username END DESC
        NULLS LAST
    )
    SELECT jsonb_build_object(
        'total', (SELECT COUNT(*) FROM filtered_users),
        'page', p_page,
        'page_size', p_page_size,
        'data', (
            SELECT jsonb_agg(jsonb_build_object(
                'user_id', user_id,
                'username', username,
                'user_tag', user_tag,
                'role', role,
                'is_active', is_active,
                'cashable_coin_balance', cashable_coin_balance,
                'non_cashable_coin_balance', non_cashable_coin_balance,
                'total_gifts_received', total_gifts_received,
                'total_purchased_coins', total_purchased_coins,
                'total_coins_sent', total_coins_sent,
                'total_paid_out', total_paid_out,
                'pending_payout_coins', pending_payout_coins,
                'estimated_payout_value', cashable_coin_balance,
                'highest_cashout_tier', NULL,
                'next_cashout_tier', NULL,
                'coins_needed_for_next_tier', NULL,
                'last_gift_received_date', NULL,
                'last_transaction_date', updated_at,
                'last_payout_request_date', NULL,
                'review_status', 'clear'
            ))
            FROM sorted_users
            LIMIT p_page_size
            OFFSET v_offset
        )
    ) INTO v_data;

    RETURN jsonb_build_object('success', true, 'data', v_data);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_coin_liability_page TO authenticated;

-- ============================================================
-- get_user_coin_transaction_history
-- Returns paginated transaction history for a specific user.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_coin_transaction_history(
    p_user_id UUID,
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 25,
    p_transaction_type TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_authorized BOOLEAN := FALSE;
    v_offset INT;
    v_total INT;
BEGIN
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    -- Verify the caller has staff role
    SELECT EXISTS(
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = v_caller_id
        AND (
            up.role IN ('admin', 'owner', 'ceo', 'secretary', 'executive_secretary', 'troll_city_secretary', 'troll_city_treasurer')
            OR up.is_admin = true
            OR up.is_superadmin = true
            OR up.is_staff = true
        )
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;

    v_offset := (p_page - 1) * p_page_size;

    -- Verify the target user exists
    IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = p_user_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    WITH filtered_transactions AS (
        SELECT *
        FROM public.coin_ledger
        WHERE user_id = p_user_id
        AND (p_transaction_type IS NULL OR bucket = p_transaction_type)
        AND (p_status IS NULL OR is_active = (p_status = 'active'))
    ),
    paginated AS (
        SELECT
            id,
            user_id,
            delta,
            bucket,
            source,
            created_at,
            updated_at,
            is_active,
            (SELECT COUNT(*) FROM filtered_transactions) AS total_count
        FROM filtered_transactions
        ORDER BY created_at DESC
        LIMIT p_page_size
        OFFSET v_offset
    )
    SELECT jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'total', (SELECT total_count FROM paginated LIMIT 1),
            'page', p_page,
            'page_size', p_page_size,
            'transactions', (
                SELECT jsonb_agg(jsonb_build_object(
                    'id', id,
                    'user_id', user_id,
                    'delta', delta,
                    'bucket', bucket,
                    'source', source,
                    'created_at', created_at,
                    'updated_at', updated_at,
                    'is_active', is_active
                ))
                FROM paginated
            )
        )
    ) INTO v_total;

    RETURN jsonb_build_object('success', true, 'data', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_coin_transaction_history TO authenticated;

-- ============================================================
-- get_user_cashout_eligibility
-- Returns cash-out eligibility details for a specific user.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_cashout_eligibility(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_is_authorized BOOLEAN := FALSE;
    v_user RECORD;
    v_tiers JSONB;
    v_result JSONB;
BEGIN
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = v_caller_id
        AND (
            up.role IN ('admin', 'owner', 'ceo', 'secretary', 'executive_secretary', 'troll_city_secretary', 'troll_city_treasurer')
            OR up.is_admin = true
            OR up.is_superadmin = true
            OR up.is_staff = true
        )
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;

    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Get active cashout tiers
    SELECT jsonb_agg(jsonb_build_object(
        'coin_amount', ct.coin_amount,
        'cash_amount', ct.cash_amount,
        'currency', ct.currency,
        'processing_fee_percentage', ct.processing_fee_percentage,
        'is_active', ct.is_active
    ))
    INTO v_tiers
    FROM public.cashout_tiers ct
    WHERE ct.is_active = true
    ORDER BY ct.coin_amount ASC;

    -- Calculate eligibility
    SELECT jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'user_id', v_user.id,
            'username', v_user.username,
            'cashable_coin_balance', COALESCE(v_user.cashout_coins, 0) - COALESCE(v_user.cashout_reserved_coins, 0),
            'non_cashable_balance', COALESCE(v_user.promo_coins, 0),
            'purchased_coin_balance', COALESCE(v_user.purchased_coins, 0),
            'promotional_balance', COALESCE(v_user.promo_coins, 0),
            'pending_balance', COALESCE(v_user.cashout_reserved_coins, 0),
            'lifetime_gifts_received', COALESCE(v_user.total_gifts_received, 0),
            'lifetime_coins_sent', COALESCE(v_user.total_coins_sent, 0),
            'lifetime_payout_amount', COALESCE(v_user.total_payout_amount, 0),
            'estimated_liability', COALESCE(v_user.cashout_coins, 0) - COALESCE(v_user.cashout_reserved_coins, 0),
            'cashout_eligibility', COALESCE(v_user.cashout_approved, false),
            'available_tiers', v_tiers,
            'highest_eligible_tier', NULL,
            'coins_required_per_tier', NULL,
            'cash_value_per_tier', NULL,
            'estimated_remaining_after_tier', NULL,
            'identity_verification_required', NOT COALESCE(v_user.cashout_approved, false),
            'payout_method_present', v_user.payout_method IS NOT NULL,
            'currently_eligible', COALESCE(v_user.cashout_coins, 0) - COALESCE(v_user.cashout_reserved_coins, 0) >= 2000
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_cashout_eligibility TO authenticated;

-- ============================================================
-- get_coin_liability_alerts
-- Returns coin liability alerts for authorized staff.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_coin_liability_alerts(
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 25,
    p_status TEXT DEFAULT NULL,
    p_alert_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_authorized BOOLEAN := FALSE;
    v_offset INT;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = v_user_id
        AND (
            up.role IN ('admin', 'owner', 'ceo', 'secretary', 'executive_secretary', 'troll_city_secretary', 'troll_city_treasurer')
            OR up.is_admin = true
            OR up.is_superadmin = true
            OR up.is_staff = true
        )
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;

    v_offset := (p_page - 1) * p_page_size;

    RETURN jsonb_build_object(
        'success', true,
        'data', (
            SELECT jsonb_build_object(
                'total', (SELECT COUNT(*) FROM public.coin_liability_alerts WHERE (p_status IS NULL OR status = p_status) AND (p_alert_type IS NULL OR alert_type = p_alert_type)),
                'page', p_page,
                'page_size', p_page_size,
                'alerts', (
                    SELECT jsonb_agg(jsonb_build_object(
                        'id', id,
                        'user_id', user_id,
                        'alert_type', alert_type,
                        'severity', severity,
                        'description', description,
                        'metadata', metadata,
                        'status', status,
                        'handled_by', handled_by,
                        'handled_at', handled_at,
                        'created_at', created_at,
                        'updated_at', updated_at
                    ))
                    FROM public.coin_liability_alerts
                    WHERE (p_status IS NULL OR status = p_status)
                    AND (p_alert_type IS NULL OR alert_type = p_alert_type)
                    ORDER BY created_at DESC
                    LIMIT p_page_size
                    OFFSET v_offset
                )
            )
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_coin_liability_alerts TO authenticated;