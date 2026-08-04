-- ============================================================================
-- Mai Troll ECONOMY SAFETY PASS
-- Cashout Bonus, Admin Caps, and Revenue-Based Rewards
-- Date: 2029-06-06
-- ============================================================================
-- This migration implements:
-- 1. New User Cashout Bonus (first 10 promo users, NOT signup bonus)
-- 2. Admin Economy Cap Settings (platform_economy_settings table)
-- 3. Manual Admin Cashout Bonus tool (cashout_bonus_grants table)
-- 4. Thursday Cashout Bonus Flow (admin RPC)
-- 5. Friday Battle Bonus cap (5% per gifter per battle)
-- 6. League reward cap (1000 coins total, split between members)
-- 7. Platform Revenue-Based Bonus System (platform_reward_pool table)
-- 8. Signup bonus correction (100 coins max, admin toggle)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PLATFORM ECONOMY SETTINGS TABLE
-- Central admin control for all economy caps and toggles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.platform_economy_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    -- Signup bonus controls
    signup_bonus_enabled BOOLEAN NOT NULL DEFAULT false,
    signup_bonus_coins INTEGER NOT NULL DEFAULT 100 CHECK (signup_bonus_coins >= 0 AND signup_bonus_coins <= 100),
    -- New user cashout promo controls
    new_user_cashout_bonus_enabled BOOLEAN NOT NULL DEFAULT false,
    new_user_cashout_bonus_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00 CHECK (new_user_cashout_bonus_percent >= 0 AND new_user_cashout_bonus_percent <= 100),
    new_user_cashout_bonus_max_users INTEGER NOT NULL DEFAULT 10 CHECK (new_user_cashout_bonus_max_users >= 0),
    new_user_cashout_bonus_used_count INTEGER NOT NULL DEFAULT 0 CHECK (new_user_cashout_bonus_used_count >= 0),
    new_user_cashout_bonus_max_per_user_coins BIGINT NOT NULL DEFAULT 100000 CHECK (new_user_cashout_bonus_max_per_user_coins >= 0),
    -- Friday battle bonus cap
    friday_battle_bonus_cap_coins BIGINT NOT NULL DEFAULT 1000 CHECK (friday_battle_bonus_cap_coins >= 0),
    -- League reward cap
    league_reward_cap_coins INTEGER NOT NULL DEFAULT 1000 CHECK (league_reward_cap_coins >= 0),
    -- Level reward cap
    level_reward_cap_coins INTEGER NOT NULL DEFAULT 500 CHECK (level_reward_cap_coins >= 0),
    -- Giveaway reward budget percent
    giveaway_reward_budget_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (giveaway_reward_budget_percent >= 0 AND giveaway_reward_budget_percent <= 100),
    -- Global reward system toggle
    global_reward_system_enabled BOOLEAN NOT NULL DEFAULT true,
    -- Require revenue pool check before issuing rewards
    require_revenue_pool_check BOOLEAN NOT NULL DEFAULT true,
    -- Audit
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default row if not exists
INSERT INTO public.platform_economy_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.platform_economy_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read economy settings" ON public.platform_economy_settings;
CREATE POLICY "Anyone can read economy settings" ON public.platform_economy_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage economy settings" ON public.platform_economy_settings;
CREATE POLICY "Admins can manage economy settings" ON public.platform_economy_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo'))
    );

-- ============================================================================
-- 2. CASHOUT BONUS GRANTS TABLE
-- Tracks all manual and promo cashout bonuses
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cashout_bonus_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES public.user_profiles(id),
    bonus_type TEXT NOT NULL CHECK (bonus_type IN ('manual_flat', 'manual_percent', 'new_user_promo')),
    base_cashout_balance_coins BIGINT NOT NULL DEFAULT 0 CHECK (base_cashout_balance_coins >= 0),
    bonus_percent NUMERIC(5,2),
    bonus_coins BIGINT NOT NULL DEFAULT 0 CHECK (bonus_coins >= 0),
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'voided')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    -- Prevent duplicate pending bonuses for same user+type
    CONSTRAINT unique_pending_promo UNIQUE (user_id, bonus_type, status)
);

CREATE INDEX IF NOT EXISTS idx_cashout_bonus_grants_user_id ON public.cashout_bonus_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_cashout_bonus_grants_status ON public.cashout_bonus_grants(status);

-- RLS
ALTER TABLE public.cashout_bonus_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bonus grants" ON public.cashout_bonus_grants;
CREATE POLICY "Users can view own bonus grants" ON public.cashout_bonus_grants
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage bonus grants" ON public.cashout_bonus_grants;
CREATE POLICY "Admins can manage bonus grants" ON public.cashout_bonus_grants
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo'))
    );

