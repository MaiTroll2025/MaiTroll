-- ============================================================================
-- Mai Troll STORAGE & REPLAY BILLING SYSTEM
-- ============================================================================
-- Replay balance, storage top-ups, storage credits, and admin management
-- ============================================================================

-- 1. REPLAY BALANCE TABLE
-- Each creator has a dedicated replay balance for viewer playback charges
CREATE TABLE IF NOT EXISTS public.replay_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON delete CASCADE,
    balance BIGINT NOT NULL DEFAULT 0,
    minutes_today INTEGER NOT NULL DEFAULT 0,
    minutes_this_month INTEGER NOT NULL DEFAULT 0,
    coins_charged_today BIGINT NOT NULL DEFAULT 0,
    coins_charged_this_month BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted')),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_replay_balances_user_id ON public.replay_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_replay_balances_status ON public.replay_balances(status);

ALTER TABLE public.replay_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own replay balance" ON public.replay_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages replay balances" ON public.replay_balances FOR ALL USING (true);

-- 2. STORAGE TOP-UPS TABLE
-- Tracks one-time storage add-on purchases
CREATE TABLE IF NOT EXISTS public.storage_top_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON delete CASCADE,
    gb_added BIGINT NOT NULL,
    coins_charged BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_top_ups_user_id ON public.storage_top_ups(user_id);

ALTER TABLE public.storage_top_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own top-ups" ON public.storage_top_ups FOR SELECT USING (auth.uid() = user_id);

-- 3. STORAGE CREDITS TABLE
-- Admin-granted storage bonuses and credits
CREATE TABLE IF NOT EXISTS public.storage_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON delete CASCADE,
    gb_amount BIGINT NOT NULL,
    granted_by UUID REFERENCES public.user_profiles(id),
    reason TEXT,
    is_bonus BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_credits_user_id ON public.storage_credits(user_id);

ALTER TABLE public.storage_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own credits" ON public.storage_credits FOR SELECT USING (auth.uid() = user_id);

-- 4. REPLAY PLAYBACK LOG
-- Tracks every replay view for analytics
CREATE TABLE IF NOT EXISTS public.replay_playback_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON delete CASCADE,
    creator_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON delete CASCADE,
    viewer_user_id UUID REFERENCES public.user_profiles(id),
    minutes_watched NUMERIC NOT NULL DEFAULT 0,
    coins_charged BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replay_playback_stream ON public.replay_playback_log(stream_id);
