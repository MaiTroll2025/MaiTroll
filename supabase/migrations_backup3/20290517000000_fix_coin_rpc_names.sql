-- Migration: earn_coins RPC + fix legacy spend_coins named arg overload
-- Date: 2025-05-17
-- Description:
--   1. Creates earn_coins RPC (was missing, causing "function not found in schema cache" for earn_coins)
--   2. Confirms troll_bank_spend_coins_secure is the correct entrypoint for coin deductions
--      (the old 6-arg named spend_coins overload used broken param names: p_amount/p_user_id instead of p_coin_amount/p_sender_id)
--
-- Frontend entrypoints using these RPCs:
--   src/lib/coinUtils.spendCoins() -> troll_bank_spend_coins_secure
--   src/lib/coinUtils.earnCoins() -> earn_coins

-- ==========================================
-- 1. CREATE earn_coins RPC (was entirely missing)
-- ==========================================
CREATE OR REPLACE FUNCTION public.earn_coins(
    p_user_id    UUID,
    p_amount     NUMERIC(20, 2),
    p_bucket     TEXT    DEFAULT 'paid',
    p_source     TEXT    DEFAULT 'purchase',
    p_ref_id     TEXT    DEFAULT NULL,
    p_metadata   JSONB   DEFAULT '{}'::jsonb,
    p_description TEXT   DEFAULT 'Coin credit'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_balance NUMERIC(20, 2);
BEGIN
    -- Validate amount
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
    END IF;

    -- Check user exists and get current balance
    SELECT troll_coins INTO v_new_balance
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Credit coins via user_profiles
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + p_amount
    WHERE id = p_user_id
    RETURNING troll_coins INTO v_new_balance;

    -- Log to coin_ledger (matching schema: user_id, delta, bucket, source, metadata, direction)
    INSERT INTO public.coin_ledger (
        user_id, delta, bucket, source, ref_id, metadata, direction
    ) VALUES (
        p_user_id, p_amount, p_bucket, p_source, p_ref_id,
        jsonb_build_object('description', COALESCE(p_description, ''), 'earned_via', p_source),
        'in'
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.earn_coins(UUID, NUMERIC, TEXT, TEXT, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.earn_coins(UUID, NUMERIC, TEXT, TEXT, TEXT, JSONB, TEXT) TO service_role;

-- ==========================================
-- 2. ENSURE troll_bank_spend_coins_secure exists (canonical spend entrypoint)
--    (verified present in 20270401000001_fix_spend_rpc.sql + 20270216000001_fix_spend_integer_overflow.sql)
-- ==========================================