-- ============================================================================
-- 3. PLATFORM REWARD POOL TABLE
-- Tracks revenue sources and available reward budget
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.platform_reward_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revenue_source TEXT NOT NULL CHECK (revenue_source IN (
        'coin_purchase_fee',
        'auction_service_fee',
        'agency_creation_fee',
        'agency_monthly_fee',
        'bail_bill',
        'featured_broadcast',
        'featured_post',
        'featured_podcast',
        'featured_auction',
        'marketplace_fee',
        'other_sink'
    )),
    revenue_coins BIGINT NOT NULL DEFAULT 0 CHECK (revenue_coins >= 0),
    available_reward_budget_coins BIGINT NOT NULL DEFAULT 0 CHECK (available_reward_budget_coins >= 0),
    used_reward_budget_coins BIGINT NOT NULL DEFAULT 0 CHECK (used_reward_budget_coins >= 0),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(revenue_source, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_platform_reward_pool_period ON public.platform_reward_pool(period_start, period_end);

-- RLS
ALTER TABLE public.platform_reward_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage reward pool" ON public.platform_reward_pool;
CREATE POLICY "Admins can manage reward pool" ON public.platform_reward_pool
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'ceo'))
    );

DROP POLICY IF EXISTS "Service role can read reward pool" ON public.platform_reward_pool;
CREATE POLICY "Service role can read reward pool" ON public.platform_reward_pool
    FOR SELECT USING (true);

