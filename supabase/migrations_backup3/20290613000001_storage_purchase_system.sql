-- Storage Purchase System
-- Allows users to purchase storage tier upgrades with Troll Coins
-- Tracks subscription status and expiration

-- 1. Create user_storage_purchases table
CREATE TABLE IF NOT EXISTS public.user_storage_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tier_index INTEGER NOT NULL,
    tier_label TEXT NOT NULL,
    monthly_fee INTEGER NOT NULL,
    bytes_granted BIGINT,
    is_active BOOLEAN DEFAULT true,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    next_billing_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
    last_payment_at TIMESTAMPTZ,
    payment_failed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    UNIQUE(user_id)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_user_storage_purchases_user_id ON public.user_storage_purchases(user_id);

-- RLS
ALTER TABLE public.user_storage_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own storage purchases" ON public.user_storage_purchases
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own storage purchases" ON public.user_storage_purchases
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own storage purchases" ON public.user_storage_purchases
    FOR UPDATE USING (auth.uid() = user_id);

-- 2. Create RPC to purchase storage upgrade
CREATE OR REPLACE FUNCTION public.purchase_storage_upgrade(
    p_user_id UUID,
    p_tier_index INTEGER,
    p_tier_label TEXT,
    p_monthly_fee INTEGER,
    p_bytes_granted BIGINT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_balance INTEGER;
    v_existing JSONB;
    v_result JSONB;
BEGIN
    -- Check user's current coin balance
    SELECT troll_coins INTO v_current_balance
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    IF p_monthly_fee > 0 AND v_current_balance < p_monthly_fee THEN
        RETURN jsonb_build_object('success', false, 'error', 
            format('Insufficient coins. Need %s, have %s', p_monthly_fee, v_current_balance));
    END IF;

    -- Deduct coins only for paid tiers
    IF p_monthly_fee > 0 THEN
        UPDATE public.user_profiles
        SET troll_coins = troll_coins - p_monthly_fee,
            updated_at = NOW()
        WHERE id = p_user_id;
    END IF;

    -- Upsert storage purchase record
    INSERT INTO public.user_storage_purchases (
        user_id, tier_index, tier_label, monthly_fee, bytes_granted,
        is_active, purchased_at, next_billing_at, last_payment_at
    ) VALUES (
        p_user_id, p_tier_index, p_tier_label, p_monthly_fee, p_bytes_granted,
        true, NOW(), NOW() + INTERVAL '30 days', NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        tier_index = p_tier_index,
        tier_label = p_tier_label,
        monthly_fee = p_monthly_fee,
        bytes_granted = p_bytes_granted,
        is_active = true,
        purchased_at = NOW(),
        next_billing_at = NOW() + INTERVAL '30 days',
        last_payment_at = NOW(),
        payment_failed_at = NULL,
        metadata = jsonb_build_object('last_upgrade', NOW());

    -- Record coin transaction only for paid tiers
    IF p_monthly_fee > 0 THEN
        INSERT INTO public.coin_transactions (
            user_id, amount, type, description, metadata
        ) VALUES (
            p_user_id, -p_monthly_fee, 'storage_purchase',
            format('Storage upgrade: %s', p_tier_label),
            jsonb_build_object('tier_index', p_tier_index, 'tier_label', p_tier_label, 'bytes_granted', p_bytes_granted)
        );
    END IF;

    v_result := jsonb_build_object(
        'success', true,
        'tier_index', p_tier_index,
        'tier_label', p_tier_label,
        'monthly_fee', p_monthly_fee,
        'new_balance', v_current_balance - GREATEST(p_monthly_fee, 0),
        'next_billing', (NOW() + INTERVAL '30 days')::TEXT
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create RPC to get user's active storage plan
CREATE OR REPLACE FUNCTION public.get_user_storage_plan(p_user_id UUID)
RETURNS TABLE (
    tier_index INTEGER,
    tier_label TEXT,
    monthly_fee INTEGER,
    bytes_granted BIGINT,
    is_active BOOLEAN,
    purchased_at TIMESTAMPTZ,
    next_billing_at TIMESTAMPTZ,
    last_payment_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        usp.tier_index,
        usp.tier_label,
        usp.monthly_fee,
        usp.bytes_granted,
        usp.is_active,
        usp.purchased_at,
        usp.next_billing_at,
        usp.last_payment_at
    FROM public.user_storage_purchases usp
    WHERE usp.user_id = p_user_id
      AND usp.is_active = true
    ORDER BY usp.purchased_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
