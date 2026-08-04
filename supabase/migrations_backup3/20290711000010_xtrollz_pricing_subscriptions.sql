-- ============================================================
-- XTROLLZ PRICING UPDATE + STREAMER PRICES + VIEWER SUBSCRIPTIONS
-- - Streamer application fee: 1000 Troll Coins (was 100)
-- - Viewer subscription fee: 800 Troll Coins for 6 months
-- - Streamers can set custom prices/content descriptions
-- - Viewer subscription tracking with expiration
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Update application fee RPC for role-based pricing
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_pay_application_fee(
    p_application_id uuid,
    p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_application public.xtrollz_applications%ROWTYPE;
    v_spend_result jsonb;
    v_fee_amount numeric := 1000;
BEGIN
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    IF p_user_id <> auth.uid() AND NOT public.is_staff() THEN
        RAISE EXCEPTION 'Unauthorized: can only pay for your own application'
        USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_application
    FROM public.xtrollz_applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Application not found');
    END IF;

    IF v_application.user_id <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Application does not belong to user');
    END IF;

    IF v_application.payment_status = 'completed' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Application already paid');
    END IF;

    IF v_application.status NOT IN ('draft', 'payment_pending', 'payment_failed') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Application is not in a payable state');
    END IF;

    IF v_application.xtrollz_role = 'viewer' THEN
        v_fee_amount := 800;
    END IF;

    v_spend_result := public.troll_bank_spend_coins(
        p_user_id => p_user_id,
        p_amount => v_fee_amount,
        p_bucket => 'paid',
        p_source => 'xtrollz_application_fee',
        p_ref_id => p_application_id,
        p_metadata => jsonb_build_object('application_id', p_application_id, 'role', v_application.xtrollz_role, 'fee_amount', v_fee_amount)
    );

    IF NOT (v_spend_result->>'success')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', COALESCE(v_spend_result->>'error', 'Insufficient balance'),
            'amount_deducted', 0,
            'fee_amount', v_fee_amount
        );
    END IF;

    UPDATE public.xtrollz_applications
    SET
        status = 'submitted',
        payment_status = 'completed',
        payment_amount = v_fee_amount,
        payment_currency = 'TC',
        payment_timestamp = NOW(),
        updated_at = NOW()
    WHERE id = p_application_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Application fee paid successfully',
        'application_id', p_application_id,
        'amount_deducted', v_fee_amount,
        'new_balance', (v_spend_result->>'new_balance')::numeric,
        'fee_amount', v_fee_amount,
        'status', 'completed'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_pay_application_fee(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_pay_application_fee(uuid, uuid) TO service_role;

-- ============================================================
-- 2. xtrollz_stream_prices: streamer custom pricing/content
-- ============================================================

CREATE TABLE IF NOT EXISTS public.xtrollz_stream_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_price numeric(10,2) DEFAULT 800,
    private_show_price numeric(10,2) DEFAULT 500,
    tip_message_price numeric(10,2) DEFAULT 50,
    description text DEFAULT '',
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_xtrollz_stream_prices_user_id
    ON public.xtrollz_stream_prices(user_id);

ALTER TABLE public.xtrollz_stream_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Streamers can view own prices"
ON public.xtrollz_stream_prices;

CREATE POLICY "Streamers can view own prices"
ON public.xtrollz_stream_prices
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Streamers can upsert own prices"
ON public.xtrollz_stream_prices;

CREATE POLICY "Streamers can upsert own prices"
ON public.xtrollz_stream_prices
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Streamers can update own prices"
ON public.xtrollz_stream_prices;

CREATE POLICY "Streamers can update own prices"
ON public.xtrollz_stream_prices
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Approved users can view streamer prices"
ON public.xtrollz_stream_prices;

CREATE POLICY "Approved users can view streamer prices"
ON public.xtrollz_stream_prices
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
        AND up.xtrollz_access_status = 'approved'
        AND up.age_verified = true
        AND up.identity_verified = true
    )
);

GRANT SELECT, INSERT, UPDATE ON public.xtrollz_stream_prices TO authenticated;
GRANT ALL ON public.xtrollz_stream_prices TO service_role;

-- ============================================================
-- 3. xtrollz_viewer_subscriptions: 6-month access tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.xtrollz_viewer_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    streamer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_paid numeric(10,2) NOT NULL,
    currency text DEFAULT 'TC',
    started_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    is_active boolean DEFAULT true,
    payment_source text DEFAULT 'xtrollz_viewer_subscription',
    ref_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xtrollz_viewer_subscriptions_user_id
    ON public.xtrollz_viewer_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_xtrollz_viewer_subscriptions_streamer_id
    ON public.xtrollz_viewer_subscriptions(streamer_id);

CREATE INDEX IF NOT EXISTS idx_xtrollz_viewer_subscriptions_expires_at
    ON public.xtrollz_viewer_subscriptions(expires_at);

ALTER TABLE public.xtrollz_viewer_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions"
ON public.xtrollz_viewer_subscriptions;

CREATE POLICY "Users can view own subscriptions"
ON public.xtrollz_viewer_subscriptions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Streamers can view subscriptions to them"
ON public.xtrollz_viewer_subscriptions;

CREATE POLICY "Streamers can view subscriptions to them"
ON public.xtrollz_viewer_subscriptions
FOR SELECT
TO authenticated
USING (streamer_id = auth.uid());

GRANT SELECT ON public.xtrollz_viewer_subscriptions TO authenticated;
GRANT ALL ON public.xtrollz_viewer_subscriptions TO service_role;

