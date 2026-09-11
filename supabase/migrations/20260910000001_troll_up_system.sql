-- =============================================================================
-- MIGRATION: Troll Up System
-- Date: 2026-09-10
-- =============================================================================
-- Creates the Troll Up promotional marketplace tables, RLS policies,
-- and server-side RPC functions for coin-only purchases and auto-pay.
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: Packages (CEO-configurable)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.troll_up_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    followers_count INTEGER NOT NULL CHECK (followers_count >= 0),
    likes_count INTEGER NOT NULL CHECK (likes_count >= 0),
    views_count INTEGER NOT NULL CHECK (views_count >= 0),
    coin_price INTEGER NOT NULL CHECK (coin_price > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_troll_up_packages_active ON public.troll_up_packages(is_active, sort_order);

COMMENT ON TABLE public.troll_up_packages IS 'Configurable Troll Up promotional packages.';
COMMENT ON COLUMN public.troll_up_packages.coin_price IS 'Price in Troll Coins (not USD).';

-- =============================================================================
-- PART 2: Purchases (top-level order)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.troll_up_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES public.troll_up_packages(id),
    total_coin_price INTEGER NOT NULL CHECK (total_coin_price > 0),
    is_subscription BOOLEAN NOT NULL DEFAULT FALSE,
    subscription_interval TEXT CHECK (subscription_interval IN ('week')),
    subscription_status TEXT CHECK (subscription_status IN ('active','paused','cancelled','expired')),
    next_charge_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded','cancelled')),
    payment_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_troll_up_purchases_user ON public.troll_up_purchases(user_id, created_at DESC);

COMMENT ON TABLE public.troll_up_purchases IS 'Top-level Troll Up purchase orders.';

-- =============================================================================
-- PART 3: Campaigns (created per purchase)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.troll_up_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES public.troll_up_purchases(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    campaign_type TEXT NOT NULL CHECK (campaign_type IN ('follow','like','view')),
    total_units INTEGER NOT NULL CHECK (total_units > 0),
    completed_units INTEGER NOT NULL DEFAULT 0 CHECK (completed_units >= 0),
    remaining_units INTEGER NOT NULL DEFAULT 0 CHECK (remaining_units >= 0),
    reward_per_unit INTEGER NOT NULL CHECK (reward_per_unit > 0),
    status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN ('PENDING_PAYMENT','ACTIVE','PAUSED','COMPLETED','CANCELLED','REFUNDED','EXPIRED')),
    broadcast_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_troll_up_campaigns_owner ON public.troll_up_campaigns(owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_troll_up_campaigns_broadcast ON public.troll_up_campaigns(broadcast_id) WHERE broadcast_id IS NOT NULL;

COMMENT ON TABLE public.troll_up_campaigns IS 'Individual campaign components (follow/like/view) under one purchase.';

-- =============================================================================
-- PART 4: Reward Ledger (immutable participation records)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.troll_up_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.troll_up_campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('follow','like','view')),
    target_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    broadcast_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
    reward_amount INTEGER NOT NULL CHECK (reward_amount > 0),
    reward_window TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT 'troll_up',
    UNIQUE (user_id, campaign_id, action_type, target_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_troll_up_reward_like_broadcast
  ON public.troll_up_rewards(user_id, campaign_id, action_type, broadcast_id)
  WHERE action_type = 'like' AND broadcast_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_troll_up_reward_view_window
  ON public.troll_up_rewards(user_id, campaign_id, action_type, broadcast_id, reward_window)
  WHERE action_type = 'view' AND broadcast_id IS NOT NULL AND reward_window IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_troll_up_rewards_user ON public.troll_up_rewards(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_troll_up_rewards_campaign ON public.troll_up_rewards(campaign_id, created_at DESC);

COMMENT ON TABLE public.troll_up_rewards IS 'Immutable reward ledger for Troll Up participations.';

-- =============================================================================
-- PART 5: Subscriptions (auto-pay tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.troll_up_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES public.troll_up_packages(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    interval TEXT NOT NULL CHECK (interval IN ('week')),
    last_charged_at TIMESTAMPTZ,
    next_charge_at TIMESTAMPTZ NOT NULL,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_troll_up_subscriptions_user ON public.troll_up_subscriptions(user_id, is_active);

COMMENT ON TABLE public.troll_up_subscriptions IS 'Auto-pay subscriptions for Troll Up.';

-- =============================================================================
-- PART 6: RLS
-- =============================================================================

ALTER TABLE public.troll_up_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_up_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_up_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_up_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_up_subscriptions ENABLE ROW LEVEL SECURITY;

-- Packages: readable by all authenticated users, writable by admin
DROP POLICY IF EXISTS "troll_up_packages_read" ON public.troll_up_packages;
CREATE POLICY "troll_up_packages_read" ON public.troll_up_packages FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "troll_up_packages_admin_write" ON public.troll_up_packages;
CREATE POLICY "troll_up_packages_admin_write" ON public.troll_up_packages FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role IN ('admin','superadmin','ceo')))
);

-- Campaigns: owner can read their own, admin can read all
DROP POLICY IF EXISTS "troll_up_campaigns_owner_read" ON public.troll_up_campaigns;
CREATE POLICY "troll_up_campaigns_owner_read" ON public.troll_up_campaigns FOR SELECT USING (
  owner_user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role IN ('admin','superadmin','ceo')))
);

