-- ============================================
-- 2026-09-03 Gift Undo + Friday Battle Bonus
-- ============================================

-- 1. Add reversal tracking to stream_gifts
ALTER TABLE public.stream_gifts
  ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stream_gifts_reversed
  ON public.stream_gifts(sender_id, is_reversed, created_at)
  WHERE is_reversed = false;

-- 2. Friday battle reward infrastructure
CREATE TABLE IF NOT EXISTS public.platform_economy_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    signup_bonus_enabled BOOLEAN NOT NULL DEFAULT false,
    signup_bonus_coins INTEGER NOT NULL DEFAULT 100 CHECK (signup_bonus_coins >= 0 AND signup_bonus_coins <= 100),
    new_user_cashout_bonus_enabled BOOLEAN NOT NULL DEFAULT false,
    new_user_cashout_bonus_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00 CHECK (new_user_cashout_bonus_percent >= 0 AND new_user_cashout_bonus_percent <= 100),
    new_user_cashout_bonus_max_users INTEGER NOT NULL DEFAULT 10 CHECK (new_user_cashout_bonus_max_users >= 0),
    new_user_cashout_bonus_used_count INTEGER NOT NULL DEFAULT 0 CHECK (new_user_cashout_bonus_used_count >= 0),
    new_user_cashout_bonus_max_per_user_coins BIGINT NOT NULL DEFAULT 100000 CHECK (new_user_cashout_bonus_max_per_user_coins >= 0),
    friday_battle_bonus_cap_coins BIGINT NOT NULL DEFAULT 1000 CHECK (friday_battle_bonus_cap_coins >= 0),
    league_reward_cap_coins INTEGER NOT NULL DEFAULT 1000 CHECK (league_reward_cap_coins >= 0),
    level_reward_cap_coins INTEGER NOT NULL DEFAULT 500 CHECK (level_reward_cap_coins >= 0),
    giveaway_reward_budget_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (giveaway_reward_budget_percent >= 0 AND giveaway_reward_budget_percent <= 100),
    global_reward_system_enabled BOOLEAN NOT NULL DEFAULT true,
    require_revenue_pool_check BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_economy_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

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

ALTER TABLE public.platform_reward_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage reward pool" ON public.platform_reward_pool;
CREATE POLICY "Admins can manage reward pool" ON public.platform_reward_pool
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Public read reward pool" ON public.platform_reward_pool
    FOR SELECT TO authenticated USING (true);

