-- Fix submit_cashout_request RPC signature
-- The frontend (PastorPayouts.tsx) passes p_user_id as UUID but the deployed
-- function has p_amount_coins (integer) as the first parameter, causing:
--   invalid input syntax for type integer: "8dff9f37-21b5-4b8e-adc2-b9286874be1a"
-- Also adds p_payout_details parameter so PayPal email is stored correctly.

DROP FUNCTION IF EXISTS public.submit_cashout_request(UUID, BIGINT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.submit_cashout_request(UUID, BIGINT, NUMERIC, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.submit_cashout_request(
    p_user_id UUID,
    p_amount_coins BIGINT,
    p_usd_value NUMERIC,
    p_provider TEXT,
    p_delivery_method TEXT,
    p_payout_details TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req_id UUID;
    v_has_prior_payouts BOOLEAN;
    v_is_held BOOLEAN := false;
    v_held_reason TEXT := NULL;
    v_release_date TIMESTAMPTZ := NULL;
    v_is_new_user_hold BOOLEAN := false;
BEGIN
    -- Check for prior successful payouts to determine if new user hold applies
    SELECT EXISTS (
        SELECT 1 FROM public.cashout_requests 
        WHERE user_id = p_user_id 
        AND status IN ('paid', 'fulfilled')
    ) INTO v_has_prior_payouts;

    IF NOT v_has_prior_payouts THEN
        v_is_held := true;
        v_held_reason := 'New User 7 Day Hold';
        v_release_date := NOW() + INTERVAL '7 days';
        v_is_new_user_hold := true;
    END IF;

    -- Create Request
    INSERT INTO public.cashout_requests (
        user_id, 
        requested_coins, 
        usd_value, 
        payout_method, 
        payout_details, 
        status,
        is_held,
        held_reason,
        release_date,
        is_new_user_hold
    ) VALUES (
        p_user_id, 
        p_amount_coins, 
        p_usd_value, 
        p_provider, 
        COALESCE(p_payout_details, p_delivery_method),
        'pending',
        v_is_held,
        v_held_reason,
        v_release_date,
        v_is_new_user_hold
    ) RETURNING id INTO v_req_id;

    -- Lock Coins
    BEGIN
        PERFORM public.troll_bank_escrow_coins(p_user_id, p_amount_coins, v_req_id);
    EXCEPTION WHEN OTHERS THEN
        -- If escrow fails, delete the request and re-raise
        DELETE FROM public.cashout_requests WHERE id = v_req_id;
        RAISE EXCEPTION 'Failed to escrow coins: %', SQLERRM;
    END;

    RETURN jsonb_build_object('success', true, 'request_id', v_req_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_cashout_request(UUID, BIGINT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_cashout_request(UUID, BIGINT, NUMERIC, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_cashout_request(UUID, BIGINT, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