CREATE INDEX IF NOT EXISTS idx_replay_playback_creator ON public.replay_playback_log(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_replay_playback_created ON public.replay_playback_log(created_at);

ALTER TABLE public.replay_playback_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators view own playback logs" ON public.replay_playback_log FOR SELECT USING (auth.uid() = creator_user_id);

-- 5. UPDATE USER_STORAGE_USAGE WITH TOP-UPS AND CREDITS
ALTER TABLE public.user_storage_usage
ADD COLUMN IF NOT EXISTS top_up_bytes BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_bytes BIGINT NOT NULL DEFAULT 0;

-- 6. UPDATE USER_STORAGE_PURCHASES WITH TOP-UPS AND CREDITS
ALTER TABLE public.user_storage_purchases
ADD COLUMN IF NOT EXISTS top_up_bytes BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_bytes BIGINT NOT NULL DEFAULT 0;

-- 7. RPC: GET USER STORAGE & REPLAY STATUS
CREATE OR REPLACE FUNCTION public.get_user_storage_replay_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_plan_tier_label TEXT;
    v_plan_monthly_fee INTEGER;
    v_plan_bytes_granted BIGINT;
    v_plan_is_active BOOLEAN;
    v_plan_next_billing_at TIMESTAMPTZ;
    v_plan_top_up_bytes BIGINT;
    v_plan_credit_bytes BIGINT;

    v_usage_total_bytes BIGINT;

    v_replay_balance BIGINT;
    v_replay_minutes_today INTEGER;
    v_replay_minutes_this_month INTEGER;
    v_replay_coins_charged_today BIGINT;
    v_replay_coins_charged_this_month BIGINT;
    v_replay_status TEXT;

    v_total_limit BIGINT;
    v_total_used BIGINT;
    v_total_available BIGINT;
    v_storage_pct NUMERIC;
    v_renewal_date TEXT;
BEGIN
    SELECT tier_label, monthly_fee, bytes_granted, is_active, next_billing_at, top_up_bytes, credit_bytes
    INTO v_plan_tier_label, v_plan_monthly_fee, v_plan_bytes_granted, v_plan_is_active, v_plan_next_billing_at, v_plan_top_up_bytes, v_plan_credit_bytes
    FROM public.user_storage_purchases
    WHERE user_id = p_user_id AND is_active = true
    ORDER BY purchased_at DESC
    LIMIT 1;

    IF NOT FOUND OR v_plan_is_active IS NULL THEN
        RETURN jsonb_build_object(
            'has_plan', false,
            'plan_label', '', 'plan_storage_bytes', 0, 'top_up_bytes', 0, 'credit_bytes', 0,
            'total_limit_bytes', 0, 'total_used_bytes', 0, 'total_available_bytes', 0,
            'storage_percentage', 0, 'renewal_date', NULL, 'monthly_fee', 0,
            'replay_balance', 0, 'replay_minutes_today', 0, 'replay_minutes_month', 0,
            'replay_coins_today', 0, 'replay_coins_month', 0, 'replay_status', 'active',
            'replay_cost_per_minute', 5
        );
    END IF;

    SELECT total_bytes INTO v_usage_total_bytes
    FROM public.user_storage_usage
    WHERE user_id = p_user_id;

    SELECT balance, minutes_today, minutes_this_month, coins_charged_today, coins_charged_this_month, status
    INTO v_replay_balance, v_replay_minutes_today, v_replay_minutes_this_month, v_replay_coins_charged_today, v_replay_coins_charged_this_month, v_replay_status
    FROM public.replay_balances
    WHERE user_id = p_user_id;

    v_total_limit := COALESCE(v_plan_bytes_granted, 0) + COALESCE(v_plan_top_up_bytes, 0) + COALESCE(v_plan_credit_bytes, 0);
    v_total_used := COALESCE(v_usage_total_bytes, 0);
    v_total_available := GREATEST(0, v_total_limit - v_total_used);
    v_storage_pct := CASE WHEN v_total_limit > 0 THEN ROUND((v_total_used::NUMERIC / v_total_limit::NUMERIC) * 100, 1) ELSE 0 END;
    v_renewal_date := CASE WHEN v_plan_next_billing_at IS NOT NULL THEN v_plan_next_billing_at::TEXT ELSE NULL END;

    RETURN jsonb_build_object(
        'has_plan', true,
        'plan_label', v_plan_tier_label,
        'plan_storage_bytes', v_plan_bytes_granted,
        'top_up_bytes', COALESCE(v_plan_top_up_bytes, 0),
        'credit_bytes', COALESCE(v_plan_credit_bytes, 0),
        'total_limit_bytes', v_total_limit,
        'total_used_bytes', v_total_used,
        'total_available_bytes', v_total_available,
        'storage_percentage', v_storage_pct,
        'renewal_date', v_renewal_date,
        'monthly_fee', v_plan_monthly_fee,
        'replay_balance', COALESCE(v_replay_balance, 0),
        'replay_minutes_today', COALESCE(v_replay_minutes_today, 0),
        'replay_minutes_month', COALESCE(v_replay_minutes_this_month, 0),
        'replay_coins_today', COALESCE(v_replay_coins_charged_today, 0),
        'replay_coins_month', COALESCE(v_replay_coins_charged_this_month, 0),
        'replay_status', COALESCE(v_replay_status, 'active'),
        'replay_cost_per_minute', 5
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: CHECK IF USER CAN RECORD
CREATE OR REPLACE FUNCTION public.can_user_record(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_plan RECORD;
    v_usage RECORD;
    v_total_limit BIGINT;
    v_total_used BIGINT;
    v_replay_status TEXT;
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
    SELECT * INTO v_plan
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

    v_total_limit := COALESCE(v_plan.bytes_granted, 0) + COALESCE(v_plan.top_up_bytes, 0) + COALESCE(v_plan.credit_bytes, 0);
    v_total_used := COALESCE(v_usage.total_bytes, 0);

    IF v_total_used >= v_total_limit THEN
        RETURN jsonb_build_object('can_record', false, 'reason', 'storage_full', 'action', 'upgrade_storage');
    END IF;

    -- Check replay balance status
    SELECT status INTO v_replay_status
    FROM public.replay_balances
    WHERE user_id = p_user_id;

    IF v_replay_status = 'restricted' THEN
        RETURN jsonb_build_object('can_record', false, 'reason', 'replay_restricted', 'action', 'add_replay_balance');
    END IF;

    RETURN jsonb_build_object(
        'can_record', true,
        'storage_available_gb', ROUND(GREATEST(0, v_total_limit - v_total_used)::NUMERIC / (1024*1024*1024), 2)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: RECORD REPLAY VIEW (called when viewer watches recorded content)
CREATE OR REPLACE FUNCTION public.record_replay_view(
    p_creator_user_id UUID,
    p_stream_id UUID,
    p_viewer_user_id UUID DEFAULT NULL,
    p_minutes_watched NUMERIC DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
    v_cost BIGINT;
    v_balance BIGINT;
    v_new_balance BIGINT;
BEGIN
    -- Admins are exempt from replay charges
    IF EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_creator_user_id
        AND (role = 'admin' OR is_admin = true OR role = 'superadmin' OR is_superadmin = true)
    ) THEN
        RETURN jsonb_build_object('success', true, 'charged', false, 'reason', 'admin_exempt');
    END IF;

    -- Calculate cost: 5 coins per minute
    v_cost := (p_minutes_watched * 5)::BIGINT;

    -- Get or create replay balance
    INSERT INTO public.replay_balances (user_id, balance, minutes_today, minutes_this_month, coins_charged_today, coins_charged_this_month)
    VALUES (p_creator_user_id, 0, 0, 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Check balance
    SELECT balance INTO v_balance
    FROM public.replay_balances
    WHERE user_id = p_creator_user_id;

    IF v_balance < v_cost THEN
        -- Restrict the creator
        UPDATE public.replay_balances
        SET status = 'restricted', last_updated = NOW()
        WHERE user_id = p_creator_user_id;

        RETURN jsonb_build_object('success', false, 'error', 'Replay playback unavailable. Creator replay balance exhausted.', 'restricted', true);
    END IF;

    -- Deduct from creator's replay balance (comes from their troll_coins)
    SELECT troll_coins INTO v_new_balance
    FROM public.user_profiles
    WHERE id = p_creator_user_id;

    IF v_new_balance < v_cost THEN
        UPDATE public.replay_balances SET status = 'restricted', last_updated = NOW() WHERE user_id = p_creator_user_id;
        RETURN jsonb_build_object('success', false, 'error', 'Replay playback unavailable. Creator replay balance exhausted.', 'restricted', true);
    END IF;

    -- Deduct troll coins from creator
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_cost, updated_at = NOW()
    WHERE id = p_creator_user_id;

    -- Record coin transaction
    INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
    VALUES (p_creator_user_id, -v_cost, 'replay_view',
            format('Replay view: %s min on stream %s', p_minutes_watched, p_stream_id),
            jsonb_build_object('stream_id', p_stream_id, 'minutes', p_minutes_watched, 'cost', v_cost));

    -- Update replay balance tracking
    UPDATE public.replay_balances
    SET balance = balance - v_cost,
        minutes_today = minutes_today + p_minutes_watched::INTEGER,
        minutes_this_month = minutes_this_month + p_minutes_watched::INTEGER,
        coins_charged_today = coins_charged_today + v_cost,
        coins_charged_this_month = coins_charged_this_month + v_cost,
        last_updated = NOW()
    WHERE user_id = p_creator_user_id;

    -- Log playback
    INSERT INTO public.replay_playback_log (stream_id, creator_user_id, viewer_user_id, minutes_watched, coins_charged)
    VALUES (p_stream_id, p_creator_user_id, p_viewer_user_id, p_minutes_watched, v_cost);

    RETURN jsonb_build_object(
        'success', true,
        'charged', v_cost,
        'minutes_watched', p_minutes_watched,
        'remaining_balance', v_balance - v_cost
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC: ADD REPLAY BALANCE (creator purchases replay coins)
CREATE OR REPLACE FUNCTION public.add_replay_balance(
    p_user_id UUID,
    p_coins_amount BIGINT
)
RETURNS JSONB AS $$
DECLARE
    v_current_balance BIGINT;
BEGIN
    IF p_coins_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
    END IF;

    -- Check user has enough troll coins
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id AND troll_coins >= p_coins_amount
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not enough Troll Coins');
    END IF;

    -- Deduct troll coins
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_coins_amount, updated_at = NOW()
    WHERE id = p_user_id;

    -- Record transaction
    INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
    VALUES (p_user_id, -p_coins_amount, 'replay_purchase',
            format('Replay balance purchase: %s coins', p_coins_amount),
            jsonb_build_object('coins', p_coins_amount));

    -- Add to replay balance
    INSERT INTO public.replay_balances (user_id, balance)
    VALUES (p_user_id, p_coins_amount)
    ON CONFLICT (user_id) DO UPDATE SET
        balance = replay_balances.balance + p_coins_amount,
        status = CASE WHEN replay_balances.status = 'restricted' AND replay_balances.balance + p_coins_amount > 0 THEN 'active' ELSE replay_balances.status END,
        last_updated = NOW();

    SELECT balance INTO v_current_balance FROM public.replay_balances WHERE user_id = p_user_id;

    RETURN jsonb_build_object('success', true, 'new_balance', v_current_balance, 'coins_spent', p_coins_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. RPC: PURCHASE STORAGE TOP-UP
CREATE OR REPLACE FUNCTION public.purchase_storage_top_up(
    p_user_id UUID,
    p_gb_amount BIGINT,
    p_coins_cost BIGINT
)
RETURNS JSONB AS $$
DECLARE
    v_plan_id UUID;
BEGIN
    IF p_gb_amount <= 0 OR p_coins_cost <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
    END IF;

    -- Check user has enough troll coins
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id AND troll_coins >= p_coins_cost
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not enough Troll Coins');
    END IF;

    -- Check user has an active plan
    SELECT id INTO v_plan_id
    FROM public.user_storage_purchases
    WHERE user_id = p_user_id AND is_active = true
    ORDER BY purchased_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'You need an active storage plan before purchasing top-ups');
    END IF;

    -- Deduct troll coins
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_coins_cost, updated_at = NOW()
    WHERE id = p_user_id;

    -- Record transaction
    INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
    VALUES (p_user_id, -p_coins_cost, 'storage_top_up',
            format('Storage top-up: +%s GB', p_gb_amount),
            jsonb_build_object('gb_added', p_gb_amount, 'coins', p_coins_cost));

    -- Add top-up to plan
    UPDATE public.user_storage_purchases
    SET top_up_bytes = COALESCE(top_up_bytes, 0) + (p_gb_amount * 1024 * 1024 * 1024)
    WHERE id = v_plan_id;

    -- Log top-up
    INSERT INTO public.storage_top_ups (user_id, gb_added, coins_charged)
    VALUES (p_user_id, p_gb_amount, p_coins_cost);

    RETURN jsonb_build_object('success', true, 'gb_added', p_gb_amount, 'coins_spent', p_coins_cost);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. RPC: ADMIN GRANT STORAGE CREDIT
CREATE OR REPLACE FUNCTION public.admin_grant_storage_credit(
    p_target_user_id UUID,
    p_gb_amount BIGINT,
    p_reason TEXT DEFAULT 'Admin grant'
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
    v_plan_id UUID;
BEGIN
    v_admin_id := auth.uid();

    -- Only admins can grant credits
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = v_admin_id
        AND (role = 'admin' OR is_admin = true OR role = 'superadmin' OR is_superadmin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only admins can grant storage credits');
    END IF;

    IF p_gb_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
    END IF;

    -- Find or create active plan for target user
    SELECT id INTO v_plan_id
    FROM public.user_storage_purchases
    WHERE user_id = p_target_user_id AND is_active = true
    ORDER BY purchased_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        -- Create a starter plan for them
        INSERT INTO public.user_storage_purchases (user_id, tier_index, tier_label, monthly_fee, bytes_granted, is_active, next_billing_at)
        VALUES (p_target_user_id, 0, 'Starter (Credit)', 0, 25 * 1024 * 1024 * 1024, true, NOW() + INTERVAL '30 days')
        RETURNING id INTO v_plan_id;
    END IF;

    -- Add credit to plan
    UPDATE public.user_storage_purchases
    SET credit_bytes = COALESCE(credit_bytes, 0) + (p_gb_amount * 1024 * 1024 * 1024)
    WHERE id = v_plan_id;

    -- Log credit
    INSERT INTO public.storage_credits (user_id, gb_amount, granted_by, reason, is_bonus)
    VALUES (p_target_user_id, p_gb_amount, v_admin_id, p_reason, true);

    RETURN jsonb_build_object('success', true, 'gb_granted', p_gb_amount, 'target_user', p_target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. RPC: ADMIN GRANT REPLAY BALANCE
CREATE OR REPLACE FUNCTION public.admin_grant_replay_balance(
    p_target_user_id UUID,
    p_coins_amount BIGINT,
    p_reason TEXT DEFAULT 'Admin grant'
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
BEGIN
    v_admin_id := auth.uid();

    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = v_admin_id
        AND (role = 'admin' OR is_admin = true OR role = 'superadmin' OR is_superadmin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only admins can grant replay balance');
    END IF;

    IF p_coins_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
    END IF;

    -- Add to replay balance
    INSERT INTO public.replay_balances (user_id, balance, status)
    VALUES (p_target_user_id, p_coins_amount, 'active')
    ON CONFLICT (user_id) DO UPDATE SET
        balance = replay_balances.balance + p_coins_amount,
        status = 'active',
        last_updated = NOW();

    RETURN jsonb_build_object('success', true, 'coins_granted', p_coins_amount, 'target_user', p_target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. RPC: GET ALL CREATORS STORAGE & REPLAY STATUS (for admin dashboard)
CREATE OR REPLACE FUNCTION public.admin_get_all_storage_replay()
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    plan_label TEXT,
    storage_limit_bytes BIGINT,
    storage_used_bytes BIGINT,
    storage_percentage NUMERIC,
    replay_balance BIGINT,
    replay_minutes_today INTEGER,
    replay_minutes_month INTEGER,
    replay_coins_month BIGINT,
    recording_count BIGINT,
    status TEXT,
    renewal_date TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        up.id,
        up.username,
        COALESCE(usp.tier_label, 'No Plan'),
        COALESCE(usp.bytes_granted, 0) + COALESCE(usp.top_up_bytes, 0) + COALESCE(usp.credit_bytes, 0),
        COALESCE(us.total_bytes, 0),
        CASE
            WHEN (COALESCE(usp.bytes_granted, 0) + COALESCE(usp.top_up_bytes, 0) + COALESCE(usp.credit_bytes, 0)) > 0
            THEN ROUND((COALESCE(us.total_bytes, 0)::NUMERIC / (COALESCE(usp.bytes_granted, 0) + COALESCE(usp.top_up_bytes, 0) + COALESCE(usp.credit_bytes, 0))::NUMERIC) * 100, 1)
            ELSE 0
        END,
        COALESCE(rb.balance, 0),
        COALESCE(rb.minutes_today, 0),
        COALESCE(rb.minutes_this_month, 0),
        COALESCE(rb.coins_charged_this_month, 0),
        (SELECT COUNT(*) FROM public.broadcast_replays br WHERE br.user_id = up.id),
        COALESCE(rb.status, 'active'),
        CASE WHEN usp.next_billing_at IS NOT NULL THEN usp.next_billing_at::TEXT ELSE NULL END
    FROM public.user_profiles up
    LEFT JOIN public.user_storage_purchases usp ON usp.user_id = up.id AND usp.is_active = true
    LEFT JOIN public.user_storage_usage us ON us.user_id = up.id
    LEFT JOIN public.replay_balances rb ON rb.user_id = up.id
    ORDER BY COALESCE(us.total_bytes, 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. RPC: GET CREATOR RECORDING ANALYTICS
CREATE OR REPLACE FUNCTION public.get_recording_analytics(p_creator_user_id UUID)
RETURNS TABLE (
    stream_id UUID,
    title TEXT,
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    total_views BIGINT,
    replay_minutes NUMERIC,
    coins_charged BIGINT,
    created_at TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        br.stream_id,
        br.title,
        br.duration_seconds,
        br.file_size_bytes,
        COALESCE((SELECT COUNT(*) FROM public.replay_playback_log rpl WHERE rpl.stream_id = br.stream_id), 0),
        COALESCE((SELECT SUM(rpl.minutes_watched) FROM public.replay_playback_log rpl WHERE rpl.stream_id = br.stream_id), 0),
        COALESCE((SELECT SUM(rpl.coins_charged) FROM public.replay_playback_log rpl WHERE rpl.stream_id = br.stream_id), 0),
        br.created_at::TEXT
    FROM public.broadcast_replays br
    WHERE br.user_id = p_creator_user_id
    ORDER BY br.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 16. FUNCTION: RESET DAILY/MONTHLY REPLAY COUNTERS (call via cron)
CREATE OR REPLACE FUNCTION public.reset_replay_daily_counters()
RETURNS void AS $$
BEGIN
    UPDATE public.replay_balances
    SET minutes_today = 0, coins_charged_today = 0, last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reset_replay_monthly_counters()
RETURNS void AS $$
BEGIN
    UPDATE public.replay_balances
    SET minutes_this_month = 0, coins_charged_this_month = 0, last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 17. RPC: ADMIN CREDIT ALL USERS (storage or replay) with notification
CREATE OR REPLACE FUNCTION public.admin_credit_all_users(
    p_gb_amount BIGINT DEFAULT 0,
    p_replay_coins BIGINT DEFAULT 0,
    p_reason TEXT DEFAULT 'Admin bonus'
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
    v_user RECORD;
    v_count INTEGER := 0;
BEGIN
    v_admin_id := auth.uid();

    -- Only admins can credit all users
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = v_admin_id
        AND (role = 'admin' OR is_admin = true OR role = 'superadmin' OR is_superadmin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only admins can credit all users');
    END IF;

    IF p_gb_amount <= 0 AND p_replay_coins <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Must specify storage GB or replay coins amount');
    END IF;

    -- Credit each user
    FOR v_user IN SELECT id FROM public.user_profiles LOOP
        -- Grant storage if specified
        IF p_gb_amount > 0 THEN
            -- Find or create active plan
            DECLARE
                v_plan_id UUID;
            BEGIN
                SELECT id INTO v_plan_id
                FROM public.user_storage_purchases
                WHERE user_id = v_user.id AND is_active = true
                ORDER BY purchased_at DESC
                LIMIT 1;

                IF NOT FOUND THEN
                    INSERT INTO public.user_storage_purchases (user_id, tier_index, tier_label, monthly_fee, bytes_granted, is_active, next_billing_at)
                    VALUES (v_user.id, 0, 'Starter (Credit)', 0, 25 * 1024 * 1024 * 1024, true, NOW() + INTERVAL '30 days')
                    RETURNING id INTO v_plan_id;
                END IF;

                UPDATE public.user_storage_purchases
                SET credit_bytes = COALESCE(credit_bytes, 0) + (p_gb_amount * 1024 * 1024 * 1024)
                WHERE id = v_plan_id;

                INSERT INTO public.storage_credits (user_id, gb_amount, granted_by, reason, is_bonus)
                VALUES (v_user.id, p_gb_amount, v_admin_id, p_reason, true);
            END;
        END IF;

        -- Grant replay balance if specified
        IF p_replay_coins > 0 THEN
            INSERT INTO public.replay_balances (user_id, balance, status)
            VALUES (v_user.id, p_replay_coins, 'active')
            ON CONFLICT (user_id) DO UPDATE SET
                balance = replay_balances.balance + p_replay_coins,
                status = 'active',
                last_updated = NOW();
        END IF;

        -- Create notification for user
        INSERT INTO public.notifications (user_id, type, title, message, metadata, is_read)
        VALUES (
            v_user.id,
            'admin_credit',
            'Bonus Credits Received!',
            CASE
                WHEN p_gb_amount > 0 AND p_replay_coins > 0 THEN format('You received %s GB storage + %s replay coins from admin!', p_gb_amount, p_replay_coins)
                WHEN p_gb_amount > 0 THEN format('You received %s GB storage bonus from admin!', p_gb_amount)
                ELSE format('You received %s replay coins from admin!', p_replay_coins)
            END,
            jsonb_build_object('gb_amount', p_gb_amount, 'replay_coins', p_replay_coins, 'reason', p_reason),
            false
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'users_credited', v_count, 'gb_per_user', p_gb_amount, 'replay_coins_per_user', p_replay_coins);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 18. Allow SECURITY DEFINER functions to insert notifications
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
CREATE POLICY "Service role can insert notifications" ON notifications FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Admins can insert notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'superadmin'))
);
