-- =============================================================================
-- Supporter Economy System Migration
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: Config Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.supporter_economy_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    config_type TEXT NOT NULL DEFAULT 'text' CHECK (config_type IN ('text', 'integer', 'boolean', 'jsonb')),
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.supporter_economy_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_config" ON public.supporter_economy_config ; CREATE POLICY "public_read_config" ON public.supporter_economy_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_update_config" ON public.supporter_economy_config ; CREATE POLICY "admin_update_config" ON public.supporter_economy_config FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role = 'admin'))
);

INSERT INTO public.supporter_economy_config (config_key, config_value, config_type, description) VALUES
    ('weekly_cashback_rate', '0.025', 'text', 'Cashback rate as decimal'),
    ('weekly_cashback_day', 'friday', 'text', 'Day of week for cashback distribution'),
    ('weekly_cashback_min_gifts', '3', 'integer', 'Minimum number of gifts per week to qualify'),
    ('weekly_cashback_min_coins', '100', 'integer', 'Minimum total coins spent per week to qualify'),
    ('wishlist_min_contribution', '100', 'integer', 'Minimum coins contributed to complete a wishlist'),
    ('gifter_leaderboard_period_days', '7', 'integer', 'Number of days for gifter leaderboard'),
    ('gifter_leaderboard_top_n', '100', 'integer', 'Top N gifters shown on leaderboard'),
    ('fan_crown_min_contribution', '500', 'integer', 'Minimum coins to qualify for fan crown'),
    ('free_subscription_tier_name', 'Fan Supporter', 'text', 'Name of the free subscription tier'),
    ('epaper_enabled', 'true', 'boolean', 'Whether EPaper system is active'),
    ('epaper_max_stories_per_day', '5', 'integer', 'Max stories published per day'),
    ('epaper_max_stories_per_week', '20', 'integer', 'Max stories published per week')
ON CONFLICT (config_key) DO NOTHING;

-- =============================================================================
-- PART 2: Weekly Cashback Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.weekly_cashback_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid')),
    total_eligible_senders BIGINT DEFAULT 0,
    total_cashback_coins BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.weekly_cashback_eligible (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.weekly_cashback_periods(id) ON DELETE CASCADE,
    total_gifts INTEGER DEFAULT 0,
    total_coins_spent BIGINT DEFAULT 0,
    total_coins_back BIGINT DEFAULT 0,
    cashback_amount BIGINT DEFAULT 0,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, period_id)
);

CREATE TABLE IF NOT EXISTS public.weekly_cashback_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.weekly_cashback_periods(id) ON DELETE CASCADE,
    eligible_id UUID REFERENCES public.weekly_cashback_eligible(id),
    amount BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    txn_id TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wcb_periods_start ON public.weekly_cashback_periods(period_start);
CREATE INDEX IF NOT EXISTS idx_wcb_periods_status ON public.weekly_cashback_periods(status);
CREATE INDEX IF NOT EXISTS idx_wcb_eligible_user ON public.weekly_cashback_eligible(user_id);
CREATE INDEX IF NOT EXISTS idx_wcb_eligible_period ON public.weekly_cashback_eligible(period_id);
CREATE INDEX IF NOT EXISTS idx_wcb_payouts_user ON public.weekly_cashback_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_wcb_payouts_status ON public.weekly_cashback_payouts(status);

ALTER TABLE public.weekly_cashback_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_cashback_eligible ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_cashback_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_periods" ON public.weekly_cashback_periods ; CREATE POLICY "public_read_periods" ON public.weekly_cashback_periods FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_read_periods" ON public.weekly_cashback_periods ; CREATE POLICY "admin_read_periods" ON public.weekly_cashback_periods FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role = 'admin'))
);
DROP POLICY IF EXISTS "user_read_own_eligible" ON public.weekly_cashback_eligible ; CREATE POLICY "user_read_own_eligible" ON public.weekly_cashback_eligible FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin_read_eligible" ON public.weekly_cashback_eligible ; CREATE POLICY "admin_read_eligible" ON public.weekly_cashback_eligible FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role = 'admin'))
);
DROP POLICY IF EXISTS "user_read_own_payouts" ON public.weekly_cashback_payouts ; CREATE POLICY "user_read_own_payouts" ON public.weekly_cashback_payouts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin_read_payouts" ON public.weekly_cashback_payouts ; CREATE POLICY "admin_read_payouts" ON public.weekly_cashback_payouts FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role = 'admin'))
);

-- =============================================================================
-- PART 3: Gifter Recognition Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gifter_stats_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    stats_date DATE NOT NULL,
    total_gifts INTEGER DEFAULT 0,
    total_coins_spent BIGINT DEFAULT 0,
    total_coins_back BIGINT DEFAULT 0,
    unique_recipients INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, stats_date)
);

CREATE TABLE IF NOT EXISTS public.gifter_stats_weekly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_gifts INTEGER DEFAULT 0,
    total_coins_spent BIGINT DEFAULT 0,
    total_coins_back BIGINT DEFAULT 0,
    unique_recipients INTEGER DEFAULT 0,
    rank INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, period_start)
);

CREATE TABLE IF NOT EXISTS public.gifter_leaderboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    total_gifts INTEGER NOT NULL,
    total_coins_spent BIGINT NOT NULL,
    total_coins_back BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_start, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gifter_daily_user ON public.gifter_stats_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_gifter_daily_date ON public.gifter_stats_daily(stats_date);