-- 3. Friday battle bonus functions
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
    SELECT * INTO v_settings FROM public.platform_economy_settings WHERE id = 1;

    IF v_settings.global_reward_system_enabled = false THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Global reward system is disabled by admin');
    END IF;

    IF v_settings.require_revenue_pool_check = false THEN
        RETURN jsonb_build_object('allowed', true);
    END IF;

    v_current_period_start := date_trunc('month', CURRENT_DATE)::DATE;
    v_current_period_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    SELECT COALESCE(SUM(revenue_coins), 0) INTO v_total_revenue
    FROM public.platform_reward_pool
    WHERE period_start = v_current_period_start AND period_end = v_current_period_end;

    IF v_total_revenue = 0 THEN
        RETURN jsonb_build_object('allowed', true);
    END IF;

    v_budget_limit := FLOOR(v_total_revenue * (v_settings.giveaway_reward_budget_percent / 100.0))::BIGINT;

    SELECT COALESCE(SUM(used_reward_budget_coins), 0) INTO v_used_budget
    FROM public.platform_reward_pool
    WHERE period_start = v_current_period_start AND period_end = v_current_period_end;

    v_available_budget := GREATEST(0, v_budget_limit - v_used_budget);

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

    RETURN jsonb_build_object('allowed', true, 'available', v_available_budget, 'budget_limit', v_budget_limit, 'used_budget', v_used_budget);
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_reward_budget(p_coins_granted BIGINT, p_source TEXT DEFAULT 'other_sink')
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

    SELECT id INTO v_pool_record
    FROM public.platform_reward_pool
    WHERE revenue_source = p_source AND period_start = v_current_period_start AND period_end = v_current_period_end;

    IF v_pool_record IS NOT NULL THEN
        UPDATE public.platform_reward_pool SET used_reward_budget_coins = used_reward_budget_coins + p_coins_granted WHERE id = v_pool_record;
    ELSE
        INSERT INTO public.platform_reward_pool (revenue_source, revenue_coins, available_reward_budget_coins, used_reward_budget_coins, period_start, period_end)
        VALUES (p_source, 0, 0, p_coins_granted, v_current_period_start, v_current_period_end);
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_reward_budget(BIGINT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.calculate_friday_battle_gifter_bonus(p_gifter_id UUID, p_battle_id UUID, p_gift_total_coins BIGINT)
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
    SELECT friday_battle_bonus_cap_coins INTO v_cap FROM public.platform_economy_settings WHERE id = 1;
    v_cap := COALESCE(v_cap, 1000);

    v_bonus := FLOOR(p_gift_total_coins * 0.05)::BIGINT;

    SELECT COALESCE(SUM(amount), 0)::BIGINT INTO v_already_awarded
    FROM public.coin_transactions
    WHERE user_id = p_gifter_id AND type = 'friday_battle_bonus' AND metadata->>'battle_id' = p_battle_id::TEXT;

    IF v_already_awarded >= v_cap THEN RETURN 0; END IF;
    IF v_already_awarded + v_bonus > v_cap THEN v_bonus := v_cap - v_already_awarded; END IF;

    RETURN GREATEST(0, v_bonus);
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_friday_battle_gifter_bonus(UUID, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_friday_battle_gifter_bonus(UUID, UUID, BIGINT) TO service_role;

CREATE OR REPLACE FUNCTION public.award_friday_battle_gifter_bonus(p_gifter_id UUID, p_battle_id UUID, p_gift_total_coins BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bonus BIGINT;
    v_txn_key TEXT;
    v_existing_id UUID;
BEGIN
    v_txn_key := p_gifter_id::TEXT || '_' || p_battle_id::TEXT || '_friday_battle';

    SELECT id INTO v_existing_id
    FROM public.coin_transactions
    WHERE user_id = p_gifter_id AND type = 'friday_battle_bonus' AND metadata->>'battle_id' = p_battle_id::TEXT AND metadata->>'txn_key' = v_txn_key;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'bonus_coins', 0, 'duplicate', true, 'message', 'Friday battle bonus already awarded for this gifter+battle');
    END IF;

    v_bonus := public.calculate_friday_battle_gifter_bonus(p_gifter_id, p_battle_id, p_gift_total_coins);

    IF v_bonus <= 0 THEN
        RETURN jsonb_build_object('success', true, 'bonus_coins', 0, 'message', 'Bonus cap reached or zero');
    END IF;

    UPDATE public.user_profiles SET troll_coins = COALESCE(troll_coins, 0) + v_bonus WHERE id = p_gifter_id;

    INSERT INTO public.coin_transactions (user_id, amount, type, transaction_type, metadata)
    VALUES (p_gifter_id, v_bonus, 'friday_battle_bonus', 'friday_battle_bonus',
        jsonb_build_object('battle_id', p_battle_id::TEXT, 'gift_total_coins', p_gift_total_coins, 'bonus_percentage', 5, 'txn_key', v_txn_key, 'source', 'friday_battle_gifter_bonus'));

    PERFORM public.consume_reward_budget(v_bonus, 'other_sink');

    RETURN jsonb_build_object('success', true, 'bonus_coins', v_bonus, 'duplicate', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_friday_battle_gifter_bonus(UUID, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_friday_battle_gifter_bonus(UUID, UUID, BIGINT) TO service_role;

GRANT EXECUTE ON FUNCTION public.check_reward_budget(BIGINT) TO service_role;

-- 4. Undo gift transaction RPC
CREATE OR REPLACE FUNCTION public.undo_gift_transaction(
    p_stream_gift_id TEXT,
    p_requester_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_gift public.stream_gifts%ROWTYPE;
    v_sender public.user_profiles%ROWTYPE;
    v_receiver public.user_profiles%ROWTYPE;
    v_battle_id UUID;
    v_is_challenger BOOLEAN;
    v_recipient_share INTEGER;
    v_leader_bonus INTEGER := 0;
    v_recruiter_bonus INTEGER := 0;
    v_leader_user_id UUID;
    v_recruiter_user_id UUID;
    v_sender_xp BIGINT;
    v_receiver_xp BIGINT;
    v_new_sender_coins BIGINT;
    v_new_receiver_coins BIGINT;
BEGIN
    IF p_stream_gift_id IS NULL OR p_requester_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Missing parameters');
    END IF;

    SELECT * INTO v_gift FROM public.stream_gifts WHERE id = p_stream_gift_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Gift not found');
    END IF;

    IF v_gift.is_reversed THEN
        RETURN jsonb_build_object('success', false, 'message', 'Gift already reversed');
    END IF;

    IF v_gift.sender_id != p_requester_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authorized');
    END IF;

    IF COALESCE(v_gift.metadata->>'source', 'stream_gift') = 'battle_gift' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot undo battle gifts');
    END IF;

    SELECT * INTO v_sender FROM public.user_profiles WHERE id = v_gift.sender_id FOR UPDATE;
    SELECT * INTO v_receiver FROM public.user_profiles WHERE id = v_gift.receiver_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'User profile not found');
    END IF;

    v_recipient_share := COALESCE((v_gift.metadata->>'creator_share_coins')::INTEGER, v_gift.coins_spent);
    v_leader_bonus := COALESCE((v_gift.metadata->>'leader_bonus_coins')::INTEGER, 0);
    v_recruiter_bonus := COALESCE((v_gift.metadata->>'recruiter_bonus_coins')::INTEGER, 0);

    IF v_leader_bonus > 0 THEN
        SELECT user_id INTO v_leader_user_id FROM public.agency_members WHERE agency_id = (SELECT agency_id FROM public.agency_members WHERE user_id = v_gift.receiver_id AND role = 'creator' AND status = 'active' LIMIT 1) AND role = 'manager' AND status = 'active' LIMIT 1;
        IF v_leader_user_id IS NULL THEN
            SELECT owner_id INTO v_leader_user_id FROM public.agencies WHERE id = (SELECT agency_id FROM public.agency_members WHERE user_id = v_gift.receiver_id AND role = 'creator' AND status = 'active' LIMIT 1);
        END IF;
    END IF;

    IF v_recruiter_bonus > 0 THEN
        SELECT user_id INTO v_recruiter_user_id FROM public.agency_members WHERE agency_id = (SELECT agency_id FROM public.agency_members WHERE user_id = v_gift.receiver_id AND role = 'creator' AND status = 'active' LIMIT 1) AND role = 'recruiter' AND status = 'active' LIMIT 1;
    END IF;

    v_new_sender_coins := COALESCE(v_sender.troll_coins, 0) + v_gift.coins_spent;
    UPDATE public.user_profiles SET troll_coins = v_new_sender_coins WHERE id = v_gift.sender_id;

    IF v_gift.trollmonds_transferred > 0 THEN
        UPDATE public.user_profiles SET trollmonds = COALESCE(trollmonds, 0) + v_gift.trollmonds_transferred WHERE id = v_gift.sender_id;
        UPDATE public.user_profiles SET trollmonds = COALESCE(trollmonds, 0) - v_gift.trollmonds_transferred WHERE id = v_gift.receiver_id AND COALESCE(trollmonds, 0) >= v_gift.trollmonds_transferred;
    END IF;

    v_new_receiver_coins := COALESCE(v_receiver.troll_coins, 0) - v_recipient_share;
    UPDATE public.user_profiles SET troll_coins = v_new_receiver_coins, total_earned_coins = COALESCE(total_earned_coins, 0) - v_recipient_share WHERE id = v_gift.receiver_id;

    IF v_leader_bonus > 0 AND v_leader_user_id IS NOT NULL THEN
        UPDATE public.user_profiles SET troll_coins = COALESCE(troll_coins, 0) - v_leader_bonus, total_earned_coins = COALESCE(total_earned_coins, 0) - v_leader_bonus WHERE id = v_leader_user_id;
    END IF;

    IF v_recruiter_bonus > 0 AND v_recruiter_user_id IS NOT NULL THEN
        UPDATE public.user_profiles SET troll_coins = COALESCE(troll_coins, 0) - v_recruiter_bonus, total_earned_coins = COALESCE(total_earned_coins, 0) - v_recruiter_bonus WHERE id = v_recruiter_user_id;
    END IF;

    IF v_gift.stream_id IS NOT NULL THEN
        UPDATE public.streams SET total_gifts_coins = COALESCE(total_gifts_coins, 0) - v_gift.coins_spent WHERE id = v_gift.stream_id;
    END IF;

    SELECT id INTO v_battle_id FROM public.battles WHERE (challenger_stream_id = v_gift.stream_id OR opponent_stream_id = v_gift.stream_id) AND status = 'active' LIMIT 1;

    IF v_battle_id IS NOT NULL THEN
        SELECT (challenger_stream_id = v_gift.stream_id) INTO v_is_challenger FROM public.battles WHERE id = v_battle_id;
        IF v_is_challenger THEN
            UPDATE public.battles SET score_challenger = COALESCE(score_challenger, 0) - v_gift.coins_spent, pot_challenger = COALESCE(pot_challenger, 0) - v_gift.coins_spent WHERE id = v_battle_id;
        ELSE
            UPDATE public.battles SET score_opponent = COALESCE(score_opponent, 0) - v_gift.coins_spent, pot_opponent = COALESCE(pot_opponent, 0) - v_gift.coins_spent WHERE id = v_battle_id;
        END IF;
    END IF;

    v_sender_xp := FLOOR(v_gift.coins_spent * 1.1);
    v_receiver_xp := FLOOR(v_gift.coins_spent * 1.0);

    IF v_sender_xp > 0 THEN
        UPDATE public.user_stats SET xp_total = GREATEST(0, COALESCE(xp_total, 0) - v_sender_xp), updated_at = NOW() WHERE user_id = v_gift.sender_id;
        DELETE FROM public.xp_ledger WHERE user_id = v_gift.sender_id AND source = 'gift_sent' AND source_id = 'gift_sent_' || v_gift.id;
    END IF;

    IF v_receiver_xp > 0 THEN
        UPDATE public.user_stats SET xp_total = GREATEST(0, COALESCE(xp_total, 0) - v_receiver_xp), updated_at = NOW() WHERE user_id = v_gift.receiver_id;
        DELETE FROM public.xp_ledger WHERE user_id = v_gift.receiver_id AND source = 'gift_received' AND source_id = 'gift_received_' || v_gift.id;
    END IF;

    INSERT INTO public.coin_transactions (user_id, amount, type, currency, transaction_type, stream_id, from_user_id, to_user_id, metadata)
    VALUES
    (v_gift.sender_id, v_gift.coins_spent, 'gift_return', 'coins', 'gift_return', v_gift.stream_id, v_gift.receiver_id, v_gift.sender_id,
        jsonb_build_object('original_stream_gift_id', v_gift.id, 'recipient_id', v_gift.receiver_id, 'stream_id', v_gift.stream_id, 'gift_id', v_gift.gift_id, 'gift_value', v_gift.coins_spent, 'reason', 'undo')),
    (v_gift.receiver_id, -v_recipient_share, 'gift_return', 'coins', 'gift_return', v_gift.stream_id, v_gift.sender_id, v_gift.receiver_id,
        jsonb_build_object('original_stream_gift_id', v_gift.id, 'sender_id', v_gift.sender_id, 'stream_id', v_gift.stream_id, 'gift_id', v_gift.gift_id, 'gift_value', v_gift.coins_spent, 'reason', 'undo'));

    UPDATE public.stream_gifts SET is_reversed = true, reversed_at = NOW() WHERE id = v_gift.id;

    RETURN jsonb_build_object(
        'success', true,
        'stream_gift_id', v_gift.id,
        'sender_id', v_gift.sender_id,
        'receiver_id', v_gift.receiver_id,
        'coins_restored', v_gift.coins_spent,
        'receiver_coins_removed', v_recipient_share,
        'sender_xp_removed', v_sender_xp,
        'receiver_xp_removed', v_receiver_xp,
        'battle_id', v_battle_id,
        'message', 'Gift undone successfully'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.undo_gift_transaction(TEXT, UUID) TO authenticated, anon, service_role;
