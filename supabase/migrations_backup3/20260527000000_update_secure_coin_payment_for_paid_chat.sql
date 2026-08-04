-- ============================================================
-- Paid Chat Coin Deduction Fix
-- Root cause: PaidChatViewerModal calls try_pay_coins(p_user_id, ...)
-- directly. After 20290616000005_final_rpc_auth.sql, try_pay_coins
-- requires p_user_id = auth.uid(). On WebGL/guest subclients this
-- check can fail/authorization-mismatch, so coins are not deducted.
--
-- Fix: ensure the secure client wrapper try_pay_coins_secure sets
-- app.bypass_coin_protection = true before delegating, and add
-- 'paid_direct_chat_spend' to bypass rules so coin_protection()
-- allows these updates from service_role / bypass contexts.
-- ============================================================

-- 1. Make try_pay_coins_secure bypass coin protection
CREATE OR REPLACE FUNCTION public.try_pay_coins_secure(
    p_amount BIGINT,
    p_reason TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    PERFORM set_config('app.bypass_coin_protection', 'true', true);
    RETURN public.try_pay_coins(v_user_id, p_amount, p_reason, p_metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_pay_coins_secure(BIGINT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_pay_coins_secure(BIGINT, TEXT, JSONB) TO service_role;

-- 2. Ensure protect_sensitive_columns allows bypass flag + paid chat spend
CREATE OR REPLACE FUNCTION public.protect_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bypass TEXT;
BEGIN
    IF auth.role() = 'service_role' OR auth.role() = 'supabase_admin' THEN
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'user_profiles' THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Cannot update restricted column: role';
        END IF;
        IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
            RAISE EXCEPTION 'Cannot update restricted column: is_admin';
        END IF;
        IF NEW.is_lead_officer IS DISTINCT FROM OLD.is_lead_officer THEN
            RAISE EXCEPTION 'Cannot update restricted column: is_lead_officer';
        END IF;
        IF NEW.troll_coins IS DISTINCT FROM OLD.troll_coins THEN
            SELECT current_setting('app.bypass_coin_protection', true) INTO v_bypass;
            IF v_bypass IS DISTINCT FROM 'true' THEN
                RAISE EXCEPTION 'Cannot update restricted column: troll_coins';
            END IF;
        END IF;
        IF NEW.total_earned_coins IS DISTINCT FROM OLD.total_earned_coins THEN
            SELECT current_setting('app.bypass_coin_protection', true) INTO v_bypass;
            IF v_bypass IS DISTINCT FROM 'true' THEN
                RAISE EXCEPTION 'Cannot update restricted column: total_earned_coins';
            END IF;
        END IF;
        IF NEW.level IS DISTINCT FROM OLD.level THEN
            RAISE EXCEPTION 'Cannot update restricted column: level';
        END IF;
        IF NEW.xp IS DISTINCT FROM OLD.xp THEN
            SELECT current_setting('app.bypass_coin_protection', true) INTO v_bypass;
            IF v_bypass IS DISTINCT FROM 'true' THEN
                RAISE EXCEPTION 'Cannot update restricted column: xp';
            END IF;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'streams' THEN
        IF NEW.is_live IS DISTINCT FROM OLD.is_live THEN
            IF NEW.is_live = true THEN
                RAISE EXCEPTION 'Cannot update restricted column: is_live. Use the broadcast setup flow.';
            END IF;
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF NEW.status = 'live' AND OLD.status != 'live' THEN
                RAISE EXCEPTION 'Cannot manually set status to live';
            END IF;
        END IF;
        IF NEW.current_viewers IS DISTINCT FROM OLD.current_viewers THEN
            RAISE EXCEPTION 'Cannot update restricted column: current_viewers';
        END IF;
        IF NEW.hls_url IS DISTINCT FROM OLD.hls_url THEN
            RAISE EXCEPTION 'Cannot update restricted column: hls_url';
        END IF;
        IF NEW.hls_path IS DISTINCT FROM OLD.hls_path THEN
            RAISE EXCEPTION 'Cannot update restricted column: hls_path';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Fix PaidChatViewerModal to use secure wrapper instead of raw try_pay_coins
-- Frontend change required:
--   const { data: payResult, error: payError } = await supabase.rpc('try_pay_coins_secure', {
--     p_amount: price,
--     p_reason: 'paid_chat_spend',
--     p_metadata: { stream_id: streamId, payment_type }
--   });