CREATE INDEX IF NOT EXISTS idx_gifter_weekly_user ON public.gifter_stats_weekly(user_id);
CREATE INDEX IF NOT EXISTS idx_gifter_weekly_period ON public.gifter_stats_weekly(period_start);
CREATE INDEX IF NOT EXISTS idx_gifter_lb_period ON public.gifter_leaderboards(period_start);
CREATE INDEX IF NOT EXISTS idx_gifter_lb_rank ON public.gifter_leaderboards(rank);

ALTER TABLE public.gifter_stats_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gifter_stats_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gifter_leaderboards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_gifter_stats" ON public.gifter_stats_daily ; CREATE POLICY "public_read_gifter_stats" ON public.gifter_stats_daily FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read_gifter_weekly" ON public.gifter_stats_weekly ; CREATE POLICY "public_read_gifter_weekly" ON public.gifter_stats_weekly FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read_gifter_leaderboard" ON public.gifter_leaderboards ; CREATE POLICY "public_read_gifter_leaderboard" ON public.gifter_leaderboards FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_write_gifter_stats" ON public.gifter_stats_daily ; CREATE POLICY "admin_write_gifter_stats" ON public.gifter_stats_daily FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role = 'admin'))
);
DROP POLICY IF EXISTS "admin_write_gifter_weekly" ON public.gifter_stats_weekly ; CREATE POLICY "admin_write_gifter_weekly" ON public.gifter_stats_weekly FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role = 'admin'))
);
DROP POLICY IF EXISTS "admin_write_gifter_leaderboard" ON public.gifter_leaderboards ; CREATE POLICY "admin_write_gifter_leaderboard" ON public.gifter_leaderboards FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role = 'admin'))
);

-- =============================================================================
-- PART 4: Broadcaster Wishlist Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.broadcaster_wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcaster_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (LENGTH(title) >= 1 AND LENGTH(title) <= 200),
    description TEXT DEFAULT '',
    target_amount BIGINT NOT NULL DEFAULT 100 CHECK (target_amount > 0),
    current_amount BIGINT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    completed_at TIMESTAMPTZ,
    stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wishlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wishlist_id UUID NOT NULL REFERENCES public.broadcaster_wishlists(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (LENGTH(title) >= 1 AND LENGTH(title) <= 300),
    description TEXT DEFAULT '',
    target_amount BIGINT NOT NULL CHECK (target_amount > 0),
    current_amount BIGINT DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wishlist_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wishlist_id UUID NOT NULL REFERENCES public.broadcaster_wishlists(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.wishlist_items(id) ON DELETE SET NULL,
    backer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL CHECK (amount > 0),
    gift_txn_id TEXT,
    stream_gift_id BIGINT REFERENCES public.stream_gifts(id) ON DELETE SET NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wishlist_id, item_id, backer_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_broadcaster ON public.broadcaster_wishlists(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_status ON public.broadcaster_wishlists(status);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_list ON public.wishlist_items(wishlist_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_progress_item ON public.wishlist_progress(item_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_progress_backer ON public.wishlist_progress(backer_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_progress_gift ON public.wishlist_progress(stream_gift_id);

ALTER TABLE public.broadcaster_wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_wishlists" ON public.broadcaster_wishlists ; CREATE POLICY "public_read_wishlists" ON public.broadcaster_wishlists FOR SELECT USING (true);
DROP POLICY IF EXISTS "broadcaster_write_wishlists" ON public.broadcaster_wishlists ; CREATE POLICY "broadcaster_write_wishlists" ON public.broadcaster_wishlists FOR INSERT WITH CHECK (auth.uid() = broadcaster_id);
DROP POLICY IF EXISTS "broadcaster_update_wishlists" ON public.broadcaster_wishlists ; CREATE POLICY "broadcaster_update_wishlists" ON public.broadcaster_wishlists FOR UPDATE USING (auth.uid() = broadcaster_id);
DROP POLICY IF EXISTS "public_read_wishlist_items" ON public.wishlist_items ; CREATE POLICY "public_read_wishlist_items" ON public.wishlist_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "broadcaster_write_wishlist_items" ON public.wishlist_items ; CREATE POLICY "broadcaster_write_wishlist_items" ON public.wishlist_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.broadcaster_wishlists WHERE id = wishlist_id AND broadcaster_id = auth.uid())
);
DROP POLICY IF EXISTS "public_read_wishlist_progress" ON public.wishlist_progress ; CREATE POLICY "public_read_wishlist_progress" ON public.wishlist_progress FOR SELECT USING (true);
DROP POLICY IF EXISTS "backer_write_wishlist_progress" ON public.wishlist_progress ; CREATE POLICY "backer_write_wishlist_progress" ON public.wishlist_progress FOR INSERT WITH CHECK (auth.uid() = backer_id);

-- =============================================================================
-- PART 5: Fan Crown Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fan_crowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wishlist_id UUID NOT NULL REFERENCES public.broadcaster_wishlists(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.wishlist_items(id) ON DELETE SET NULL,
    winner_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL CHECK (amount > 0),
    gift_txn_id TEXT,
    stream_gift_id BIGINT REFERENCES public.stream_gifts(id) ON DELETE SET NULL,
    reason TEXT DEFAULT 'highest_contributor',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wishlist_id, winner_id)
);

CREATE INDEX IF NOT EXISTS idx_fan_crowns_wishlist ON public.fan_crowns(wishlist_id);
CREATE INDEX IF NOT EXISTS idx_fan_crowns_winner ON public.fan_crowns(winner_id);
CREATE INDEX IF NOT EXISTS idx_fan_crowns_created ON public.fan_crowns(created_at DESC);

ALTER TABLE public.fan_crowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_fan_crowns" ON public.fan_crowns ; CREATE POLICY "public_read_fan_crowns" ON public.fan_crowns FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_write_fan_crowns" ON public.fan_crowns ; CREATE POLICY "admin_write_fan_crowns" ON public.fan_crowns FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role = 'admin'))
);

