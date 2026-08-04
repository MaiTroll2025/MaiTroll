-- Fix type mismatch in admin wallet view RPC
-- The previous version returned numeric for sums, causing a type mismatch error with the declared BIGINT return type.

DROP FUNCTION IF EXISTS public.get_admin_user_wallets_secure(text, int);
DROP FUNCTION IF EXISTS public.get_admin_user_wallets_secure(text, int, int); -- Drop potential variant with offset
DROP FUNCTION IF EXISTS public.get_admin_user_wallets_secure(); -- Drop parameterless variant if exists

CREATE OR REPLACE FUNCTION public.get_admin_user_wallets_secure(
    p_search text DEFAULT NULL,
    p_limit int DEFAULT 50
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
            -- Explicit casting to BIGINT to match return type
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
        -- Explicit casting in final selection
        COALESCE(ls.total_balance, 0)::bigint as total_coins,
        COALESCE(ls.escrow_balance, 0)::bigint as escrowed_coins,
        (COALESCE(ls.total_balance, 0) - COALESCE(ls.escrow_balance, 0))::bigint as available_coins,
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
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_user_wallets_secure(text, int) TO authenticated;