-- ============================================================================
-- 4. REWARD BUDGET CHECK FUNCTION
-- Core function that all reward-granting systems must call before issuing coins
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_reward_budget(p_coins_to_grant BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_settings public.platform_economy_settings%ROWTYPE;
    v_current_period_start DATE;
    v_current_period_end DATE;
    v_total_revenue BIGINT;
    v_budget_limit BIGINT;
    v_used_budget BIGINT;
    v_available_budget BIGINT;
BEGIN
    -- Load settings
    SELECT * INTO v_settings FROM public.platform_economy_settings WHERE id = 1;

    -- If global reward system is disabled, block all rewards
    IF v_settings.global_reward_system_enabled = false THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Global reward system is disabled by admin'
        );
    END IF;

    -- If revenue pool check not required, allow
    IF v_settings.require_revenue_pool_check = false THEN
        RETURN jsonb_build_object('allowed', true);
    END IF;

    -- Calculate current period (monthly)
    v_current_period_start := date_trunc('month', CURRENT_DATE)::DATE;
    v_current_period_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    -- Get total revenue for current period
    SELECT COALESCE(SUM(revenue_coins), 0)
    INTO v_total_revenue
    FROM public.platform_reward_pool
    WHERE period_start = v_current_period_start
      AND period_end = v_current_period_end;

    -- If no revenue recorded yet, allow small rewards (bootstrap period)
    IF v_total_revenue = 0 THEN
        RETURN jsonb_build_object('allowed', true);
    END IF;

    -- Calculate budget limit from revenue
    v_budget_limit := FLOOR(v_total_revenue * (v_settings.giveaway_reward_budget_percent / 100.0))::BIGINT;

    -- Get used budget for current period
    SELECT COALESCE(SUM(used_reward_budget_coins), 0)
    INTO v_used_budget
    FROM public.platform_reward_pool
    WHERE period_start = v_current_period_start
      AND period_end = v_current_period_end;

    v_available_budget := GREATEST(0, v_budget_limit - v_used_budget);

    -- Check if grant exceeds available budget
    IF p_coins_to_grant > v_available_budget THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Reward budget exhausted for this period',
            'requested', p_coins_to_grant,
            'available', v_available_budget,
            'budget_limit', v_budget_limit,
            'used_budget', v_used_budget,
            'total_revenue', v_total_revenue
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'available', v_available_budget,
        'budget_limit', v_budget_limit,
        'used_budget', v_used_budget
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_reward_budget(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_reward_budget(BIGINT) TO service_role;

-- ============================================================================
-- 5. REWARD BUDGET CONSUMPTION FUNCTION
-- Called after successfully granting a reward to track budget usage
-- ============================================================================
CREATE OR REPLACE FUNCTION public.consume_reward_budget(
    p_coins_granted BIGINT,
    p_source TEXT DEFAULT 'other_sink'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_period_start DATE;
    v_current_period_end DATE;
    v_pool_record UUID;
BEGIN
    v_current_period_start := date_trunc('month', CURRENT_DATE)::DATE;
    v_current_period_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    -- Find or create pool record for this source/period
    SELECT id INTO v_pool_record
    FROM public.platform_reward_pool
    WHERE revenue_source = p_source
      AND period_start = v_current_period_start
      AND period_end = v_current_period_end;

    IF v_pool_record IS NOT NULL THEN
        UPDATE public.platform_reward_pool
        SET used_reward_budget_coins = used_reward_budget_coins + p_coins_granted
        WHERE id = v_pool_record;
    ELSE
        INSERT INTO public.platform_reward_pool (revenue_source, revenue_coins, available_reward_budget_coins, used_reward_budget_coins, period_start, period_end)
        VALUES (p_source, 0, 0, p_coins_granted, v_current_period_start, v_current_period_end);
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_reward_budget(BIGINT, TEXT) TO service_role;

-- ============================================================================
-- 6. NEW USER CASHOUT BONUS FUNCTION
-- Applies cashout bonus for first N promo users when they cash out
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_new_user_cashout_bonus(
    p_user_id UUID,
    p_cashout_coins BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings public.platform_economy_settings%ROWTYPE;
    v_bonus_coins BIGINT;
    v_existing_grant UUID;
BEGIN
    -- Load settings
    SELECT * INTO v_settings FROM public.platform_economy_settings WHERE id = 1;

    -- Check if promo is enabled
    IF v_settings.new_user_cashout_bonus_enabled = false THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'New user cashout bonus promo is disabled');
    END IF;

    -- Check if user already has a pending or applied promo bonus
    SELECT id INTO v_existing_grant
    FROM public.cashout_bonus_grants
    WHERE user_id = p_user_id
      AND bonus_type = 'new_user_promo'
      AND status IN ('pending', 'applied');

    IF v_existing_grant IS NOT NULL THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'User already has a new user promo bonus');
    END IF;

    -- Check if max users reached
    IF v_settings.new_user_cashout_bonus_used_count >= v_settings.new_user_cashout_bonus_max_users THEN
        RETURN jsonb_build_object('applied', false, 'reason', 'Max promo users reached');
    END IF;

    -- Calculate bonus
    v_bonus_coins := FLOOR(p_cashout_coins * (v_settings.new_user_cashout_bonus_percent / 100.0))::BIGINT;

    -- Cap per user
    IF v_bonus_coins > v_settings.new_user_cashout_bonus_max_per_user_coins THEN
        v_bonus_coins := v_settings.new_user_cashout_bonus_max_per_user_coins;
    END IF;

    -- Create grant record
    INSERT INTO public.cashout_bonus_grants (
        user_id, bonus_type, base_cashout_balance_coins,
        bonus_percent, bonus_coins, reason, status
    ) VALUES (
        p_user_id, 'new_user_promo', p_cashout_coins,
        v_settings.new_user_cashout_bonus_percent, v_bonus_coins,
        'First-10 new user cashout promo', 'pending'
    );

    -- Increment used count
    UPDATE public.platform_economy_settings
    SET new_user_cashout_bonus_used_count = new_user_cashout_bonus_used_count + 1
    WHERE id = 1;

    RETURN jsonb_build_object(
        'applied', true,
        'bonus_coins', v_bonus_coins,
        'bonus_percent', v_settings.new_user_cashout_bonus_percent
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_new_user_cashout_bonus(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_new_user_cashout_bonus(UUID, BIGINT) TO service_role;

-- ============================================================================
-- 7. MANUAL ADMIN CASHOUT BONUS FUNCTION
-- Allows admin to add a cashout bonus to any user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_grant_cashout_bonus(
    p_admin_id UUID,
    p_target_user_id UUID,
    p_bonus_type TEXT, -- 'manual_flat' or 'manual_percent'
    p_bonus_value NUMERIC, -- flat coins or percentage
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings public.platform_economy_settings%ROWTYPE;
    v_current_balance BIGINT;
    v_bonus_coins BIGINT;
    v_existing_pending UUID;
BEGIN
    -- Verify admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_admin_id AND role IN ('admin', 'ceo')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin/CEO role required');
    END IF;

    -- Load settings
    SELECT * INTO v_settings FROM public.platform_economy_settings WHERE id = 1;

    -- Get user's current cashout-eligible balance
    SELECT COALESCE(
        (SELECT SUM(amount) FROM public.coin_transactions
         WHERE user_id = p_target_user_id
           AND type = 'gift_received'
           AND amount > 0
           AND coin_type = 'paid'),
        0
    )::BIGINT INTO v_current_balance;

    -- Calculate bonus
    IF p_bonus_type = 'manual_percent' THEN
        v_bonus_coins := FLOOR(v_current_balance * (p_bonus_value / 100.0))::BIGINT;
    ELSIF p_bonus_type = 'manual_flat' THEN
        v_bonus_coins := FLOOR(p_bonus_value)::BIGINT;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid bonus type. Use manual_flat or manual_percent');
    END IF;

    -- Validate
    IF v_bonus_coins <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bonus amount must be greater than 0');
    END IF;

    -- Check for existing pending bonus of same type (prevent duplicates)
    SELECT id INTO v_existing_pending
    FROM public.cashout_bonus_grants
    WHERE user_id = p_target_user_id
      AND bonus_type = p_bonus_type
      AND status = 'pending'
      AND created_at > NOW() - INTERVAL '5 minutes';

    IF v_existing_pending IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Duplicate prevention: A pending bonus of this type was created within the last 5 minutes',
            'existing_grant_id', v_existing_pending
        );
    END IF;

    -- Create grant record
    INSERT INTO public.cashout_bonus_grants (
        user_id, admin_id, bonus_type,
        base_cashout_balance_coins,
        bonus_percent, bonus_coins,
        reason, status
    ) VALUES (
        p_target_user_id, p_admin_id, p_bonus_type,
        v_current_balance,
        CASE WHEN p_bonus_type = 'manual_percent' THEN p_bonus_value ELSE NULL END,
        v_bonus_coins,
        COALESCE(p_reason, 'Manual admin cashout bonus'),
        'pending'
    );

    RETURN jsonb_build_object(
        'success', true,
        'bonus_coins', v_bonus_coins,
        'base_balance', v_current_balance,
        'bonus_type', p_bonus_type
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_cashout_bonus(UUID, UUID, TEXT, NUMERIC, TEXT) TO authenticated;

-- ============================================================================
-- 8. APPLY CASHOUT BONUS (called during cashout processing)
-- Moves a pending bonus to applied and credits the user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_pending_cashout_bonus(
    p_grant_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_grant RECORD;
BEGIN
    -- Get and lock the grant
    SELECT * INTO v_grant
    FROM public.cashout_bonus_grants
    WHERE id = p_grant_id
      AND user_id = p_user_id
      AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No pending bonus found');
    END IF;

    -- Mark as applied
    UPDATE public.cashout_bonus_grants
    SET status = 'applied', applied_at = NOW()
    WHERE id = p_grant_id;

    -- Credit user's cashout bonus balance
    UPDATE public.user_profiles
    SET friday_battle_bonus_coins = COALESCE(friday_battle_bonus_coins, 0) + v_grant.bonus_coins
    WHERE id = p_user_id;

    -- Write ledger record
    INSERT INTO public.coin_transactions (
        user_id, amount, type, transaction_type, metadata
    ) VALUES (
        p_user_id,
        v_grant.bonus_coins,
        'cashout_bonus',
        'cashout_bonus',
        jsonb_build_object(
            'grant_id', p_grant_id,
            'bonus_type', v_grant.bonus_type,
            'source', 'admin_manual_cashout_bonus',
            'reason', v_grant.reason
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'bonus_coins', v_grant.bonus_coins
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_pending_cashout_bonus(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_pending_cashout_bonus(UUID, UUID) TO service_role;

-- ============================================================================
-- 9. VOID CASHOUT BONUS (admin can void a pending bonus)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_void_cashout_bonus(
    p_admin_id UUID,
    p_grant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_grant RECORD;
BEGIN
    -- Verify admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_admin_id AND role IN ('admin', 'ceo')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT * INTO v_grant
    FROM public.cashout_bonus_grants
    WHERE id = p_grant_id AND status = 'pending';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No pending bonus found');
    END IF;

    UPDATE public.cashout_bonus_grants
    SET status = 'voided'
    WHERE id = p_grant_id;

    -- If it was a new_user_promo, decrement the used count
    IF v_grant.bonus_type = 'new_user_promo' THEN
        UPDATE public.platform_economy_settings
        SET new_user_cashout_bonus_used_count = GREATEST(0, new_user_cashout_bonus_used_count - 1)
        WHERE id = 1;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_void_cashout_bonus(UUID, UUID) TO authenticated;

-- ============================================================================
-- 10. GET USER CASHOUT BONUS INFO
-- Returns current cashout balance + any pending/applied bonuses
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_cashout_bonus_info(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_eligible_balance BIGINT;
    v_pending_bonuses JSONB;
    v_applied_bonuses JSONB;
BEGIN
    -- Get eligible cashout balance (gift received, paid coins only)
    SELECT COALESCE(SUM(amount), 0)::BIGINT
    INTO v_eligible_balance
    FROM public.coin_transactions
    WHERE user_id = p_user_id
      AND type = 'gift_received'
      AND amount > 0
      AND coin_type = 'paid';

    -- Get pending bonuses
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'bonus_type', bonus_type,
        'bonus_coins', bonus_coins,
        'reason', reason,
        'created_at', created_at
    )), '[]'::jsonb)
    INTO v_pending_bonuses
    FROM public.cashout_bonus_grants
    WHERE user_id = p_user_id AND status = 'pending';

    -- Get applied bonuses
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'bonus_type', bonus_type,
        'bonus_coins', bonus_coins,
        'reason', reason,
        'applied_at', applied_at
    )), '[]'::jsonb)
    INTO v_applied_bonuses
    FROM public.cashout_bonus_grants
    WHERE user_id = p_user_id AND status = 'applied';

    RETURN jsonb_build_object(
        'eligible_cashout_balance', v_eligible_balance,
        'pending_bonuses', v_pending_bonuses,
        'applied_bonuses', v_applied_bonuses,
        'total_bonus_coins', (
            SELECT COALESCE(SUM(bonus_coins), 0)
            FROM public.cashout_bonus_grants
            WHERE user_id = p_user_id AND status = 'applied'
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_cashout_bonus_info(UUID) TO authenticated;

-- ============================================================================
-- 11. FRIDAY BATTLE BONDS CAP FUNCTION
-- Returns the max coins a gifter can earn from Friday battle bonus per battle
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_friday_battle_bonus_cap()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_cap BIGINT;
BEGIN
    SELECT friday_battle_bonus_cap_coins INTO v_cap
    FROM public.platform_economy_settings
    WHERE id = 1;

    RETURN COALESCE(v_cap, 1000);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_friday_battle_bonus_cap() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friday_battle_bonus_cap() TO service_role;

-- ============================================================================
-- 12. LEAGUE REWARD CAP FUNCTION
-- Calculates the per-member share of league rewards capped at 1000 total
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_league_reward_share(
    p_member_count INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_cap INTEGER;
    v_share INTEGER;
BEGIN
    IF p_member_count IS NULL OR p_member_count <= 0 THEN
        RETURN 0;
    END IF;

    SELECT league_reward_cap_coins INTO v_cap
    FROM public.platform_economy_settings
    WHERE id = 1;

    v_cap := COALESCE(v_cap, 1000);

    -- Split evenly, no rounding coins
    v_share := FLOOR(v_cap / p_member_count)::INTEGER;

    RETURN GREATEST(0, v_share);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_league_reward_share(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_league_reward_share(INTEGER) TO service_role;

-- ============================================================================
-- 13. ADMIN GET ECONOMY SETTINGS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_get_economy_settings(p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    -- Verify admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_admin_id AND role IN ('admin', 'ceo')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    RETURN (
        SELECT jsonb_build_object(
            'success', true,
            'settings', jsonb_build_object(
                'signup_bonus_enabled', signup_bonus_enabled,
                'signup_bonus_coins', signup_bonus_coins,
                'new_user_cashout_bonus_enabled', new_user_cashout_bonus_enabled,
                'new_user_cashout_bonus_percent', new_user_cashout_bonus_percent,
                'new_user_cashout_bonus_max_users', new_user_cashout_bonus_max_users,
                'new_user_cashout_bonus_used_count', new_user_cashout_bonus_used_count,
                'new_user_cashout_bonus_max_per_user_coins', new_user_cashout_bonus_max_per_user_coins,
                'friday_battle_bonus_cap_coins', friday_battle_bonus_cap_coins,
                'league_reward_cap_coins', league_reward_cap_coins,
                'level_reward_cap_coins', level_reward_cap_coins,
                'giveaway_reward_budget_percent', giveaway_reward_budget_percent,
                'global_reward_system_enabled', global_reward_system_enabled,
                'require_revenue_pool_check', require_revenue_pool_check,
                'updated_at', updated_at
            )
        )
        FROM public.platform_economy_settings
        WHERE id = 1
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_economy_settings(UUID) TO authenticated;

-- ============================================================================
-- 14. ADMIN UPDATE ECONOMY SETTINGS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_economy_settings(
    p_admin_id UUID,
    p_settings JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_admin_id AND role IN ('admin', 'ceo')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    UPDATE public.platform_economy_settings
    SET
        signup_bonus_enabled = COALESCE((p_settings->>'signup_bonus_enabled')::BOOLEAN, signup_bonus_enabled),
        signup_bonus_coins = COALESCE((p_settings->>'signup_bonus_coins')::INTEGER, signup_bonus_coins),
        new_user_cashout_bonus_enabled = COALESCE((p_settings->>'new_user_cashout_bonus_enabled')::BOOLEAN, new_user_cashout_bonus_enabled),
        new_user_cashout_bonus_percent = COALESCE((p_settings->>'new_user_cashout_bonus_percent')::NUMERIC, new_user_cashout_bonus_percent),
        new_user_cashout_bonus_max_users = COALESCE((p_settings->>'new_user_cashout_bonus_max_users')::INTEGER, new_user_cashout_bonus_max_users),
        new_user_cashout_bonus_max_per_user_coins = COALESCE((p_settings->>'new_user_cashout_bonus_max_per_user_coins')::BIGINT, new_user_cashout_bonus_max_per_user_coins),
        friday_battle_bonus_cap_coins = COALESCE((p_settings->>'friday_battle_bonus_cap_coins')::BIGINT, friday_battle_bonus_cap_coins),
        league_reward_cap_coins = COALESCE((p_settings->>'league_reward_cap_coins')::INTEGER, league_reward_cap_coins),
        level_reward_cap_coins = COALESCE((p_settings->>'level_reward_cap_coins')::INTEGER, level_reward_cap_coins),
        giveaway_reward_budget_percent = COALESCE((p_settings->>'giveaway_reward_budget_percent')::NUMERIC, giveaway_reward_budget_percent),
        global_reward_system_enabled = COALESCE((p_settings->>'global_reward_system_enabled')::BOOLEAN, global_reward_system_enabled),
        require_revenue_pool_check = COALESCE((p_settings->>'require_revenue_pool_check')::BOOLEAN, require_revenue_pool_check),
        updated_by = p_admin_id,
        updated_at = NOW()
    WHERE id = 1;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_economy_settings(UUID, JSONB) TO authenticated;

-- ============================================================================
-- 15. ADMIN GET REWARD POOL STATUS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_get_reward_pool_status(p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_current_period_start DATE;
    v_current_period_end DATE;
BEGIN
    -- Verify admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_admin_id AND role IN ('admin', 'ceo')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    v_current_period_start := date_trunc('month', CURRENT_DATE)::DATE;
    v_current_period_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    RETURN jsonb_build_object(
        'success', true,
        'period', jsonb_build_object('start', v_current_period_start, 'end', v_current_period_end),
        'pool_entries', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', id,
                'revenue_source', revenue_source,
                'revenue_coins', revenue_coins,
                'used_reward_budget_coins', used_reward_budget_coins
            )), '[]'::jsonb)
            FROM public.platform_reward_pool
            WHERE period_start = v_current_period_start
              AND period_end = v_current_period_end
        ),
        'total_revenue', (
            SELECT COALESCE(SUM(revenue_coins), 0)
            FROM public.platform_reward_pool
            WHERE period_start = v_current_period_start
              AND period_end = v_current_period_end
        ),
        'total_used_budget', (
            SELECT COALESCE(SUM(used_reward_budget_coins), 0)
            FROM public.platform_reward_pool
            WHERE period_start = v_current_period_start
              AND period_end = v_current_period_end
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_reward_pool_status(UUID) TO authenticated;

-- ============================================================================
-- 16. ADMIN ADD REVENUE TO POOL
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_add_revenue_to_pool(
    p_admin_id UUID,
    p_revenue_source TEXT,
    p_revenue_coins BIGINT,
    p_period_start DATE DEFAULT NULL,
    p_period_end DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    -- Verify admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_admin_id AND role IN ('admin', 'ceo')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    v_period_start := COALESCE(p_period_start, date_trunc('month', CURRENT_DATE)::DATE);
    v_period_end := COALESCE(p_period_end, (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE);

    INSERT INTO public.platform_reward_pool (revenue_source, revenue_coins, available_reward_budget_coins, used_reward_budget_coins, period_start, period_end)
    VALUES (p_revenue_source, p_revenue_coins, 0, 0, v_period_start, v_period_end)
    ON CONFLICT (revenue_source, period_start, period_end)
    DO UPDATE SET
        revenue_coins = public.platform_reward_pool.revenue_coins + p_revenue_coins;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_add_revenue_to_pool(UUID, TEXT, BIGINT, DATE, DATE) TO authenticated;

-- ============================================================================
-- 17. GET USER CASHOUT BONUS LIST (for admin Thursday review)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_get_cashout_bonus_list(
    p_admin_id UUID,
    p_status TEXT DEFAULT 'pending'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    -- Verify admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_admin_id AND role IN ('admin', 'ceo')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'bonuses', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', cbg.id,
                'user_id', cbg.user_id,
                'username', up.username,
                'bonus_type', cbg.bonus_type,
                'base_cashout_balance_coins', cbg.base_cashout_balance_coins,
                'bonus_percent', cbg.bonus_percent,
                'bonus_coins', cbg.bonus_coins,
                'reason', cbg.reason,
                'status', cbg.status,
                'created_at', cbg.created_at,
                'applied_at', cbg.applied_at
            ) ORDER BY cbg.created_at DESC), '[]'::jsonb)
            FROM public.cashout_bonus_grants cbg
            JOIN public.user_profiles up ON up.id = cbg.user_id
            WHERE cbg.status = p_status
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_cashout_bonus_list(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 18. SIGNUP BONUS CORRECTION
-- Update the signup trigger to respect admin settings (max 100 coins)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_username TEXT;
    v_avatar_url TEXT;
    v_email TEXT;
    v_role TEXT;
    v_settings public.platform_economy_settings%ROWTYPE;
    v_signup_coins INTEGER := 0;
BEGIN
    -- Load economy settings
    SELECT * INTO v_settings FROM public.platform_economy_settings WHERE id = 1;

    -- Only give signup bonus if enabled and capped at 100
    IF v_settings.signup_bonus_enabled = true THEN
        v_signup_coins := LEAST(v_settings.signup_bonus_coins, 100);
    ELSE
        v_signup_coins := 0;
    END IF;

    v_username := trim(both '_' from regexp_replace(lower(COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'username',''),
        NULLIF(NEW.raw_app_meta_data->>'username',''),
        NULLIF(split_part(COALESCE(NEW.email,''), '@', 1), ''),
        'user'
    )), '[^a-z0-9_]+','_','g')) || '_' || substr(replace(NEW.id::text,'-',''),1,12);

    v_avatar_url := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_username
    );

    v_email := COALESCE(NEW.email, '');
    v_role := CASE WHEN lower(v_email) = 'Mai Troll2025@gmail.com' THEN 'admin' ELSE 'user' END;

    INSERT INTO public.user_profiles (
        id, user_id, username, avatar_url, bio, role, tier,
        troll_coins, total_earned_coins, total_spent_coins,
        email, terms_accepted, created_at, updated_at
    ) VALUES (
        NEW.id, NEW.id, v_username, v_avatar_url,
        'New troll in the city!', v_role, 'Bronze',
        v_signup_coins, v_signup_coins, 0,
        v_email, false, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        user_id = COALESCE(public.user_profiles.user_id, EXCLUDED.user_id),
        email = COALESCE(public.user_profiles.email, EXCLUDED.email),
        username = COALESCE(public.user_profiles.username, EXCLUDED.username),
        avatar_url = COALESCE(public.user_profiles.avatar_url, EXCLUDED.avatar_url),
        role = COALESCE(public.user_profiles.role, EXCLUDED.role),
        troll_coins = COALESCE(public.user_profiles.troll_coins, 0),
        total_earned_coins = GREATEST(COALESCE(public.user_profiles.total_earned_coins, 0), 0),
        updated_at = NOW();

    -- Only write coin transaction if bonus > 0
    IF v_signup_coins > 0 THEN
        BEGIN
            INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
            VALUES (NEW.id, 'purchase', v_signup_coins, 'Welcome bonus coins!', NOW())
            ON CONFLICT DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error inserting coin_transaction for %: %', NEW.id, SQLERRM;
        END;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Note: We do NOT drop the existing trigger here to avoid breaking signup.
-- The existing handle_new_user_troll_coins and handle_user_signup functions
-- already grant 0 coins (from the 20290602000001 migration).
-- This new function is available for future use or manual trigger replacement.

-- ============================================================================
-- 19. FRIDAY BATTLE BONDS PER GIFT CAP (5% per gifter per battle)
-- Helper function to calculate Friday battle bonus with per-gifter cap
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_friday_battle_gifter_bonus(
    p_gifter_id UUID,
    p_battle_id UUID,
    p_gift_total_coins BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_cap BIGINT;
    v_bonus BIGINT;
    v_already_awarded BIGINT;
BEGIN
    -- Get the cap from settings
    SELECT friday_battle_bonus_cap_coins INTO v_cap
    FROM public.platform_economy_settings
    WHERE id = 1;
    v_cap := COALESCE(v_cap, 1000);

    -- Calculate 5% of gift total
    v_bonus := FLOOR(p_gift_total_coins * 0.05)::BIGINT;

    -- Check how much this gifter has already been awarded in this battle
    SELECT COALESCE(SUM(amount), 0)::BIGINT
    INTO v_already_awarded
    FROM public.coin_transactions
    WHERE user_id = p_gifter_id
      AND type = 'friday_battle_bonus'
      AND metadata->>'battle_id' = p_battle_id::TEXT;

    -- Apply cap: don't exceed the per-gifter per-battle cap
    IF v_already_awarded >= v_cap THEN
        RETURN 0;
    END IF;

    -- Reduce bonus if it would exceed cap
    IF v_already_awarded + v_bonus > v_cap THEN
        v_bonus := v_cap - v_already_awarded;
    END IF;

    RETURN GREATEST(0, v_bonus);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_friday_battle_gifter_bonus(UUID, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_friday_battle_gifter_bonus(UUID, UUID, BIGINT) TO service_role;

-- ============================================================================
-- 20. FRIDAY BATTLE BONDS ANTI-DUPLICATE CHECK
-- Prevents duplicate bonus claims from repeated refreshes/RPC calls
-- ============================================================================
CREATE OR REPLACE FUNCTION public.award_friday_battle_gifter_bonus(
    p_gifter_id UUID,
    p_battle_id UUID,
    p_gift_total_coins BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bonus BIGINT;
    v_txn_key TEXT;
    v_existing_id UUID;
BEGIN
    -- Idempotency key: gifter + battle
    v_txn_key := p_gifter_id::TEXT || '_' || p_battle_id::TEXT || '_friday_battle';

    -- Check for existing bonus transaction (prevent duplicates)
    SELECT id INTO v_existing_id
    FROM public.coin_transactions
    WHERE user_id = p_gifter_id
      AND type = 'friday_battle_bonus'
      AND metadata->>'battle_id' = p_battle_id::TEXT
      AND metadata->>'txn_key' = v_txn_key;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'bonus_coins', 0,
            'duplicate', true,
            'message', 'Friday battle bonus already awarded for this gifter+battle'
        );
    END IF;

    -- Calculate bonus with cap
    v_bonus := public.calculate_friday_battle_gifter_bonus(p_gifter_id, p_battle_id, p_gift_total_coins);

    IF v_bonus <= 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'bonus_coins', 0,
            'message', 'Bonus cap reached or zero'
        );
    END IF;

    -- Credit the gifter
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_bonus
    WHERE id = p_gifter_id;

    -- Write coin transaction with idempotency key
    INSERT INTO public.coin_transactions (
        user_id, amount, type, transaction_type, metadata
    ) VALUES (
        p_gifter_id,
        v_bonus,
        'friday_battle_bonus',
        'friday_battle_bonus',
        jsonb_build_object(
            'battle_id', p_battle_id::TEXT,
            'gift_total_coins', p_gift_total_coins,
            'bonus_percentage', 5,
            'txn_key', v_txn_key,
            'source', 'friday_battle_gifter_bonus'
        )
    );

    -- Consume from reward pool budget
    PERFORM public.consume_reward_budget(v_bonus, 'other_sink');

    RETURN jsonb_build_object(
        'success', true,
        'bonus_coins', v_bonus,
        'duplicate', false
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_friday_battle_gifter_bonus(UUID, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_friday_battle_gifter_bonus(UUID, UUID, BIGINT) TO service_role;

-- ============================================================================
-- 21. LEAGUE REWARD DISTRIBUTION WITH CAP
-- Distributes league rewards capped at 1000 coins total, split between members
-- ============================================================================
CREATE OR REPLACE FUNCTION public.distribute_league_rewards_capped(
    p_league_event_id UUID,
    p_member_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_member_count INTEGER;
    v_share_per_member INTEGER;
    v_total_distributed INTEGER := 0;
    v_member_id UUID;
    v_budget_check JSONB;
BEGIN
    v_member_count := array_length(p_member_ids, 1);

    IF v_member_count IS NULL OR v_member_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No members provided');
    END IF;

    -- Get capped share per member
    v_share_per_member := public.calculate_league_reward_share(v_member_count);

    IF v_share_per_member <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Calculated share is 0');
    END IF;

    -- Check reward budget
    v_budget_check := public.check_reward_budget(v_share_per_member * v_member_count);
    IF (v_budget_check->>'allowed')::BOOLEAN = false THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Reward budget check failed',
            'budget_info', v_budget_check
        );
    END IF;

    -- Distribute to each member
    FOREACH v_member_id IN ARRAY p_member_ids
    LOOP
        UPDATE public.user_profiles
        SET troll_coins = COALESCE(troll_coins, 0) + v_share_per_member
        WHERE id = v_member_id;

        INSERT INTO public.coin_transactions (
            user_id, amount, type, transaction_type, metadata
        ) VALUES (
            v_member_id,
            v_share_per_member,
            'league_reward',
            'league_reward',
            jsonb_build_object(
                'league_event_id', p_league_event_id::TEXT,
                'member_count', v_member_count,
                'share_per_member', v_share_per_member,
                'source', 'league_reward_capped'
            )
        );

        v_total_distributed := v_total_distributed + v_share_per_member;
    END LOOP;

    -- Consume from reward pool
    PERFORM public.consume_reward_budget(v_total_distributed, 'other_sink');

    RETURN jsonb_build_object(
        'success', true,
        'total_distributed', v_total_distributed,
        'share_per_member', v_share_per_member,
        'member_count', v_member_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.distribute_league_rewards_capped(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.distribute_league_rewards_capped(UUID, UUID[]) TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.platform_economy_settings IS 'Central admin control for all economy caps, toggles, and bonus settings';
COMMENT ON TABLE public.cashout_bonus_grants IS 'Tracks all manual and promo cashout bonuses granted by admin or system';
COMMENT ON TABLE public.platform_reward_pool IS 'Tracks platform revenue sources and available reward budget for giveaways/bonuses';
COMMENT ON FUNCTION public.check_reward_budget IS 'Core budget check function - all reward systems must call this before issuing coins';
COMMENT ON FUNCTION public.apply_new_user_cashout_bonus IS 'Applies new user cashout bonus for first N promo users (NOT signup bonus)';
COMMENT ON FUNCTION public.admin_grant_cashout_bonus IS 'Admin tool to manually grant cashout bonus to any user';
COMMENT ON FUNCTION public.award_friday_battle_gifter_bonus IS 'Awards 5% Friday battle bonus per gifter per battle with cap and duplicate prevention';
COMMENT ON FUNCTION public.distribute_league_rewards_capped IS 'Distributes league rewards capped at 1000 coins total split between members';

COMMIT;
