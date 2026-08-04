-- Fix Cashout Escrow to use cashout_requests table
-- and implement submit_cashout_request RPC

-- Drop functions to avoid return type conflicts
DROP FUNCTION IF EXISTS public.troll_bank_escrow_coins(UUID, BIGINT, UUID);
DROP FUNCTION IF EXISTS public.troll_bank_release_escrow(UUID, UUID);
DROP FUNCTION IF EXISTS public.troll_bank_finalize_cashout(UUID, UUID);
DROP FUNCTION IF EXISTS public.submit_cashout_request(UUID, BIGINT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.cancel_cashout_request(UUID, UUID);

-- Add escrow column to cashout_requests if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashout_requests' AND column_name = 'escrowed_coins') THEN
        ALTER TABLE public.cashout_requests ADD COLUMN escrowed_coins BIGINT DEFAULT 0;
    END IF;
END $$;

-- RPC: Escrow Coins for Cashout (Targeting cashout_requests)
CREATE OR REPLACE FUNCTION public.troll_bank_escrow_coins(
    p_user_id UUID,
    p_amount BIGINT,
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_available BIGINT;
BEGIN
    -- Check available balance
    SELECT 
        COALESCE(SUM(delta), 0) - COALESCE(SUM(CASE WHEN bucket = 'escrow' THEN delta ELSE 0 END), 0)
        INTO v_available
    FROM public.coin_ledger
    WHERE user_id = p_user_id;

    IF v_available < p_amount THEN
        RAISE EXCEPTION 'Insufficient funds for escrow';
    END IF;

    -- Insert ledger entry
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, reason)
    VALUES 
    (p_user_id, -p_amount, 'paid', 'cashout_escrow_lock', p_request_id::text, 'Cashout Request Escrow'),
    (p_user_id, p_amount, 'escrow', 'cashout_escrow_lock', p_request_id::text, 'Cashout Request Escrow');

    -- Update request
    UPDATE public.cashout_requests
    SET escrowed_coins = p_amount, status = 'pending'
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Release Escrow (Targeting cashout_requests)
CREATE OR REPLACE FUNCTION public.troll_bank_release_escrow(
    p_request_id UUID,
    p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
BEGIN
    SELECT * INTO v_req FROM public.cashout_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    
    IF v_req.escrowed_coins <= 0 THEN
        RETURN jsonb_build_object('success', true, 'message', 'No coins to release');
    END IF;

    -- Move back
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, reason)
    VALUES 
    (v_req.user_id, -v_req.escrowed_coins, 'escrow', 'cashout_escrow_release', p_request_id::text, 'Cashout Request Cancelled/Denied'),
    (v_req.user_id, v_req.escrowed_coins, 'paid', 'cashout_escrow_release', p_request_id::text, 'Cashout Request Cancelled/Denied');

    -- Update request
    UPDATE public.cashout_requests
    SET escrowed_coins = 0, status = 'cancelled'
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Finalize Cashout (Paid) (Targeting cashout_requests)
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
BEGIN
    SELECT * INTO v_req FROM public.cashout_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_req.escrowed_coins <= 0 THEN 
         UPDATE public.cashout_requests SET status = 'paid', updated_at = NOW() WHERE id = p_request_id;
         RETURN jsonb_build_object('success', true, 'warning', 'No escrow coins burned');
    END IF;

    -- Burn from escrow
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

-- RPC: Submit Cashout Request
CREATE OR REPLACE FUNCTION public.submit_cashout_request(
    p_user_id UUID,
    p_amount_coins BIGINT,
    p_usd_value NUMERIC,
    p_provider TEXT,
    p_delivery_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req_id UUID;
BEGIN
    -- Create Request
    INSERT INTO public.cashout_requests (
        user_id, requested_coins, usd_value, payout_method, payout_details, status
    ) VALUES (
        p_user_id, p_amount_coins, p_usd_value, p_provider, p_delivery_method, 'pending'
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

-- RPC: Cancel Cashout Request (User side)
CREATE OR REPLACE FUNCTION public.cancel_cashout_request(
    p_request_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
BEGIN
    SELECT * INTO v_req FROM public.cashout_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_req.user_id != p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF v_req.status != 'pending' THEN RAISE EXCEPTION 'Cannot cancel non-pending request'; END IF;

    PERFORM public.troll_bank_release_escrow(p_request_id);
    
    RETURN jsonb_build_object('success', true);
END;
$$;