-- ============================================================
-- 4. RPC: xtrollz_buy_viewer_subscription
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_buy_viewer_subscription(
    p_user_id uuid,
    p_streamer_id uuid,
    p_amount numeric DEFAULT 800
)
RETURNS TABLE(
    success boolean,
    message text,
    subscription_id uuid,
    expires_at timestamptz,
    new_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_spend_result jsonb;
    v_expires_at timestamptz;
    v_subscription_id uuid;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        success := false;
        message := 'not_authenticated';
        subscription_id := NULL;
        expires_at := NULL;
        new_balance := NULL;
        RETURN NEXT;
        RETURN;
    END IF;

    IF p_amount <= 0 THEN
        success := false;
        message := 'invalid_amount';
        subscription_id := NULL;
        expires_at := NULL;
        new_balance := NULL;
        RETURN NEXT;
        RETURN;
    END IF;

    IF p_streamer_id = p_user_id THEN
        success := false;
        message := 'cannot_subscribe_to_self';
        subscription_id := NULL;
        expires_at := NULL;
        new_balance := NULL;
        RETURN NEXT;
        RETURN;
    END IF;

    SELECT p.xtrollz_access_status, p.age_verified, p.identity_verified
    INTO v_spend_result
    FROM public.user_profiles p
    WHERE p.id = p_user_id;

    IF NOT FOUND OR v_spend_result::text != 'approved' THEN
        success := false;
        message := 'not_approved';
        subscription_id := NULL;
        expires_at := NULL;
        new_balance := NULL;
        RETURN NEXT;
        RETURN;
    END IF;

    IF p_amount <> 800 THEN
        success := false;
        message := 'invalid_subscription_amount';
        subscription_id := NULL;
        expires_at := NULL;
        new_balance := NULL;
        RETURN NEXT;
        RETURN;
    END IF;

    v_expires_at := NOW() + INTERVAL '6 months';

    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    v_spend_result := public.troll_bank_spend_coins(
        p_user_id => p_user_id,
        p_amount => p_amount,
        p_bucket => 'paid',
        p_source => 'xtrollz_viewer_subscription',
        p_ref_id => p_streamer_id,
        p_metadata => jsonb_build_object('streamer_id', p_streamer_id, 'duration_months', 6)
    );

    IF NOT (v_spend_result->>'success')::boolean THEN
        success := false;
        message := COALESCE(v_spend_result->>'error', 'Insufficient balance');
        subscription_id := NULL;
        expires_at := NULL;
        new_balance := NULL;
        RETURN NEXT;
        RETURN;
    END IF;

    INSERT INTO public.xtrollz_viewer_subscriptions (user_id, streamer_id, amount_paid, expires_at)
    VALUES (p_user_id, p_streamer_id, p_amount, v_expires_at)
    RETURNING id INTO v_subscription_id;

    success := true;
    message := 'subscription_created';
    subscription_id := v_subscription_id;
    expires_at := v_expires_at;
    new_balance := (v_spend_result->>'new_balance')::numeric;
    RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_buy_viewer_subscription(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_buy_viewer_subscription(uuid, uuid, numeric) TO service_role;

-- ============================================================
-- 5. RPC: xtrollz_set_streamer_prices
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_set_streamer_prices(
    p_user_id uuid,
    p_subscription_price numeric DEFAULT 800,
    p_private_show_price numeric DEFAULT 500,
    p_tip_message_price numeric DEFAULT 50,
    p_description text DEFAULT ''
)
RETURNS TABLE(
    success boolean,
    message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        success := false;
        message := 'not_authenticated';
        RETURN NEXT;
        RETURN;
    END IF;

    INSERT INTO public.xtrollz_stream_prices (
        user_id, subscription_price, private_show_price, tip_message_price, description
    ) VALUES (
        p_user_id, p_subscription_price, p_private_show_price, p_tip_message_price, p_description
    )
    ON CONFLICT (user_id) DO UPDATE SET
        subscription_price = EXCLUDED.subscription_price,
        private_show_price = EXCLUDED.private_show_price,
        tip_message_price = EXCLUDED.tip_message_price,
        description = EXCLUDED.description,
        updated_at = NOW();

    success := true;
    message := 'prices_updated';
    RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_set_streamer_prices(uuid, numeric, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_set_streamer_prices(uuid, numeric, numeric, numeric, text) TO service_role;

-- ============================================================
-- 6. RPC: xtrollz_get_streamer_prices
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_get_streamer_prices(
    p_streamer_id uuid
)
RETURNS TABLE(
    subscription_price numeric,
    private_show_price numeric,
    tip_message_price numeric,
    description text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sp.subscription_price,
        sp.private_show_price,
        sp.tip_message_price,
        sp.description
    FROM public.xtrollz_stream_prices sp
    WHERE sp.user_id = p_streamer_id
      AND sp.is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_get_streamer_prices(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_get_streamer_prices(uuid) TO service_role;

-- ============================================================
-- 7. RPC: xtrollz_check_viewer_subscription
-- ============================================================

CREATE OR REPLACE FUNCTION public.xtrollz_check_viewer_subscription(
    p_user_id uuid,
    p_streamer_id uuid
)
RETURNS TABLE(
    has_subscription boolean,
    expires_at timestamptz,
    is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        has_subscription := false;
        expires_at := NULL;
        is_active := false;
        RETURN NEXT;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        s.is_active,
        s.expires_at,
        s.is_active
    FROM public.xtrollz_viewer_subscriptions s
    WHERE s.user_id = p_user_id
      AND s.streamer_id = p_streamer_id
      AND s.expires_at > NOW()
    ORDER BY s.created_at DESC
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.xtrollz_check_viewer_subscription(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xtrollz_check_viewer_subscription(uuid, uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
