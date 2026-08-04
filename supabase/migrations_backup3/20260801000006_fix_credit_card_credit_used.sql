-- Fix: Update credit_used in user_profiles when a credit card purchase is made
-- The try_pay_with_credit_card RPC was not updating credit_used, causing the
-- available credit to always show as the full limit (e.g., $250) even after spending.

CREATE OR REPLACE FUNCTION public.get_credit_tier(p_score INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF p_score >= 750 THEN RETURN 'Excellent';
    ELSIF p_score >= 700 THEN RETURN 'Very Good';
    ELSIF p_score >= 650 THEN RETURN 'Good';
    ELSIF p_score >= 600 THEN RETURN 'Fair';
    ELSE RETURN 'Poor';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_credit_tier(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.try_pay_with_credit_card(
    p_user_id UUID,
    p_amount BIGINT,
    p_context TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_allowed_contexts TEXT[] := ARRAY['shop_purchase', 'vehicle_purchase', 'insurance_payment', 'platform_fee', 'consumable_purchase'];
    v_forbidden_contexts TEXT[] := ARRAY['gift', 'transfer', 'rent', 'p2p_purchase', 'tip', 'payout'];
    v_charged BIGINT;
    v_description TEXT;
    v_balance BIGINT;
    v_limit BIGINT;
BEGIN
    -- Validate context
    IF p_context = ANY(v_forbidden_contexts) THEN
        RETURN FALSE;
    END IF;
    IF NOT (p_context = ANY(v_allowed_contexts)) THEN
        RETURN FALSE;
    END IF;

    BEGIN
        v_description := 'Credit Card: ' || COALESCE(p_context, 'purchase');

        -- Ensure user_credit row exists
        INSERT INTO public.user_credit (user_id, score, tier, trend_7d, loan_reliability)
        VALUES (p_user_id, 400, 'Building', 0, 0)
        ON CONFLICT (user_id) DO NOTHING;

        -- Check available credit
        SELECT uc.balance, uc.credit_limit INTO v_balance, v_limit
        FROM public.user_credit uc
        WHERE uc.user_id = p_user_id;

        IF v_balance IS NULL THEN v_balance := 0; END IF;
        IF v_limit IS NULL THEN v_limit := 250; END IF;

        IF (v_limit - v_balance) < p_amount THEN
            RETURN FALSE;
        END IF;

        -- Deduct from credit balance
        UPDATE public.user_credit
           SET balance = balance + p_amount,
               updated_at = NOW()
         WHERE user_id = p_user_id;

        v_charged := p_amount;

        -- Log to coin_ledger (no coin change, just record the credit spend)
        INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, metadata)
        VALUES (
            p_user_id,
            0,
            'credit_spend',
            'credit_card',
            v_description,
            p_metadata || jsonb_build_object('principal', v_charged, 'context', p_context)
        );

        -- Credit score penalty for using credit (smaller than before — only -5)
        INSERT INTO public.credit_events (user_id, event_type, delta, event_key, metadata)
        VALUES (
            p_user_id,
            'credit_cc_purchase',
            -5,
            'cc_purchase:' || p_user_id::text || ':' || EXTRACT(EPOCH FROM NOW())::bigint,
            jsonb_build_object('principal', v_charged, 'context', p_context)
        );

        -- Recalculate score
        UPDATE public.user_credit uc
           SET score = GREATEST(0, LEAST(400 + e.net_delta, 800)),
               tier = public.get_credit_tier(GREATEST(0, LEAST(400 + e.net_delta, 800))),
               updated_at = NOW(),
               last_event_at = NOW()
         FROM (SELECT user_id, SUM(delta) AS net_delta
                 FROM public.credit_events
                WHERE user_id = p_user_id
                GROUP BY user_id) e
         WHERE uc.user_id = e.user_id;

        UPDATE public.user_profiles
           SET credit_score = (SELECT score FROM public.user_credit WHERE user_id = p_user_id)
         WHERE id = p_user_id;

        -- FIX: Increment credit_used to track how much credit has been spent
        UPDATE public.user_profiles
           SET credit_used = COALESCE(credit_used, 0) + v_charged
         WHERE id = p_user_id;

        RETURN TRUE;
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_pay_with_credit_card(UUID, BIGINT, TEXT, JSONB) TO authenticated;