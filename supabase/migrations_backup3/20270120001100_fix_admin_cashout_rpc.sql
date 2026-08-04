-- Fix troll_bank_finalize_cashout to use cashout_requests
CREATE OR REPLACE FUNCTION public.troll_bank_finalize_cashout(
    p_request_id UUID,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
    v_is_admin BOOLEAN;
BEGIN
    -- Check admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_admin_id AND (role = 'admin' OR is_admin = true OR role = 'secretary')
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN RAISE EXCEPTION 'Access denied'; END IF;

    SELECT * INTO v_req FROM public.cashout_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    
    -- If already paid, do nothing
    IF v_req.status = 'paid' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already paid');
    END IF;

    IF v_req.escrowed_coins <= 0 THEN 
         -- Already processed or no escrow?
         UPDATE public.cashout_requests SET status = 'paid', updated_at = NOW() WHERE id = p_request_id;
         RETURN jsonb_build_object('success', true, 'warning', 'No escrow coins burned');
    END IF;

    -- Burn from escrow: -amount from 'escrow'. No +amount anywhere (coins leave system).
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, reason)
    VALUES 
    (v_req.user_id, -v_req.escrowed_coins, 'escrow', 'cashout_finalized', p_request_id::text, 'Cashout Paid');

    -- Update request
    UPDATE public.cashout_requests
    SET escrowed_coins = 0, status = 'paid', updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Deny Cashout
CREATE OR REPLACE FUNCTION public.troll_bank_deny_cashout(
    p_request_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
    v_is_admin BOOLEAN;
BEGIN
    -- Check admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_admin_id AND (role = 'admin' OR is_admin = true OR role = 'secretary')
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN RAISE EXCEPTION 'Access denied'; END IF;

    SELECT * INTO v_req FROM public.cashout_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    
    IF v_req.status = 'denied' OR v_req.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already denied/cancelled');
    END IF;

    IF v_req.escrowed_coins > 0 THEN
        -- Move back: -amount from 'escrow', +amount to 'paid'
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, reason)
        VALUES 
        (v_req.user_id, -v_req.escrowed_coins, 'escrow', 'cashout_denied', p_request_id::text, 'Cashout Denied: ' || COALESCE(p_reason, 'No reason provided')),
        (v_req.user_id, v_req.escrowed_coins, 'paid', 'cashout_denied', p_request_id::text, 'Cashout Denied: ' || COALESCE(p_reason, 'No reason provided'));
    END IF;

    -- Update request
    UPDATE public.cashout_requests
    SET escrowed_coins = 0, status = 'denied', updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
