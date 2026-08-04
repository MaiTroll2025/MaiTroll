-- Add egress tracking to user_storage_usage and user_storage_purchases
-- Egress = bandwidth used when viewers watch recorded streams

ALTER TABLE public.user_storage_usage
ADD COLUMN IF NOT EXISTS egress_bytes BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS egress_used_bytes BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.user_storage_purchases
ADD COLUMN IF NOT EXISTS egress_included_bytes BIGINT,
ADD COLUMN IF NOT EXISTS egress_per_gb_cost INTEGER DEFAULT 15;

-- Function to record egress usage when a viewer watches a recorded stream
CREATE OR REPLACE FUNCTION public.record_egress_usage(
    p_user_id UUID,
    p_stream_id UUID,
    p_egress_bytes BIGINT
)
RETURNS JSONB AS $$
DECLARE
    v_purchase RECORD;
    v_usage RECORD;
    v_overage_bytes BIGINT;
    v_overage_cost INTEGER;
    v_user_coins INTEGER;
BEGIN
    -- Only non-admin users are charged for egress
    IF EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND (role = 'admin' OR is_admin = true OR role = 'superadmin' OR is_superadmin = true)
    ) THEN
        RETURN jsonb_build_object('success', true, 'charged', false, 'reason', 'admin_exempt');
    END IF;

    -- Get user's active storage purchase
    SELECT * INTO v_purchase
    FROM public.user_storage_purchases
    WHERE user_id = p_user_id AND is_active = true
    ORDER BY purchased_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active storage plan. Purchase a plan in the Coin Store.');
    END IF;

    -- Get current usage
    SELECT * INTO v_usage
    FROM public.user_storage_usage
    WHERE user_id = p_user_id;

    -- Calculate egress overage
    IF v_purchase.egress_included_bytes IS NOT NULL THEN
        IF (v_usage.egress_used_bytes + p_egress_bytes) > v_purchase.egress_included_bytes THEN
            v_overage_bytes := (v_usage.egress_used_bytes + p_egress_bytes) - v_purchase.egress_included_bytes;
            v_overage_cost := CEIL(v_overage_bytes::NUMERIC / (1024 * 1024 * 1024)) * v_purchase.egress_per_gb_cost;
        ELSE
            v_overage_bytes := 0;
            v_overage_cost := 0;
        END IF;
    ELSE
        v_overage_bytes := p_egress_bytes;
        v_overage_cost := CEIL(p_egress_bytes::NUMERIC / (1024 * 1024 * 1024)) * v_purchase.egress_per_gb_cost;
    END IF;

    -- Deduct overage coins if any
    IF v_overage_cost > 0 THEN
        SELECT troll_coins INTO v_user_coins
        FROM public.user_profiles
        WHERE id = p_user_id;

        IF v_user_coins < v_overage_cost THEN
            RETURN jsonb_build_object('success', false, 'error', 'Not enough Troll Coins for egress. Purchase more storage in the Coin Store.');
        END IF;

        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_overage_cost,
            updated_at = NOW()
        WHERE id = p_user_id;

        INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
        VALUES (p_user_id, -v_overage_cost, 'egress_usage',
                format('Stream playback egress: %s', p_stream_id),
                jsonb_build_object('stream_id', p_stream_id, 'egress_bytes', p_egress_bytes, 'overage_cost', v_overage_cost));
    END IF;

    -- Update usage
    UPDATE public.user_storage_usage
    SET egress_used_bytes = egress_used_bytes + p_egress_bytes,
        egress_bytes = egress_bytes + p_egress_bytes,
        last_updated = NOW()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'charged', v_overage_cost > 0,
        'overage_cost', v_overage_cost,
        'egress_used_gb', ROUND((v_usage.egress_used_bytes + p_egress_bytes)::NUMERIC / (1024 * 1024 * 1024), 2),
        'egress_included_gb', ROUND(v_purchase.egress_included_bytes::NUMERIC / (1024 * 1024 * 1024), 2)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can record (has active plan, not admin-exempt)
CREATE OR REPLACE FUNCTION public.can_user_record(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_purchase RECORD;
    v_usage RECORD;
    v_storage_remaining BIGINT;
BEGIN
    -- Admins can always record
    IF EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND (role = 'admin' OR is_admin = true OR role = 'superadmin' OR is_superadmin = true)
    ) THEN
        RETURN jsonb_build_object('can_record', true, 'reason', 'admin');
    END IF;

    -- Check for active storage plan
    SELECT * INTO v_purchase
    FROM public.user_storage_purchases
    WHERE user_id = p_user_id AND is_active = true
    ORDER BY purchased_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('can_record', false, 'reason', 'no_plan', 'action', 'purchase_storage');
    END IF;

    -- Check storage remaining
    SELECT * INTO v_usage
    FROM public.user_storage_usage
    WHERE user_id = p_user_id;

    v_storage_remaining := v_purchase.bytes_granted - COALESCE(v_usage.total_bytes, 0);

    IF v_storage_remaining <= 0 THEN
        RETURN jsonb_build_object('can_record', false, 'reason', 'storage_full', 'action', 'upgrade_storage');
    END IF;

    RETURN jsonb_build_object(
        'can_record', true,
        'storage_remaining_gb', ROUND(v_storage_remaining::NUMERIC / (1024 * 1024 * 1024), 2),
        'egress_included_gb', ROUND(COALESCE(v_purchase.egress_included_bytes, 0)::NUMERIC / (1024 * 1024 * 1024), 2)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