-- =============================================================================
-- PART 6: Free Subscription Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.free_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    broadcaster_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tier_id UUID REFERENCES public.subscription_tiers(id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'fan_crown' CHECK (source IN ('fan_crown', 'weekly_cashback', 'admin_grant')),
    source_id UUID,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_free_subs_subscriber ON public.free_subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_free_subs_broadcaster ON public.free_subscriptions(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_free_subs_active ON public.free_subscriptions(is_active);

ALTER TABLE public.free_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_free_subs" ON public.free_subscriptions ; CREATE POLICY "public_read_free_subs" ON public.free_subscriptions FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_write_free_subs" ON public.free_subscriptions ; CREATE POLICY "admin_write_free_subs" ON public.free_subscriptions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR role = 'admin'))
);

-- =============================================================================
-- PART 7: EPaper Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.epaper_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL CHECK (LENGTH(title) >= 1 AND LENGTH(title) <= 300),
    slug TEXT UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    featured_image_url TEXT,
    author_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    author_name TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'published', 'archived')),
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.user_profiles(id),
    category TEXT DEFAULT 'general',
    tags TEXT[],
    is_breaking BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    tip_count INTEGER DEFAULT 0,
    tip_total_coins BIGINT DEFAULT 0,
    meta_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.epaper_story_tips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES public.epaper_stories(id) ON DELETE CASCADE,
    tipper_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tipper_name TEXT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    coin_type TEXT NOT NULL DEFAULT 'troll_coins' CHECK (coin_type IN ('troll_coins', 'paid_coins')),
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_epaper_stories_status ON public.epaper_stories(status);
CREATE INDEX IF NOT EXISTS idx_epaper_stories_author ON public.epaper_stories(author_id);
CREATE INDEX IF NOT EXISTS idx_epaper_stories_published ON public.epaper_stories(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_epaper_stories_breaking ON public.epaper_stories(is_breaking) WHERE is_breaking = TRUE;
CREATE INDEX IF NOT EXISTS idx_epaper_tips_story ON public.epaper_story_tips(story_id);
CREATE INDEX IF NOT EXISTS idx_epaper_tips_tipper ON public.epaper_story_tips(tipper_id);

ALTER TABLE public.epaper_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epaper_story_tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_epaper_published" ON public.epaper_stories ; CREATE POLICY "public_read_epaper_published" ON public.epaper_stories FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "public_read_epaper_draft_owner" ON public.epaper_stories ; CREATE POLICY "public_read_epaper_draft_owner" ON public.epaper_stories FOR SELECT USING (
    auth.uid() = author_id OR status != 'draft'
);
DROP POLICY IF EXISTS "journalist_write_epaper" ON public.epaper_stories ; CREATE POLICY "journalist_write_epaper" ON public.epaper_stories FOR INSERT WITH CHECK (
    auth.uid() = author_id AND EXISTS (
        SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_journalist = TRUE OR is_news_caster = TRUE OR is_chief_news_caster = TRUE OR is_admin = TRUE OR role = 'admin')
    )
);
DROP POLICY IF EXISTS "author_update_epaper" ON public.epaper_stories ; CREATE POLICY "author_update_epaper" ON public.epaper_stories FOR UPDATE USING (auth.uid() = author_id);
DROP POLICY IF EXISTS "chief_review_epaper" ON public.epaper_stories ; CREATE POLICY "chief_review_epaper" ON public.epaper_stories FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_chief_news_caster = TRUE OR is_admin = TRUE OR role = 'admin'))
);
DROP POLICY IF EXISTS "public_read_epaper_tips" ON public.epaper_story_tips ; CREATE POLICY "public_read_epaper_tips" ON public.epaper_story_tips FOR SELECT USING (true);
DROP POLICY IF EXISTS "tipper_write_epaper_tips" ON public.epaper_story_tips ; CREATE POLICY "tipper_write_epaper_tips" ON public.epaper_story_tips FOR INSERT WITH CHECK (auth.uid() = tipper_id);

