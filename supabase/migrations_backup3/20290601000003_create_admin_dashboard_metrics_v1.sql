-- Fix: create get_admin_dashboard_metrics_v1 RPC expected by frontend useAdminDashboardMetrics.ts
-- The frontend calls this RPC (no arguments) to get admin dashboard metrics.
-- This wrapper delegates to the existing get_admin_finance_summary_live() which has proper admin checks.
-- Security: only users passing is_bug_center_staff() can get meaningful data.

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics_v1()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_finance JSONB;
    v_result JSONB;
BEGIN
    -- Delegate to the existing production RPC that has full admin authorization checks
    v_finance := public.get_admin_finance_summary_live();

    -- Return only the fields the non-admin frontend expects, with safe defaults
    -- This ensures non-admin users calling this RPC get zeros, not real data
    -- because get_admin_finance_summary_live already gates on is_bug_center_staff()
    v_result := jsonb_build_object(
        'success', true,
        'total_users', COALESCE((v_finance->>'total_users')::integer, 0),
        'coin_revenue', COALESCE((v_finance->>'coin_sales_revenue')::numeric, 0),
        'coins_sold', COALESCE((v_finance->>'purchased_coins')::bigint, 0),
        'platform_profit', COALESCE((v_finance->>'platform_profit')::numeric, 0),
        'coins_in_circulation', COALESCE((v_finance->>'total_troll_coins')::bigint, 0),
        'gift_coins', COALESCE((v_finance->>'gift_coins')::bigint, 0),
        'total_liability_coins', COALESCE((v_finance->>'total_liability_coins')::bigint, 0),
        'kick_ban_revenue', COALESCE((v_finance->>'kick_ban_revenue')::numeric, 0),
        'total_payouts', COALESCE((v_finance->>'total_payouts')::numeric, 0),
        'fees_collected', COALESCE((v_finance->>'fees_collected')::numeric, 0),
        'free_coins', COALESCE((v_finance->>'free_coins')::bigint, 0),
        'earned_coins', COALESCE((v_finance->>'earned_coins')::bigint, 0),
        'admin_count', COALESCE((v_finance->>'admin_count')::integer, 0),
        'troll_officer_count', COALESCE((v_finance->>'troll_officer_count')::integer, 0),
        'pending_applications', COALESCE((v_finance->>'pending_applications')::integer, 0),
        'pending_payouts', COALESCE((v_finance->>'pending_payouts')::integer, 0),
        'ai_flag_count', COALESCE((v_finance->>'ai_flag_count')::integer, 0),
        'last_updated', now()
    );

    RETURN v_result;
END;
$$;

-- Grant to authenticated users; the underlying RPC enforces admin-only access
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics_v1 TO authenticated;