-- Purchases: user can read own, admin can read all
DROP POLICY IF EXISTS "troll_up_purchases_user_read" ON public.troll_up_purchases;
CREATE POLICY "troll_up_purchases_user_read" ON public.troll_up_purchases FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role IN ('admin','superadmin','ceo')))
);

-- Rewards: user can read own, admin can read all
DROP POLICY IF EXISTS "troll_up_rewards_user_read" ON public.troll_up_rewards;
CREATE POLICY "troll_up_rewards_user_read" ON public.troll_up_rewards FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role IN ('admin','superadmin','ceo')))
);

-- Subscriptions: user can read own, admin can read all
DROP POLICY IF EXISTS "troll_up_subscriptions_user_read" ON public.troll_up_subscriptions;
CREATE POLICY "troll_up_subscriptions_user_read" ON public.troll_up_subscriptions FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role IN ('admin','superadmin','ceo')))
);

-- =============================================================================
-- PART 7: Seed initial packages
-- =============================================================================

INSERT INTO public.troll_up_packages (slug, name, description, followers_count, likes_count, views_count, coin_price, sort_order)
VALUES
  ('starter', 'Starter', '100 followers, 100 likes, 100 views', 100, 100, 100, 399, 1),
  ('basic', 'Basic', '250 followers, 250 likes, 300 views', 250, 250, 300, 799, 2),
  ('boost', 'Boost', '500 followers, 500 likes, 650 views', 500, 500, 650, 1499, 3),
  ('pro', 'Pro', '1,000 followers, 1,000 likes, 1,500 views', 1000, 1000, 1500, 2499, 4),
  ('mega', 'Mega', '2,500 followers, 2,500 likes, 4,000 views', 2500, 2500, 4000, 4999, 5),
  ('elite', 'Elite', '5,000 followers, 5,000 likes, 8,500 views', 5000, 5000, 8500, 8999, 6),
  ('ultimate', 'Ultimate', '10,000 followers, 10,000 likes, 18,000 views', 10000, 10000, 18000, 15999, 7)
ON CONFLICT (slug) DO UPDATE SET
  followers_count = EXCLUDED.followers_count,
  likes_count = EXCLUDED.likes_count,
  views_count = EXCLUDED.views_count,
  coin_price = EXCLUDED.coin_price,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- =============================================================================
-- PART 8: RPC Functions
-- =============================================================================