-- =============================================================================
-- PART 8: stream_gifts AFTER INSERT Trigger Function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_gift_supporter_economy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_is_test_user BOOLEAN;
    v_is_banned BOOLEAN;
    v_is_broadcaster BOOLEAN;
    v_coins_amount BIGINT;
    v_creator_share_coins BIGINT;
    v_sender_id UUID;
    v_receiver_id UUID;
    v_stream_id UUID;
    v_gift_txn_id TEXT;
    v_week_start TIMESTAMPTZ;
    v_week_end TIMESTAMPTZ;
    v_period_id UUID;
    v_cashback_rate NUMERIC;
    v_min_gifts INTEGER;
    v_min_coins BIGINT;
    v_cashback_amount BIGINT;
    v_existing_eligible UUID;
    v_wishlist_id UUID;
    v_item_id UUID;
    v_item_target BIGINT;
    v_item_current BIGINT;
    v_wishlist_target BIGINT;
    v_wishlist_current BIGINT;
    v_wishlist_status TEXT;
    v_crown_min BIGINT;
    v_leaderboard_start DATE;
    v_leaderboard_end DATE;
    v_rank INTEGER;
    v_tier_id UUID;
    v_tier_name TEXT;
BEGIN
    -- Extract key values from the new stream_gifts row
    v_sender_id := NEW.sender_id;
    v_receiver_id := NEW.receiver_id;
    v_stream_id := NEW.stream_id;
    v_gift_txn_id := NEW.txn_id;
    v_coins_amount := COALESCE(NEW.coins_amount, 0);
    v_creator_share_coins := COALESCE((NEW.metadata->>'creator_share_coins')::BIGINT, 0);

    -- Skip processing if this is a test user, self-gift, or zero-value gift
    SELECT is_test_user, is_banned, is_broadcaster
    INTO v_is_test_user, v_is_banned, v_is_broadcaster
    FROM public.user_profiles
    WHERE id = v_sender_id;

    IF NOT FOUND OR v_is_test_user OR v_is_banned OR (v_sender_id = v_receiver_id) THEN
        RETURN NEW;
    END IF;

    IF v_coins_amount <= 0 THEN
        RETURN NEW;
    END IF;

    -- ===================================================================
    -- A. Weekly Cashback Eligibility Tracking
    -- ===================================================================
    -- Determine the current weekly period (Friday to Thursday, America/Denver)
    v_week_start := date_trunc('week', (NEW.created_at AT TIME ZONE 'America/Denver')::DATE) + INTERVAL '4 days';
    IF (NEW.created_at AT TIME ZONE 'America/Denver')::DATE < v_week_start::DATE THEN
        v_week_start := v_week_start - INTERVAL '7 days';
    END IF;
    v_week_end := v_week_start + INTERVAL '6 days' + INTERVAL '23 hours 59 minutes 59 seconds';

    -- Find or create the cashback period
    SELECT id INTO v_period_id
    FROM public.weekly_cashback_periods
    WHERE period_start = v_week_start AND period_end = v_week_end
    LIMIT 1;

    IF v_period_id IS NULL THEN
        INSERT INTO public.weekly_cashback_periods (period_start, period_end, status)
        VALUES (v_week_start, v_week_end, 'open')
        RETURNING id INTO v_period_id;
    END IF;

    -- Upsert eligibility record
    INSERT INTO public.weekly_cashback_eligible (user_id, period_id, total_gifts, total_coins_spent, total_coins_back)
    VALUES (v_sender_id, v_period_id, 1, v_coins_amount, v_creator_share_coins)
    ON CONFLICT (user_id, period_id)
    DO UPDATE SET
        total_gifts = weekly_cashback_eligible.total_gifts + 1,
        total_coins_spent = weekly_cashback_eligible.total_coins_spent + v_coins_amount,
        total_coins_back = weekly_cashback_eligible.total_coins_back + v_creator_share_coins;

    -- ===================================================================
    -- B. Gifter Stats (Daily)
    -- ===================================================================
    INSERT INTO public.gifter_stats_daily (user_id, stats_date, total_gifts, total_coins_spent, total_coins_back, unique_recipients)
    VALUES (v_sender_id, (NEW.created_at AT TIME ZONE 'America/Denver')::DATE, 1, v_coins_amount, v_creator_share_coins, 1)
    ON CONFLICT (user_id, stats_date)
    DO UPDATE SET
        total_gifts = gifter_stats_daily.total_gifts + 1,
        total_coins_spent = gifter_stats_daily.total_coins_spent + v_coins_amount,
        total_coins_back = gifter_stats_daily.total_coins_back + v_creator_share_coins,
        unique_recipients = gifter_stats_daily.unique_recipients + CASE
            WHEN NOT EXISTS (
                SELECT 1 FROM gifter_stats_daily gsd2
                WHERE gsd2.user_id = v_sender_id
                AND gsd2.stats_date = (NEW.created_at AT TIME ZONE 'America/Denver')::DATE
            ) THEN 1 ELSE 0
        END;

    -- ===================================================================
    -- C. Broadcaster Wishlist Progress
    -- ===================================================================
    -- Check if the receiver is a broadcaster with an active wishlist
    IF v_is_broadcaster AND v_stream_id IS NOT NULL AND v_creator_share_coins > 0 THEN
        SELECT w.id, w.target_amount, w.current_amount, w.status
        INTO v_wishlist_id, v_wishlist_target, v_wishlist_current, v_wishlist_status
        FROM public.broadcaster_wishlists w
        WHERE w.broadcaster_id = v_receiver_id
          AND w.status = 'active'
        ORDER BY w.created_at DESC
        LIMIT 1;

        IF FOUND AND v_wishlist_id IS NOT NULL THEN
            -- Update wishlist current amount
            UPDATE public.broadcaster_wishlists
            SET current_amount = LEAST(current_amount + v_creator_share_coins, target_amount),
                updated_at = NOW()
            WHERE id = v_wishlist_id;

            -- Check if wishlist is now completed
            IF (SELECT current_amount FROM public.broadcaster_wishlists WHERE id = v_wishlist_id) >= target_amount
               AND v_wishlist_status = 'active' THEN
                UPDATE public.broadcaster_wishlists
                SET status = 'completed', completed_at = NOW(), updated_at = NOW()
                WHERE id = v_wishlist_id;

                -- Award Fan Crown to the highest contributor
                -- We check all progress for this wishlist
                INSERT INTO public.fan_crowns (wishlist_id, winner_id, amount, gift_txn_id, stream_gift_id, reason)
                SELECT
                    v_wishlist_id,
                    wp.backer_id,
                    wp.amount,
                    wp.gift_txn_id,
                    wp.stream_gift_id,
                    'highest_contributor'
                FROM public.wishlist_progress wp
                WHERE wp.wishlist_id = v_wishlist_id
                ORDER BY wp.amount DESC, wp.created_at ASC
                LIMIT 1;

                -- Award free subscription to the crown winner
                SELECT id INTO v_tier_id FROM public.subscription_tiers WHERE name = 'Fan Supporter' LIMIT 1;
                IF v_tier_id IS NOT NULL THEN
                    INSERT INTO public.free_subscriptions (subscriber_id, broadcaster_id, tier_id, source, source_id, started_at, expires_at, is_active)
                    SELECT
                        fc.winner_id,
                        v_receiver_id,
                        v_tier_id,
                        'fan_crown',
                        fc.id,
                        NOW(),
                        NOW() + INTERVAL '30 days',
                        TRUE
                    FROM public.fan_crowns fc
                    WHERE fc.wishlist_id = v_wishlist_id;
                END IF;
            END IF;
        END IF;
    END IF;

    -- ===================================================================
    -- D. Gifter Leaderboard Update (transactional, pre-aggregated)
    -- ===================================================================
    -- We update the daily stats; the weekly leaderboard is computed
    -- from daily stats by the finalize function, not here.

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Never fail the gift because of supporter economy processing
        RETURN NEW;
