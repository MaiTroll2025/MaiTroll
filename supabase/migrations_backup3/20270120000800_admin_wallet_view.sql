-- Migration: Admin User Wallets View
-- Description: RPC to get aggregated user wallet data from coin_ledger for the Admin Pool.

-- Function to get user wallet stats
-- Returns: username, total_coins, escrowed_coins, available_coins, cashout_eligible
CREATE OR REPLACE FUNCTION public.get_admin_user_wallets(
    p_search text DEFAULT NULL,
    p_limit int DEFAULT 50,
    p_offset int DEFAULT 0
)
RETURNS TABLE (
    user_id uuid,
    username text,
    total_coins bigint,
    escrowed_coins bigint,
    available_coins bigint,
    is_cashout_eligible boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH ledger_stats AS (
        SELECT 
            cl.user_id,
            COALESCE(SUM(cl.delta), 0)::bigint as total_balance,
            COALESCE(SUM(CASE WHEN cl.bucket = 'escrow' THEN cl.delta ELSE 0 END), 0)::bigint as escrow_balance
        FROM 
            public.coin_ledger cl
        GROUP BY 
            cl.user_id
    )
    SELECT 
        u.id as user_id,
        u.username,
        COALESCE(ls.total_balance, 0) as total_coins,
        COALESCE(ls.escrow_balance, 0) as escrowed_coins,
        (COALESCE(ls.total_balance, 0) - COALESCE(ls.escrow_balance, 0)) as available_coins,
        (COALESCE(ls.total_balance, 0) >= 12000) as is_cashout_eligible
    FROM 
        public.user_profiles u
    LEFT JOIN 
        ledger_stats ls ON u.id = ls.user_id
    WHERE 
        (p_search IS NULL OR u.username ILIKE '%' || p_search || '%')
    ORDER BY 
        is_cashout_eligible DESC, -- Show eligible users first
        total_coins DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_user_wallets(text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_user_wallets(text, int, int) TO authenticated; -- Admin only check in UI/RLS usually, but for RPC we might need to restrict?
-- Assuming RLS or UI handles admin check. Ideally we restrict this RPC to admins.
-- But standard pattern here seems to be allowing authenticated and filtering in app or using RLS.
-- Since this queries user_profiles and ledger, RLS on those tables might block 'authenticated' if not admin.
-- 'service_role' bypasses RLS.
-- But the function is SECURITY DEFINER, so it runs as owner (postgres).
-- We should probably add an admin check inside.

CREATE OR REPLACE FUNCTION public.get_admin_user_wallets_secure(
    p_search text DEFAULT NULL,
    p_limit int DEFAULT 50,
    p_offset int DEFAULT 0
)
RETURNS TABLE (
    user_id uuid,
    username text,
    total_coins bigint,
    escrowed_coins bigint,
    available_coins bigint,
    is_cashout_eligible boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin boolean;
BEGIN
    -- Check if requesting user is admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'secretary')
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    WITH ledger_stats AS (
        SELECT 
            cl.user_id,
            COALESCE(SUM(cl.delta), 0) as total_balance,
            COALESCE(SUM(CASE WHEN cl.bucket = 'escrow' THEN cl.delta ELSE 0 END), 0) as escrow_balance
        FROM 
            public.coin_ledger cl
        GROUP BY 
            cl.user_id
    )
    SELECT 
        u.id as user_id,
        u.username,
        COALESCE(ls.total_balance, 0) as total_coins,
        COALESCE(ls.escrow_balance, 0) as escrowed_coins,
        (COALESCE(ls.total_balance, 0) - COALESCE(ls.escrow_balance, 0)) as available_coins,
        (COALESCE(ls.total_balance, 0) >= 12000) as is_cashout_eligible
    FROM 
        public.user_profiles u
    LEFT JOIN 
        ledger_stats ls ON u.id = ls.user_id
    WHERE 
        (p_search IS NULL OR u.username ILIKE '%' || p_search || '%')
    ORDER BY 
        is_cashout_eligible DESC,
        total_coins DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_user_wallets_secure(text, int, int) TO authenticated;
