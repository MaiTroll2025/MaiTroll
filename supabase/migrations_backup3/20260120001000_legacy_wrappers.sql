-- Migration to replace legacy coin credit functions with Troll Bank wrappers
-- This ensures all legacy code paths automatically use the new centralized pipeline
-- with repayment rules, ledger logging, and consistency checks.

-- 1. Wrapper for add_troll_coins (used in levelStore.ts)
DROP FUNCTION IF EXISTS public.add_troll_coins(uuid, int);

CREATE OR REPLACE FUNCTION public.add_troll_coins(
    user_id uuid,
    amount int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
BEGIN
    -- Call the centralized Troll Bank function
    -- Default bucket to 'paid' (or 'promo' if we want to be safe, but level rewards usually feel 'earned')
    -- Let's use 'promo' for level rewards as they are 'free' money essentially.
    -- However, legacy behavior might expect them to be spendable everywhere. 
    -- 'paid' bucket is safest for general compatibility, but 'promo' is better for economy.
    -- Let's stick to 'promo' for rewards to distinguish from purchased coins.
    
    SELECT public.troll_bank_credit_coins(
        user_id,
        amount,
        'promo',  -- Level up rewards are promotional
        'level_reward',
        NULL,     -- No external ref ID
        jsonb_build_object('legacy_function', 'add_troll_coins')
    ) INTO v_result;
END;
$$;

-- 2. Wrapper for add_free_coins (used in TrollSurprise.tsx)
DROP FUNCTION IF EXISTS public.add_free_coins(uuid, int);

CREATE OR REPLACE FUNCTION public.add_free_coins(
    p_user_id uuid,
    p_amount int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        p_amount,
        'promo',
        'troll_surprise',
        NULL,
        jsonb_build_object('legacy_function', 'add_free_coins')
    ) INTO v_result;
END;
$$;

-- 3. Wrapper for credit_coins (common legacy name)
DROP FUNCTION IF EXISTS public.credit_coins(uuid, int, text);

CREATE OR REPLACE FUNCTION public.credit_coins(
    p_user_id uuid,
    p_amount int,
    p_reason text DEFAULT 'legacy_credit'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        p_amount,
        'paid', -- Assume paid for generic credit unless specified otherwise
        'legacy_credit',
        NULL,
        jsonb_build_object('reason', p_reason, 'legacy_function', 'credit_coins')
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 4. Ensure admin_grant_coins uses the pipeline if it exists
DROP FUNCTION IF EXISTS public.admin_grant_coins(uuid, int, text);

CREATE OR REPLACE FUNCTION public.admin_grant_coins(
    p_user_id uuid,
    p_amount int,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        p_amount,
        'promo', -- Admin grants are usually promo
        'admin_grant',
        NULL,
        jsonb_build_object('reason', p_reason)
    ) INTO v_result;

    RETURN v_result;
END;
$$;
