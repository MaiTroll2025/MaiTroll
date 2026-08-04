-- Admin Allocations & Settings
CREATE TABLE IF NOT EXISTS public.admin_pool_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_name TEXT NOT NULL UNIQUE,
    balance_coins BIGINT DEFAULT 0,
    target_coins BIGINT DEFAULT 0, -- For provider targets
    metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed buckets
INSERT INTO public.admin_pool_buckets (bucket_name)
VALUES ('Officer Pay'), ('Provider Pay'), ('Treasury')
ON CONFLICT (bucket_name) DO NOTHING;

-- Ensure clean slate for settings if schema mismatch
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_app_settings') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_app_settings' AND column_name = 'setting_key') THEN
            -- Schema mismatch (e.g. old 'key' column), drop to recreate
            DROP TABLE public.admin_app_settings;
        END IF;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.admin_app_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed settings
INSERT INTO public.admin_app_settings (setting_key, setting_value, description)
VALUES 
('coin_usd_rate', '0.0045', 'Value of 1 coin in USD for display'),
('officer_pay_rate', '1000', 'Coins per officer per pay period'),
('provider_costs', '{"Vercel": 5000, "Supabase": 5000, "Ionos": 2000}', 'Monthly provider costs in coins')
ON CONFLICT (setting_key) DO NOTHING;

-- Add escrow column to payout_requests if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payout_requests' AND column_name = 'escrowed_coins') THEN
        ALTER TABLE public.payout_requests ADD COLUMN escrowed_coins BIGINT DEFAULT 0;
    END IF;
END $$;

-- RPC: Escrow Coins for Cashout
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
    -- Check available balance (paid + gifted + promo - escrow)
    -- We assume 'paid', 'gifted', 'promo' are spendable. 'escrow', 'loan', 'repayment' are not (or handled differently).
    -- But actually, 'loan' is money given to user, so it IS spendable.
    -- 'repayment' is money taken, so it reduces balance.
    -- 'escrow' is money taken/locked.
    -- So available = Sum(delta) where bucket != 'escrow' is incorrect if escrow is implemented as +delta in escrow bucket and -delta in paid bucket.
    -- If we move coins: -paid, +escrow. Then Total Sum = same.
    -- But 'Available' calculation in get_admin_user_wallets_secure was:
    -- (COALESCE(ls.total_balance, 0) - COALESCE(ls.escrow_balance, 0))
    -- This implies 'escrow_balance' is POSITIVE sum of 'escrow' bucket.
    -- If we do -paid, +escrow, then 'paid' decreases, 'escrow' increases.
    -- Total Balance remains same.
    -- Available = Total - Escrow.
    -- Example: 100 paid. Total=100. Escrow=0. Available=100.
    -- Move 50 to escrow: -50 paid, +50 escrow.
    -- Paid=50. Escrow=50. Total=100.
    -- Available = 100 - 50 = 50. Correct.
    
    SELECT 
        COALESCE(SUM(delta), 0) - COALESCE(SUM(CASE WHEN bucket = 'escrow' THEN delta ELSE 0 END), 0)
        INTO v_available
    FROM public.coin_ledger
    WHERE user_id = p_user_id;

    IF v_available < p_amount THEN
        RAISE EXCEPTION 'Insufficient funds for escrow';
    END IF;

    -- Insert ledger entry: Move to escrow
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, reason)
    VALUES 
    (p_user_id, -p_amount, 'paid', 'cashout_escrow_lock', p_request_id::text, 'Cashout Request Escrow'),
    (p_user_id, p_amount, 'escrow', 'cashout_escrow_lock', p_request_id::text, 'Cashout Request Escrow');

    -- Update request
    UPDATE public.payout_requests
    SET escrowed_coins = p_amount, status = 'pending'
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Release Escrow (Cancel/Deny)
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
    SELECT * INTO v_req FROM public.payout_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    
    IF v_req.escrowed_coins <= 0 THEN
        RETURN jsonb_build_object('success', true, 'message', 'No coins to release');
    END IF;

    -- Move back: -amount from 'escrow', +amount to 'paid'
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, reason)
    VALUES 
    (v_req.user_id, -v_req.escrowed_coins, 'escrow', 'cashout_escrow_release', p_request_id::text, 'Cashout Request Cancelled/Denied'),
    (v_req.user_id, v_req.escrowed_coins, 'paid', 'cashout_escrow_release', p_request_id::text, 'Cashout Request Cancelled/Denied');

    -- Update request
    UPDATE public.payout_requests
    SET escrowed_coins = 0, status = 'cancelled'
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Finalize Cashout (Paid)
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
    SELECT * INTO v_req FROM public.payout_requests WHERE id = p_request_id;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
    IF v_req.escrowed_coins <= 0 THEN 
         -- Already processed or no escrow?
         -- Assume safe to mark paid if status matches?
         UPDATE public.payout_requests SET status = 'paid', updated_at = NOW() WHERE id = p_request_id;
         RETURN jsonb_build_object('success', true, 'warning', 'No escrow coins burned');
    END IF;

    -- Burn from escrow: -amount from 'escrow'. No +amount anywhere (coins leave system).
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, ref_id, reason)
    VALUES 
    (v_req.user_id, -v_req.escrowed_coins, 'escrow', 'cashout_finalized', p_request_id::text, 'Cashout Paid');

    -- Update request
    UPDATE public.payout_requests
    SET escrowed_coins = 0, status = 'paid', updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Admin Move Allocations
