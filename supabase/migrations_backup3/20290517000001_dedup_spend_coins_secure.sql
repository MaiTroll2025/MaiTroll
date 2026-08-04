-- Migration: Deduplicate troll_bank_spend_coins_secure overloads
-- Date: 2025-05-17
-- Problem: Three different overloads were registered in the schema cache, causing
--          "Could not choose the best candidate function" errors:
--   1. (p_amount bigint, p_bucket text, p_metadata jsonb, p_ref_id uuid, p_source text, p_user_id uuid) — wrong parameter order
--   2. (p_user_id uuid, p_amount numeric, p_bucket text, p_source text, p_ref_id text, p_metadata jsonb)
--   3. (p_user_id uuid, p_amount numeric, p_bucket text, p_source text, p_ref_id uuid, p_metadata jsonb)
--
-- Fix:
--   DROP ALL old overloads (native int, wrong-parameter-order, mismatched ref_id types)
--   Recreate ONE canonical version with UUID p_ref_id and numeric p_amount
--
-- Also upgrade troll_bank_spend_coins (base function) to numeric for consistency

-- ==========================================
-- 0. DROP ALL STALE OVERLOADS
-- ==========================================

-- troll_bank_spend_coins base: drop old int overloads
DROP FUNCTION IF EXISTS public.troll_bank_spend_coins(uuid, int, text, text, text, jsonb);
-- troll_bank_spend_coins_secure: drop all non-canonical overloads
DROP FUNCTION IF EXISTS public.troll_bank_spend_coins_secure(uuid, bigint, text, text, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.troll_bank_spend_coins_secure(uuid, numeric, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.troll_bank_spend_coins_secure(uuid, int, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.troll_bank_spend_coins_secure(uuid, int, text, text, uuid, jsonb);
-- Drop base also with wrong param order (wrong-named-args overload)
DROP FUNCTION IF EXISTS public.troll_bank_spend_coins(bigint, text, jsonb, uuid, text, uuid);

-- ==========================================
-- 1. RECREATE BASE: troll_bank_spend_coins
--    Canonical: numeric amount, uuid ref_id
-- ==========================================
CREATE OR REPLACE FUNCTION public.troll_bank_spend_coins(
    p_user_id   uuid,
    p_amount    numeric,
    p_bucket    text    DEFAULT 'paid',
    p_source    text    DEFAULT 'purchase',
    p_ref_id    uuid    DEFAULT NULL,
    p_metadata  jsonb   DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_balance numeric(20, 2);
    v_new_balance     numeric(20, 2);
    v_ledger_id       uuid;
BEGIN
    -- Validate amount
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
    END IF;

    -- Lock user profile and check balance
    SELECT troll_coins INTO v_current_balance
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    IF v_current_balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient funds',
            'current_balance', v_current_balance
        );
    END IF;

    -- Deduct coins
    v_new_balance := v_current_balance - p_amount;

    UPDATE public.user_profiles
    SET troll_coins = v_new_balance
    WHERE id = p_user_id;

    -- Insert into ledger (negative delta)
    INSERT INTO public.coin_ledger (
        user_id, delta, bucket, source, ref_id, metadata, direction
    ) VALUES (
        p_user_id,
        -p_amount,
        p_bucket,
        p_source,
        p_ref_id,
        p_metadata,
        'out'
    ) RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance,
        'ledger_id', v_ledger_id
    );
END;
$$;

-- Connection wrapper (kept for internal callers)
CREATE OR REPLACE FUNCTION public.troll_bank_spend_coins_secure(
    p_user_id   uuid,
    p_amount    numeric,
    p_bucket    text    DEFAULT 'paid',
    p_source    text    DEFAULT 'purchase',
    p_ref_id    uuid    DEFAULT NULL,
    p_metadata  jsonb   DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
    v_target_bucket text := 'Treasury';
BEGIN
    -- Check if caller is the user or service role
    IF auth.uid() != p_user_id AND auth.role() != 'service_role' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    v_result := public.troll_bank_spend_coins(
        p_user_id, p_amount, p_bucket, p_source, p_ref_id, p_metadata
    );

    IF COALESCE((v_result->>'success')::boolean, false) = false THEN
        RETURN v_result;
    END IF;

    -- Route certain purchases to Officer Pay bucket
    IF p_source IN ('perk_purchase', 'insurance_purchase', 'entrance_effect',
                    'call_minutes', 'broadcast_theme_purchase') THEN
        v_target_bucket := 'Officer Pay';
    ELSIF p_source = 'store_purchase' THEN
        IF p_metadata ? 'item_type' THEN
            IF p_metadata->>'item_type' IN ('perk', 'insurance', 'effect') THEN
                v_target_bucket := 'Officer Pay';
            END IF;
        END IF;
    END IF;

    -- Credit Treasury / Officer Pay bucket (shared pool tracking)
    BEGIN
        INSERT INTO public.admin_allocation_buckets (bucket_name)
        VALUES (v_target_bucket)
        ON CONFLICT DO NOTHING;

        UPDATE public.admin_allocation_buckets
        SET balance_coins = balance_coins + p_amount
        WHERE bucket_name = v_target_bucket;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN v_result;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.troll_bank_spend_coins(uuid, numeric, text, text, uuid, jsonb)
    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.troll_bank_spend_coins_secure(uuid, numeric, text, text, uuid, jsonb)
    TO authenticated, service_role;