END;
$$;

-- =============================================================================
-- PART 9: RPC Functions
-- =============================================================================

-- Get weekly cashback status for a user
CREATE OR REPLACE FUNCTION public.get_weekly_cashback_status(p_user_id UUID)
RETURNS TABLE (
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    total_gifts INTEGER,
    total_coins_spent BIGINT,
    total_coins_back BIGINT,
    cashback_amount BIGINT,
    paid_at TIMESTAMPTZ,
    is_paid BOOLEAN,
    qualifies BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_week_start TIMESTAMPTZ;
    v_week_end TIMESTAMPTZ;
    v_min_gifts INTEGER;
    v_min_coins BIGINT;
BEGIN
    v_week_start := date_trunc('week', (NOW() AT TIME ZONE 'America/Denver')::DATE) + INTERVAL '4 days';
    IF (NOW() AT TIME ZONE 'America/Denver')::DATE < v_week_start::DATE THEN
        v_week_start := v_week_start - INTERVAL '7 days';
    END IF;
    v_week_end := v_week_start + INTERVAL '6 days' + INTERVAL '23 hours 59 minutes 59 seconds';

    SELECT config_value::INTEGER INTO v_min_gifts FROM public.supporter_economy_config WHERE config_key = 'weekly_cashback_min_gifts';
    SELECT config_value::BIGINT INTO v_min_coins FROM public.supporter_economy_config WHERE config_key = 'weekly_cashback_min_coins';

    RETURN QUERY
    SELECT
        wcp.period_start,
        wcp.period_end,
        COALESCE(wce.total_gifts, 0),
        COALESCE(wce.total_coins_spent, 0),
        COALESCE(wce.total_coins_back, 0),
        COALESCE(wce.cashback_amount, 0),
        wcpaid.paid_at,
        wcpaid.paid_at IS NOT NULL AS is_paid,
        COALESCE(wce.total_gifts, 0) >= v_min_gifts
           AND COALESCE(wce.total_coins_spent, 0) >= v_min_coins AS qualifies
    FROM public.weekly_cashback_periods wcp
    LEFT JOIN public.weekly_cashback_eligible wce
        ON wce.user_id = p_user_id AND wce.period_id = wcp.id
    LEFT JOIN public.weekly_cashback_payouts wcpaid
        ON wcpaid.user_id = p_user_id AND wcpaid.period_id = wcp.id AND wcpaid.status = 'paid'
    WHERE wcp.period_start = v_week_start AND wcp.period_end = v_week_end;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_cashback_status(UUID) TO authenticated;

-- Get broadcaster wishlist data
CREATE OR REPLACE FUNCTION public.get_broadcaster_wishlist_data(p_broadcaster_id UUID)
RETURNS TABLE (
    wishlist_id UUID,
    title TEXT,
    description TEXT,
    target_amount BIGINT,
    current_amount BIGINT,
    status TEXT,
    progress_percent NUMERIC,
    item_id UUID,
    item_title TEXT,
    item_target BIGINT,
    item_current BIGINT,
    item_completed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        bw.id,
        bw.title,
        bw.description,
        bw.target_amount,
        bw.current_amount,
        bw.status,
        CASE WHEN bw.target_amount > 0 THEN ROUND((bw.current_amount::NUMERIC / bw.target_amount) * 100, 2) ELSE 0 END,
        wi.id,
        wi.title,
        wi.target_amount,
        wi.current_amount,
        wi.is_completed
    FROM public.broadcaster_wishlists bw
    LEFT JOIN public.wishlist_items wi ON wi.wishlist_id = bw.id
    WHERE bw.broadcaster_id = p_broadcaster_id
    ORDER BY bw.created_at DESC, wi.sort_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_broadcaster_wishlist_data(UUID) TO authenticated;

-- Create a broadcaster wishlist
CREATE OR REPLACE FUNCTION public.create_broadcaster_wishlist(
    p_broadcaster_id UUID,
    p_title TEXT,
    p_description TEXT DEFAULT '',
    p_target_amount BIGINT DEFAULT 100
)
RETURNS TABLE(success BOOLEAN, wishlist_id UUID, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wishlist_id UUID;
BEGIN
    IF p_broadcaster_id IS NULL OR p_title IS NULL OR LENGTH(TRIM(p_title)) = 0 THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Title is required';
        RETURN;
    END IF;

    INSERT INTO public.broadcaster_wishlists (broadcaster_id, title, description, target_amount)
    VALUES (p_broadcaster_id, p_title, p_description, p_target_amount)
    RETURNING id INTO v_wishlist_id;

    RETURN QUERY SELECT TRUE, v_wishlist_id, 'Wishlist created';
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_broadcaster_wishlist(UUID, TEXT, TEXT, BIGINT) TO authenticated;

-- Add item to a wishlist
CREATE OR REPLACE FUNCTION public.add_wishlist_item(
    p_wishlist_id UUID,
    p_title TEXT,
    p_description TEXT DEFAULT '',
    p_target_amount BIGINT DEFAULT 100
)
RETURNS TABLE(success BOOLEAN, item_id UUID, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item_id UUID;
    v_broadcaster_id UUID;
BEGIN
    SELECT broadcaster_id INTO v_broadcaster_id
    FROM public.broadcaster_wishlists
    WHERE id = p_wishlist_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Wishlist not found';
        RETURN;
    END IF;

    IF auth.uid() != v_broadcaster_id THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Only the broadcaster can add items';
        RETURN;
    END IF;

    INSERT INTO public.wishlist_items (wishlist_id, title, description, target_amount)
    VALUES (p_wishlist_id, p_title, p_description, p_target_amount)
    RETURNING id INTO v_item_id;

    RETURN QUERY SELECT TRUE, v_item_id, 'Item added';
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_wishlist_item(UUID, TEXT, TEXT, BIGINT) TO authenticated;

-- Back a wishlist item (called from gift flow)
CREATE OR REPLACE FUNCTION public.back_wishlist_item(
    p_user_id UUID,
    p_item_id UUID,
    p_amount BIGINT,
    p_gift_txn_id TEXT DEFAULT NULL,
    p_stream_gift_id BIGINT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wishlist_id UUID;
    v_item_target BIGINT;
    v_item_current BIGINT;
    v_item_completed BOOLEAN;
BEGIN
    SELECT wi.wishlist_id, wi.target_amount, wi.current_amount, wi.is_completed
    INTO v_wishlist_id, v_item_target, v_item_current, v_item_completed
    FROM public.wishlist_items wi
    WHERE wi.id = p_item_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Wishlist item not found';
        RETURN;
    END IF;

    IF v_item_completed THEN
        RETURN QUERY SELECT FALSE, 'Item is already completed';
        RETURN;
    END IF;

    INSERT INTO public.wishlist_progress (wishlist_id, item_id, backer_id, amount, gift_txn_id, stream_gift_id)
    VALUES (v_wishlist_id, p_item_id, p_user_id, p_amount, p_gift_txn_id, p_stream_gift_id)
    ON CONFLICT (wishlist_id, item_id, backer_id)
    DO UPDATE SET amount = wishlist_progress.amount + p_amount;

    UPDATE public.wishlist_items
    SET current_amount = LEAST(current_amount + p_amount, target_amount),
        is_completed = CASE WHEN current_amount + p_amount >= target_amount THEN TRUE ELSE is_completed END,
        completed_at = CASE WHEN current_amount + p_amount >= target_amount THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_item_id;

    -- Update wishlist current_amount
    UPDATE public.broadcaster_wishlists
    SET current_amount = (SELECT COALESCE(SUM(current_amount), 0) FROM public.wishlist_items WHERE wishlist_id = v_wishlist_id),
        updated_at = NOW()
    WHERE id = v_wishlist_id
      AND EXISTS (
          SELECT 1 FROM public.wishlist_items wi2
          WHERE wi2.wishlist_id = v_wishlist_id AND wi2.is_completed = TRUE
      );

    RETURN QUERY SELECT TRUE, 'Backed successfully';
END;
$$;

GRANT EXECUTE ON FUNCTION public.back_wishlist_item(UUID, UUID, BIGINT, TEXT, BIGINT) TO authenticated;

-- Get gifter leaderboard
CREATE OR REPLACE FUNCTION public.get_gifter_leaderboard(
    p_type TEXT DEFAULT 'weekly',
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    rank INTEGER,
    user_id UUID,
    username TEXT,
    avatar_url TEXT,
    total_gifts INTEGER,
    total_coins_spent BIGINT,
    total_coins_back BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    IF p_type = 'daily' THEN
        v_period_start := (NOW() AT TIME ZONE 'America/Denver')::DATE;
        v_period_end := v_period_start;
    ELSIF p_type = 'weekly' THEN
        v_period_start := date_trunc('week', (NOW() AT TIME ZONE 'America/Denver')::DATE) + INTERVAL '4 days';
        IF (NOW() AT TIME ZONE 'America/Denver')::DATE < v_period_start::DATE THEN
            v_period_start := v_period_start - INTERVAL '7 days';
        END IF;
        v_period_end := v_period_start + INTERVAL '6 days';
    ELSE
        v_period_start := (NOW() AT TIME ZONE 'America/Denver')::DATE - INTERVAL '7 days';
        v_period_end := (NOW() AT TIME ZONE 'America/Denver')::DATE;
    END IF;

    RETURN QUERY
    SELECT
        ROW_NUMBER() OVER (ORDER BY SUM(gsd.total_coins_spent) DESC, SUM(gsd.total_gifts) DESC)::INTEGER AS rank,
        gsd.user_id,
        up.username,
        up.avatar_url,
        SUM(gsd.total_gifts)::INTEGER AS total_gifts,
        SUM(gsd.total_coins_spent) AS total_coins_spent,
        SUM(gsd.total_coins_back) AS total_coins_back
    FROM public.gifter_stats_daily gsd
    JOIN public.user_profiles up ON up.id = gsd.user_id
    WHERE gsd.stats_date BETWEEN v_period_start AND v_period_end
      AND up.is_banned = FALSE
      AND up.is_test_user = FALSE
    GROUP BY gsd.user_id, up.username, up.avatar_url
    ORDER BY SUM(gsd.total_coins_spent) DESC, SUM(gsd.total_gifts) DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_gifter_leaderboard(TEXT, INTEGER) TO authenticated;

-- Get fan crown status for a user
CREATE OR REPLACE FUNCTION public.get_fan_crown_status(p_user_id UUID)
RETURNS TABLE (
    has_crown BOOLEAN,
    total_crowns INTEGER,
    last_crown_at TIMESTAMPTZ,
    last_wishlist_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) > 0 AS has_crown,
        COUNT(*)::INTEGER AS total_crowns,
        MAX(fc.created_at) AS last_crown_at,
        (SELECT bw.title FROM public.broadcaster_wishlists bw WHERE bw.id = fc.wishlist_id LIMIT 1) AS last_wishlist_title
    FROM public.fan_crowns fc
    WHERE fc.winner_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_fan_crown_status(UUID) TO authenticated;

-- Get EPaper stories
CREATE OR REPLACE FUNCTION public.get_epaper_stories(
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_status TEXT DEFAULT 'published'
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    slug TEXT,
    excerpt TEXT,
    content TEXT,
    featured_image_url TEXT,
    author_id UUID,
    author_name TEXT,
    author_avatar TEXT,
    status TEXT,
    category TEXT,
    is_breaking BOOLEAN,
    view_count INTEGER,
    tip_count INTEGER,
    tip_total_coins BIGINT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        es.id,
        es.title,
        es.slug,
        es.excerpt,
        es.content,
        es.featured_image_url,
        es.author_id,
        COALESCE(es.author_name, up.username) AS author_name,
        up.avatar_url AS author_avatar,
        es.status::TEXT,
        es.category,
        es.is_breaking,
        es.view_count,
        es.tip_count,
        es.tip_total_coins,
        es.published_at,
        es.created_at
    FROM public.epaper_stories es
    LEFT JOIN public.user_profiles up ON es.author_id = up.id
    WHERE es.status = p_status
    ORDER BY
        CASE WHEN es.is_breaking THEN 0 ELSE 1 END,
        es.published_at DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_epaper_stories(INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_epaper_stories(INTEGER, INTEGER, TEXT) TO anon;

-- Get EPaper story by slug
CREATE OR REPLACE FUNCTION public.get_epaper_story(p_slug TEXT)
RETURNS TABLE (
    id UUID,
    title TEXT,
    slug TEXT,
    excerpt TEXT,
    content TEXT,
    featured_image_url TEXT,
    author_id UUID,
    author_name TEXT,
    author_avatar TEXT,
    status TEXT,
    category TEXT,
    is_breaking BOOLEAN,
    view_count INTEGER,
    tip_count INTEGER,
    tip_total_coins BIGINT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        es.id, es.title, es.slug, es.excerpt, es.content,
        es.featured_image_url, es.author_id,
        COALESCE(es.author_name, up.username) AS author_name,
        up.avatar_url AS author_avatar,
        es.status::TEXT, es.category, es.is_breaking,
        es.view_count, es.tip_count, es.tip_total_coins,
        es.published_at, es.created_at
    FROM public.epaper_stories es
    LEFT JOIN public.user_profiles up ON es.author_id = up.id
    WHERE es.slug = p_slug AND es.status = 'published';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_epaper_story(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_epaper_story(TEXT) TO anon;

-- Increment EPaper story views
CREATE OR REPLACE FUNCTION public.increment_epaper_views(p_story_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.epaper_stories
    SET view_count = view_count + 1
    WHERE id = p_story_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_epaper_views(UUID) TO authenticated;

-- Tip an EPaper story
CREATE OR REPLACE FUNCTION public.tip_epaper_story(
    p_story_id UUID,
    p_tipper_id UUID,
    p_amount BIGINT,
    p_coin_type TEXT DEFAULT 'troll_coins',
    p_message TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, error TEXT, tip_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tip_id UUID;
    v_tipper_name TEXT;
    v_story_title TEXT;
BEGIN
    SELECT username INTO v_tipper_name FROM public.user_profiles WHERE id = p_tipper_id;
    SELECT title INTO v_story_title FROM public.epaper_stories WHERE id = p_story_id;

    IF v_tipper_name IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Tipper not found', NULL::UUID;
        RETURN;
    END IF;

    IF v_story_title IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Story not found', NULL::UUID;
        RETURN;
    END IF;

    INSERT INTO public.epaper_story_tips (story_id, tipper_id, tipper_name, amount, coin_type, message)
    VALUES (p_story_id, p_tipper_id, v_tipper_name, p_amount, p_coin_type, p_message)
    RETURNING id INTO v_tip_id;

    UPDATE public.epaper_stories
    SET tip_count = tip_count + 1,
        tip_total_coins = tip_total_coins + p_amount
    WHERE id = p_story_id;

    RETURN QUERY SELECT TRUE, NULL::TEXT, v_tip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tip_epaper_story(UUID, UUID, BIGINT, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- PART 10: Triggers
-- =============================================================================

-- Trigger on stream_gifts: process supporter economy after each gift
DROP TRIGGER IF EXISTS trg_process_gift_supporter_economy ON public.stream_gifts;
CREATE TRIGGER trg_process_gift_supporter_economy
    AFTER INSERT ON public.stream_gifts
    FOR EACH ROW
    EXECUTE FUNCTION public.process_gift_supporter_economy();

-- Trigger to update updated_at on broadcaster_wishlists
CREATE OR REPLACE FUNCTION public.update_broadcaster_wishlists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_broadcaster_wishlists_updated_at ON public.broadcaster_wishlists;
CREATE TRIGGER trigger_broadcaster_wishlists_updated_at
    BEFORE UPDATE ON public.broadcaster_wishlists
    FOR EACH ROW
    EXECUTE FUNCTION public.update_broadcaster_wishlists_updated_at();

-- Trigger to update updated_at on wishlist_items
CREATE OR REPLACE FUNCTION public.update_wishlist_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_wishlist_items_updated_at ON public.wishlist_items;
CREATE TRIGGER trigger_wishlist_items_updated_at
    BEFORE UPDATE ON public.wishlist_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_wishlist_items_updated_at();

-- Trigger to update updated_at on epaper_stories
CREATE OR REPLACE FUNCTION public.update_epaper_stories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_epaper_stories_updated_at ON public.epaper_stories;
CREATE TRIGGER trigger_epaper_stories_updated_at
    BEFORE UPDATE ON public.epaper_stories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_epaper_stories_updated_at();

-- =============================================================================
-- PART 11: Grants
-- =============================================================================

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Allow authenticated users to read supporter economy data
GRANT SELECT ON public.supporter_economy_config TO authenticated;
GRANT SELECT ON public.weekly_cashback_periods TO authenticated;
GRANT SELECT ON public.weekly_cashback_eligible TO authenticated;
GRANT SELECT ON public.weekly_cashback_payouts TO authenticated;
GRANT SELECT ON public.gifter_stats_daily TO authenticated;
GRANT SELECT ON public.gifter_stats_weekly TO authenticated;
GRANT SELECT ON public.gifter_leaderboards TO authenticated;
GRANT SELECT ON public.broadcaster_wishlists TO authenticated;
GRANT SELECT ON public.wishlist_items TO authenticated;
GRANT SELECT ON public.wishlist_progress TO authenticated;
GRANT SELECT ON public.fan_crowns TO authenticated;
GRANT SELECT ON public.free_subscriptions TO authenticated;
GRANT SELECT ON public.epaper_stories TO authenticated;
GRANT SELECT ON public.epaper_story_tips TO authenticated;

-- Allow authenticated users to write their own data
GRANT INSERT ON public.broadcaster_wishlists TO authenticated;
GRANT INSERT ON public.wishlist_items TO authenticated;
GRANT INSERT ON public.wishlist_progress TO authenticated;
GRANT INSERT ON public.epaper_stories TO authenticated;
GRANT INSERT ON public.epaper_story_tips TO authenticated;
GRANT INSERT ON public.free_subscriptions TO authenticated;

-- Allow authenticated users to update their own data
GRANT UPDATE ON public.broadcaster_wishlists TO authenticated;
GRANT UPDATE ON public.wishlist_items TO authenticated;
GRANT UPDATE ON public.wishlist_progress TO authenticated;
GRANT UPDATE ON public.epaper_stories TO authenticated;
GRANT UPDATE ON public.free_subscriptions TO authenticated;

COMMIT;