CREATE OR REPLACE FUNCTION public.admin_move_allocations(
    p_from_bucket TEXT,
    p_to_bucket TEXT,
    p_amount BIGINT,
    p_reason TEXT,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_from_bal BIGINT;
    v_is_admin BOOLEAN;
BEGIN
    -- Check admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_admin_id AND (role = 'admin' OR is_admin = true OR role = 'secretary')
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT balance_coins INTO v_from_bal FROM public.admin_pool_buckets WHERE bucket_name = p_from_bucket;
    IF v_from_bal < p_amount THEN RAISE EXCEPTION 'Insufficient funds in source bucket'; END IF;

    UPDATE public.admin_pool_buckets SET balance_coins = balance_coins - p_amount WHERE bucket_name = p_from_bucket;
    UPDATE public.admin_pool_buckets SET balance_coins = balance_coins + p_amount WHERE bucket_name = p_to_bucket;

    -- Audit Log
    INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at) 
    VALUES (p_amount, 'Moved ' || p_amount || ' from ' || p_from_bucket || ' to ' || p_to_bucket || ': ' || p_reason, p_admin_id, NOW());

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Update Settings
CREATE OR REPLACE FUNCTION public.admin_update_setting(
    p_key TEXT,
    p_value JSONB,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    -- Check admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_admin_id AND (role = 'admin' OR is_admin = true OR role = 'secretary')
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    INSERT INTO public.admin_app_settings (setting_key, setting_value, updated_at)
    VALUES (p_key, p_value, NOW())
    ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Update troll_bank_spend_coins_secure to credit Treasury
CREATE OR REPLACE FUNCTION public.troll_bank_spend_coins_secure(
    p_user_id uuid,
    p_amount int,
    p_bucket text DEFAULT 'paid',
    p_source text DEFAULT 'purchase',
    p_ref_id text DEFAULT NULL::text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
    v_target_bucket text := 'Treasury';
BEGIN
    IF auth.uid() != p_user_id AND auth.role() <> 'service_role' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    v_result := troll_bank_spend_coins(p_user_id, p_amount, p_bucket, p_source, p_ref_id, p_metadata);

    IF COALESCE((v_result->>'success')::boolean, false) = false THEN
        RETURN v_result;
    END IF;

    IF p_source IN ('perk_purchase', 'insurance_purchase', 'entrance_effect', 'call_minutes', 'broadcast_theme_purchase') THEN
        v_target_bucket := 'Officer Pay';
    ELSIF p_source = 'store_purchase' THEN
        IF p_metadata ? 'item_type' THEN
            IF p_metadata->>'item_type' IN ('perk', 'insurance', 'effect') THEN
                v_target_bucket := 'Officer Pay';
            END IF;
        END IF;
    ELSE
        v_target_bucket := 'Treasury';
    END IF;

    INSERT INTO public.admin_pool_buckets (bucket_name) VALUES (v_target_bucket) ON CONFLICT (bucket_name) DO NOTHING;

    UPDATE public.admin_pool_buckets
    SET balance_coins = balance_coins + p_amount,
        updated_at = NOW()
    WHERE bucket_name = v_target_bucket;

    RETURN v_result;
END;
$$;
