-- Fix troll_bank_spend_coins_secure signature to use NUMERIC for amount
-- This resolves issues with large amounts or type mismatches and aligns with client usage

CREATE OR REPLACE FUNCTION public.troll_bank_spend_coins_secure(
    p_user_id UUID,
    p_amount NUMERIC,
    p_bucket TEXT,
    p_source TEXT,
    p_ref_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- 1. Check balance
    SELECT troll_coins INTO v_balance
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE; -- Lock row

    IF v_balance IS NULL OR v_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- 2. Deduct
    v_new_balance := v_balance - p_amount;
    
    UPDATE public.user_profiles
    SET troll_coins = v_new_balance
    WHERE id = p_user_id;

    -- 3. Log to Ledger
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, metadata, direction)
    VALUES (p_user_id, -p_amount, p_bucket, p_source, p_ref_id, p_metadata, 'out');

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.troll_bank_spend_coins_secure(UUID, NUMERIC, TEXT, TEXT, UUID, JSONB) TO authenticated;