-- purchase_troll_up: spend coins, create purchase + campaign components
CREATE OR REPLACE FUNCTION public.purchase_troll_up(
    p_package_id UUID,
    p_user_id UUID,
    p_is_subscription BOOLEAN DEFAULT FALSE,
    p_subscription_interval TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_package public.troll_up_packages%ROWTYPE;
    v_purchase_id UUID;
    v_follow_campaign_id UUID;
    v_like_campaign_id UUID;
    v_view_campaign_id UUID;
    v_balance BIGINT;
BEGIN
    SELECT * INTO v_package FROM public.troll_up_packages WHERE id = p_package_id AND is_active = TRUE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
    END IF;

    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = p_user_id;
    IF v_balance IS NULL OR v_balance < v_package.coin_price THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient Troll Coins');
    END IF;

    UPDATE public.user_profiles SET troll_coins = troll_coins - v_package.coin_price WHERE id = p_user_id;

    INSERT INTO public.troll_up_purchases (user_id, package_id, total_coin_price, is_subscription, subscription_interval, subscription_status, status)
    VALUES (p_user_id, p_package_id, v_package.coin_price, p_is_subscription, p_subscription_interval,
            CASE WHEN p_is_subscription THEN 'active' ELSE NULL END,
            CASE WHEN p_is_subscription THEN 'pending' ELSE 'completed' END)
    RETURNING id INTO v_purchase_id;

    IF v_package.followers_count > 0 THEN
        INSERT INTO public.troll_up_campaigns (purchase_id, owner_user_id, target_user_id, campaign_type, total_units, completed_units, remaining_units, reward_per_unit, status)
        VALUES (v_purchase_id, p_user_id, p_user_id, 'follow', v_package.followers_count, 0, v_package.followers_count, 5, 'ACTIVE')
        RETURNING id INTO v_follow_campaign_id;
    END IF;

    IF v_package.likes_count > 0 THEN
        INSERT INTO public.troll_up_campaigns (purchase_id, owner_user_id, target_user_id, campaign_type, total_units, completed_units, remaining_units, reward_per_unit, status)
        VALUES (v_purchase_id, p_user_id, p_user_id, 'like', v_package.likes_count, 0, v_package.likes_count, 1, 'ACTIVE')
        RETURNING id INTO v_like_campaign_id;
    END IF;

    IF v_package.views_count > 0 THEN
        INSERT INTO public.troll_up_campaigns (purchase_id, owner_user_id, target_user_id, campaign_type, total_units, completed_units, remaining_units, reward_per_unit, status)
        VALUES (v_purchase_id, p_user_id, p_user_id, 'view', v_package.views_count, 0, v_package.views_count, 10, 'ACTIVE')
        RETURNING id INTO v_view_campaign_id;
    END IF;

    INSERT INTO public.coin_transactions (user_id, transaction_type, amount, description, metadata)
    VALUES (p_user_id, 'troll_up_purchase', -v_package.coin_price, jsonb_build_object('purchase_id', v_purchase_id, 'package_slug', v_package.slug));

    RETURN jsonb_build_object(
        'success', true,
        'purchase_id', v_purchase_id,
        'follow_campaign_id', v_follow_campaign_id,
        'like_campaign_id', v_like_campaign_id,
        'view_campaign_id', v_view_campaign_id,
        'coins_deducted', v_package.coin_price
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_troll_up(UUID, UUID, BOOLEAN, TEXT) TO authenticated, service_role;

-- create_troll_up_subscription
CREATE OR REPLACE FUNCTION public.create_troll_up_subscription(
    p_package_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_package public.troll_up_packages%ROWTYPE;
    v_sub_id UUID;
BEGIN
    SELECT * INTO v_package FROM public.troll_up_packages WHERE id = p_package_id AND is_active = TRUE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
    END IF;

    INSERT INTO public.troll_up_subscriptions (user_id, package_id, is_active, interval, next_charge_at)
    VALUES (p_user_id, p_package_id, TRUE, 'week', NOW() + INTERVAL '7 days')
    RETURNING id INTO v_sub_id;

    RETURN jsonb_build_object('success', true, 'subscription_id', v_sub_id, 'next_charge_at', NOW() + INTERVAL '7 days');
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_troll_up_subscription(UUID, UUID) TO authenticated, service_role;

-- cancel_troll_up_subscription
CREATE OR REPLACE FUNCTION public.cancel_troll_up_subscription(
    p_subscription_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.troll_up_subscriptions
    SET is_active = FALSE, cancelled_at = NOW(), updated_at = NOW()
    WHERE id = p_subscription_id AND user_id = p_user_id AND is_active = TRUE;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_troll_up_subscription(UUID, UUID) TO authenticated, service_role;

-- get_troll_up_packages
CREATE OR REPLACE FUNCTION public.get_troll_up_packages()
RETURNS SETOF public.troll_up_packages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.troll_up_packages WHERE is_active = TRUE ORDER BY sort_order ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_troll_up_packages() TO authenticated, anon, service_role;

-- get_my_troll_up_purchases
CREATE OR REPLACE FUNCTION public.get_my_troll_up_purchases(p_user_id UUID)
RETURNS SETOF public.troll_up_purchases
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.troll_up_purchases WHERE user_id = p_user_id ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_troll_up_purchases(UUID) TO authenticated, service_role;

-- get_my_troll_up_campaigns
CREATE OR REPLACE FUNCTION public.get_my_troll_up_campaigns(p_user_id UUID)
RETURNS SETOF public.troll_up_campaigns
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.troll_up_campaigns WHERE owner_user_id = p_user_id ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_troll_up_campaigns(UUID) TO authenticated, service_role;

-- get_my_troll_up_subscriptions
CREATE OR REPLACE FUNCTION public.get_my_troll_up_subscriptions(p_user_id UUID)
RETURNS SETOF public.troll_up_subscriptions
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.troll_up_subscriptions WHERE user_id = p_user_id ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_troll_up_subscriptions(UUID) TO authenticated, service_role;

-- =============================================================================
-- PART 9: Trigger for updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION public.touch_troll_up_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_troll_up_packages_updated ON public.troll_up_packages;
CREATE TRIGGER trg_troll_up_packages_updated BEFORE UPDATE ON public.troll_up_packages FOR EACH ROW EXECUTE FUNCTION public.touch_troll_up_updated_at();

DROP TRIGGER IF EXISTS trg_troll_up_campaigns_updated ON public.troll_up_campaigns;
CREATE TRIGGER trg_troll_up_campaigns_updated BEFORE UPDATE ON public.troll_up_campaigns FOR EACH ROW EXECUTE FUNCTION public.touch_troll_up_updated_at();

DROP TRIGGER IF EXISTS trg_troll_up_purchases_updated ON public.troll_up_purchases;
CREATE TRIGGER trg_troll_up_purchases_updated BEFORE UPDATE ON public.troll_up_purchases FOR EACH ROW EXECUTE FUNCTION public.touch_troll_up_updated_at();

DROP TRIGGER IF EXISTS trg_troll_up_subscriptions_updated ON public.troll_up_subscriptions;
CREATE TRIGGER trg_troll_up_subscriptions_updated BEFORE UPDATE ON public.troll_up_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_troll_up_updated_at();

COMMIT;
