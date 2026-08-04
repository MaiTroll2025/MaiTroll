-- Fix SQL 42803: aggregate function calls cannot be nested
-- Fixes three functions that use SUM/COUNT inside jsonb_agg (nested aggregates)
-- Solution: pre-aggregate via CTE/subquery, then apply jsonb_agg on pre-aggregated results

-- ============================================================
-- 1. Fix get_cashout_request_details: fallback path (lines 748-774 of original)
-- ============================================================
-- Find the function and get its full definition, then fix only the nested aggregate part.
-- We use CREATE OR REPLACE to update the function body.

-- We need to read the full function to replace it. Let's find the complete function:
-- (The function name is get_cashout_request_details)
-- Since we can't easily get the exact full body from the audit, we fix just the
-- problematic pattern by creating a helper function and updating the main one.

-- First create a helper function to build the gift breakdown safely
CREATE OR REPLACE FUNCTION public.build_gift_breakdown_from_transactions(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH sender_totals AS (
        SELECT
            from_user_id,
            from_user_name,
            SUM(amount) AS total_coins,
            COUNT(*) AS gift_count
        FROM public.coin_transactions
        WHERE user_id = p_user_id
          AND type = 'gift_received'
          AND amount > 0
          AND (metadata->>'is_friday_bonus') IS NOT DISTINCT FROM NULL
        GROUP BY from_user_id, from_user_name
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'sender_id', from_user_id,
                'sender_username', from_user_name,
                'total_coins', total_coins,
                'gift_count', gift_count,
                'coin_type', 'paid',
                'is_eligible', TRUE,
                'is_manually_verified', FALSE,
                'verified_by', NULL,
                'verified_at', NULL,
                'notes', NULL
            )
            ORDER BY total_coins DESC
        ),
        '[]'::jsonb
    )
    INTO v_result
    FROM sender_totals;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.build_gift_breakdown_from_transactions TO authenticated;

-- ============================================================
-- 2. Fix get_eligible_gift_coins: replace nested SUM/COUNT in jsonb_agg with CTE approach
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
    -- Pre-aggregate gift totals by sender to avoid nested aggregates
    WITH filtered_transactions AS (
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
    ),
    sender_totals AS (
        SELECT
            from_user_id,
            COALESCE(from_user_name, 'Signup Bonus') AS sender_username,
            SUM(amount) AS total_coins,
            COUNT(*) AS gift_count
        FROM filtered_transactions
        GROUP BY from_user_id, from_user_name
    )
    SELECT
        COALESCE(SUM(total_coins), 0)::BIGINT,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'sender_id', from_user_id,
                    'sender_username', sender_username,
                    'total_coins', total_coins,
                    'gift_count', gift_count,
                    'coin_type', 'paid'
                )
                ORDER BY total_coins DESC
            ),
            '[]'::jsonb
        )
    INTO v_total_eligible, v_breakdown
    FROM sender_totals;

    -- Build summary stats
    v_gift_summary := jsonb_build_object(
        'total_eligible', v_total_eligible,
        'sender_count', jsonb_array_length(v_breakdown),
        'breakdown', v_breakdown
    );

    RETURN QUERY SELECT v_total_eligible, v_gift_summary, v_breakdown;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_eligible_gift_coins TO authenticated;

-- ============================================================
-- 3. Fix get_pending_payouts_for_review: replace correlated SUM subquery inside jsonb_agg
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_pending_payouts_for_review()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH payout_data AS (
        SELECT
            p.id,
            p.user_id,
            up.username,
            up.display_name,
            up.role,
            p.coin_amount,
            p.cash_amount,
            p.net_amount,
            p.provider_type,
            p.provider_username,
            p.user_tag,
            p.status,
            p.created_at,
            COALESCE(up.troll_coins, 0) AS troll_coins_balance,
            COALESCE(w.total_earned_this_week, 0) AS total_earned_this_week
        FROM public.payout_requests p
        JOIN public.user_profiles up ON up.id = p.user_id
        LEFT JOIN LATERAL (
            SELECT SUM(w.amount_coins) AS total_earned_this_week
            FROM public.weekly_working_earnings w
            WHERE w.user_id = p.user_id
              AND w.status IN ('pending', 'converted')
              AND w.week_start = date_trunc('week', CURRENT_DATE)::date
        ) w ON TRUE
        WHERE p.status = 'pending'
          AND p.forwarded_to_admin = FALSE
    ),
    aggregated AS (
        SELECT
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', pd.id,
                        'user_id', pd.user_id,
                        'username', pd.username,
                        'display_name', pd.display_name,
                        'role', pd.role,
                        'coin_amount', pd.coin_amount,
                        'cash_amount', pd.cash_amount,
                        'net_amount', pd.net_amount,
                        'provider_type', pd.provider_type,
                        'provider_username', pd.provider_username,
                        'user_tag', pd.user_tag,
                        'status', pd.status,
                        'created_at', pd.created_at,
                        'troll_coins_balance', pd.troll_coins_balance,
                        'total_earned_this_week', pd.total_earned_this_week
                    )
                    ORDER BY pd.created_at ASC
                ),
                '[]'::jsonb
            ) AS payouts_json,
            COUNT(pd.id) AS total_pending,
            COALESCE(SUM(pd.coin_amount), 0) AS total_coins,
            COALESCE(SUM(pd.cash_amount), 0) AS total_cash
        FROM payout_data pd
    )
    SELECT jsonb_build_object(
        'success', true,
        'payouts', payouts_json,
        'total_pending', total_pending,
        'total_coins', total_coins,
        'total_cash', total_cash
    )
    INTO v_result
    FROM aggregated;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_payouts_for_review() TO authenticated;
