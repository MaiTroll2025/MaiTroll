-- Secure Shop Functions
-- These functions handle coin deduction and item granting atomically, bypassing the coin protection trigger.

-- 1. Buy Entrance Effect
CREATE OR REPLACE FUNCTION public.shop_buy_entrance_effect(
    p_user_id uuid,
    p_effect_id text,
    p_cost int,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_spend_result jsonb;
BEGIN
    -- 1. Deduct Coins (Securely)
    v_spend_result := public.troll_bank_spend_coins_secure(
        p_user_id,
        p_cost,
        'paid',
        'entrance_effect',
        NULL,
        p_metadata
    );

    IF (v_spend_result->>'success')::boolean = false THEN
        RETURN v_spend_result;
    END IF;

    -- 2. Grant Effect
    INSERT INTO public.user_entrance_effects (user_id, effect_id)
    VALUES (p_user_id, p_effect_id)
    ON CONFLICT (user_id, effect_id) DO NOTHING;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. Buy Insurance
CREATE OR REPLACE FUNCTION public.shop_buy_insurance(
    p_user_id uuid,
    p_plan_id text,
    p_cost int,
    p_duration_hours int,
    p_protection_type text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_spend_result jsonb;
    v_expires_at timestamptz;
BEGIN
    -- 1. Deduct Coins
    v_spend_result := public.troll_bank_spend_coins_secure(
        p_user_id,
        p_cost,
        'paid',
        'insurance_purchase',
        NULL,
        p_metadata
    );

    IF (v_spend_result->>'success')::boolean = false THEN
        RETURN v_spend_result;
    END IF;

    -- 2. Grant Insurance
    v_expires_at := NOW() + (p_duration_hours || ' hours')::interval;

    INSERT INTO public.user_insurances (
        user_id,
        insurance_id,
        expires_at,
        is_active,
        protection_type,
        metadata
    ) VALUES (
        p_user_id,
        p_plan_id,
        v_expires_at,
        true,
        p_protection_type,
        p_metadata
    );

    RETURN jsonb_build_object('success', true, 'expires_at', v_expires_at);
END;
$$;

-- 3. Buy Call Sound
CREATE OR REPLACE FUNCTION public.shop_buy_call_sound(
    p_user_id uuid,
    p_sound_id text,
    p_cost int,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_spend_result jsonb;
BEGIN
    -- 1. Deduct Coins
    v_spend_result := public.troll_bank_spend_coins_secure(
        p_user_id,
        p_cost,
        'paid',
        'chat_sound',
        NULL,
        p_metadata
    );

    IF (v_spend_result->>'success')::boolean = false THEN
        RETURN v_spend_result;
    END IF;

    -- 2. Grant Sound
    INSERT INTO public.user_call_sounds (user_id, sound_id, is_active)
    VALUES (p_user_id, p_sound_id, false)
    ON CONFLICT DO NOTHING;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Buy Call Minutes
CREATE OR REPLACE FUNCTION public.shop_buy_call_minutes(
    p_user_id uuid,
    p_package_id text,
    p_minutes int,
    p_cost int,
    p_type text, -- 'audio' or 'video'
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_spend_result jsonb;
BEGIN
    -- 1. Deduct Coins
    v_spend_result := public.troll_bank_spend_coins_secure(
        p_user_id,
        p_cost,
        'paid',
        'call_minutes',
        NULL,
        p_metadata
    );

    IF (v_spend_result->>'success')::boolean = false THEN
        RETURN v_spend_result;
    END IF;

    -- 2. Grant Minutes
    INSERT INTO public.call_minutes (user_id, audio_minutes, video_minutes, updated_at)
    VALUES (
        p_user_id, 
        CASE WHEN p_type = 'audio' THEN p_minutes ELSE 0 END,
        CASE WHEN p_type = 'video' THEN p_minutes ELSE 0 END,
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
        audio_minutes = call_minutes.audio_minutes + CASE WHEN EXCLUDED.audio_minutes > 0 THEN EXCLUDED.audio_minutes ELSE 0 END,
        video_minutes = call_minutes.video_minutes + CASE WHEN EXCLUDED.video_minutes > 0 THEN EXCLUDED.video_minutes ELSE 0 END,
        updated_at = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Purchase Broadcast Theme (Atomic)
CREATE OR REPLACE FUNCTION public.shop_buy_broadcast_theme(
    p_user_id uuid,
    p_theme_id text,
    p_cost int,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_spend_result jsonb;
BEGIN
    -- 1. Check if already owned
    IF EXISTS (
        SELECT 1 FROM public.user_broadcast_theme_purchases
        WHERE user_id = p_user_id AND theme_id = p_theme_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already owned');
    END IF;

    -- 2. Deduct Coins
    v_spend_result := public.troll_bank_spend_coins_secure(
        p_user_id,
        p_cost,
        'paid',
        'broadcast_theme_purchase',
        NULL,
        p_metadata
    );

    IF (v_spend_result->>'success')::boolean = false THEN
        RETURN v_spend_result;
    END IF;

    -- 3. Grant Theme
    INSERT INTO public.user_broadcast_theme_purchases (user_id, theme_id, purchased_at, cost)
    VALUES (p_user_id, p_theme_id, NOW(), p_cost);

    RETURN jsonb_build_object('success', true);
END;
$$;
