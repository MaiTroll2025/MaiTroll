-- Pride Month System Migration
-- Tables: pride_challenges, pride_user_progress, pride_keyword_config, pride_credit_xp_log
-- RPCs: pride_complete_challenge, pride_check_keyword_xp, pride_convert_credit_to_xp

-- 1. Pride Challenge Definitions
CREATE TABLE IF NOT EXISTS public.pride_challenges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- 'chat', 'engagement', 'social', 'general'
    xp_reward BIGINT NOT NULL DEFAULT 0,
    target_value BIGINT NOT NULL DEFAULT 1, -- how many times/action needed
    progress_type TEXT DEFAULT 'count', -- 'count', 'boolean', 'time'
    keyword_triggers TEXT[] DEFAULT '{}', -- keywords that count toward this challenge
    icon TEXT DEFAULT '🏳️‍🌈',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMPTZ DEFAULT now(),
    ends_at TIMESTAMPTZ, -- NULL = no end date
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User Progress on Pride Challenges
CREATE TABLE IF NOT EXISTS public.pride_user_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    challenge_id UUID REFERENCES public.pride_challenges(id) ON DELETE CASCADE NOT NULL,
    progress_value BIGINT DEFAULT 0,
    completion_percentage FLOAT DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, challenge_id)
);

-- 3. Keyword XP Configuration (admin-configurable keyword -> XP mapping)
CREATE TABLE IF NOT EXISTS public.pride_keyword_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    keyword TEXT NOT NULL,
    xp_reward BIGINT NOT NULL DEFAULT 5,
    challenge_id UUID REFERENCES public.pride_challenges(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    cooldown_seconds INT DEFAULT 30, -- per-user cooldown for same keyword
    daily_limit INT DEFAULT 50, -- max times this keyword can trigger XP per user per day
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(keyword)
);

-- 4. Credit-to-XP Conversion Log
CREATE TABLE IF NOT EXISTS public.pride_credit_xp_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    credits_spent BIGINT NOT NULL,
    xp_gained BIGINT NOT NULL,
    conversion_rate FLOAT NOT NULL, -- credits per XP at time of conversion
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Enable RLS
ALTER TABLE public.pride_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pride_user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pride_keyword_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pride_credit_xp_log ENABLE ROW LEVEL SECURITY;

-- 6. Policies
-- Challenges: public read, admin write
DO $$ BEGIN
    CREATE POLICY "Pride challenges are viewable by everyone" ON public.pride_challenges
        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can manage pride challenges" ON public.pride_challenges
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- User progress: users can view their own, insert/update their own
DO $$ BEGIN
    CREATE POLICY "Users can view own pride progress" ON public.pride_user_progress
        FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert own pride progress" ON public.pride_user_progress
        FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update own pride progress" ON public.pride_user_progress
        FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Keyword config: public read, admin write
DO $$ BEGIN
    CREATE POLICY "Pride keyword config is viewable by everyone" ON public.pride_keyword_config
        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Admins can manage pride keyword config" ON public.pride_keyword_config
        FOR ALL USING (
            EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Credit XP log: users can view their own
DO $$ BEGIN
    CREATE POLICY "Users can view own credit xp log" ON public.pride_credit_xp_log
        FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "System can insert credit xp log" ON public.pride_credit_xp_log
        FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. RPC: Check keyword and award XP
CREATE OR REPLACE FUNCTION pride_check_keyword_xp(
    p_user_id UUID,
    p_message TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_keyword RECORD;
    v_xp_amount BIGINT := 0;
    v_today_count BIGINT;
    v_last_triggered TIMESTAMPTZ;
    v_cooldown_ok BOOLEAN;
    v_daily_ok BOOLEAN;
    v_result JSONB := '[]'::jsonb;
    v_entry JSONB;
BEGIN
    -- Skip guest users
    IF p_user_id IS NULL OR p_user_id::text LIKE 'TC-%' THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Check each active keyword
    FOR v_keyword IN
        SELECT k.id, k.keyword, k.xp_reward, k.challenge_id, k.cooldown_seconds, k.daily_limit
        FROM public.pride_keyword_config k
        WHERE k.is_active = true
    LOOP
        -- Case-insensitive keyword match
        IF p_message ILIKE '%' || v_keyword.keyword || '%' THEN
            -- Check cooldown
            SELECT MAX(created_at) INTO v_last_triggered
            FROM public.xp_ledger
            WHERE user_id = p_user_id
              AND source = 'pride_keyword'
              AND source_id = v_keyword.id::text;

            v_cooldown_ok := (v_last_triggered IS NULL) OR
                             (v_last_triggered < now() - (v_keyword.cooldown_seconds || ' seconds')::interval);

            -- Check daily limit
            SELECT COUNT(*) INTO v_today_count
            FROM public.xp_ledger
            WHERE user_id = p_user_id
              AND source = 'pride_keyword'
              AND source_id = v_keyword.id::text
              AND created_at >= date_trunc('day', now());

            v_daily_ok := v_today_count < v_keyword.daily_limit;

            IF v_cooldown_ok AND v_daily_ok THEN
                -- Award XP via grant_xp
                PERFORM grant_xp(p_user_id, v_keyword.xp_reward, 'pride_keyword', v_keyword.id::text,
                    jsonb_build_object('keyword', v_keyword.keyword, 'message_length', length(p_message)));

                -- Update challenge progress if linked
                IF v_keyword.challenge_id IS NOT NULL THEN
                    INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed)
                    VALUES (p_user_id, v_keyword.challenge_id, 1, 0, false)
                    ON CONFLICT (user_id, challenge_id)
                    DO UPDATE SET
                        progress_value = public.pride_user_progress.progress_value + 1,
                        completion_percentage = LEAST(100, ((public.pride_user_progress.progress_value + 1)::float / NULLIF(
                            (SELECT target_value FROM public.pride_challenges WHERE id = v_keyword.challenge_id), 0
                        )) * 100),
                        is_completed = (public.pride_user_progress.progress_value + 1) >= (SELECT target_value FROM public.pride_challenges WHERE id = v_keyword.challenge_id),
                        updated_at = now();
                END IF;

                v_xp_amount := v_xp_amount + v_keyword.xp_reward;

                v_entry := jsonb_build_object(
                    'keyword', v_keyword.keyword,
                    'xp', v_keyword.xp_reward,
                    'challenge_id', v_keyword.challenge_id
                );
                v_result := v_result || v_entry;
            END IF;
        END IF;
    END LOOP;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Convert credit to XP
CREATE OR REPLACE FUNCTION pride_convert_credit_to_xp(
    p_user_id UUID,
    p_credits BIGINT
)
RETURNS JSONB AS $$
DECLARE
    v_current_credit BIGINT;
    v_xp_amount BIGINT;
    v_conversion_rate FLOAT := 100.0; -- 100 credits = 1 XP
    v_new_total BIGINT;
BEGIN
    -- Skip guest users
    IF p_user_id IS NULL OR p_user_id::text LIKE 'TC-%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Guest users cannot convert credits');
    END IF;

    -- Validate
    IF p_credits <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Must convert at least 1 credit');
    END IF;

    -- Get current credit score/available credits from user_profiles
    SELECT COALESCE(credit_score, 0) INTO v_current_credit
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF v_current_credit IS NULL OR v_current_credit < p_credits THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits');
    END IF;

    -- Calculate XP
    v_xp_amount := FLOOR(p_credits / v_conversion_rate)::bigint;
    IF v_xp_amount <= 0 THEN
        v_xp_amount := 1; -- minimum 1 XP
    END IF;

    -- Deduct credits from profile
    UPDATE public.user_profiles
    SET credit_score = credit_score - p_credits
    WHERE id = p_user_id;

    -- Award XP
    PERFORM grant_xp(p_user_id, v_xp_amount, 'pride_credit_conversion', gen_random_uuid()::text,
        jsonb_build_object('credits_spent', p_credits, 'conversion_rate', v_conversion_rate));

    -- Log conversion
    INSERT INTO public.pride_credit_xp_log (user_id, credits_spent, xp_gained, conversion_rate)
    VALUES (p_user_id, p_credits, v_xp_amount, v_conversion_rate);

    RETURN jsonb_build_object(
        'success', true,
        'credits_spent', p_credits,
        'xp_gained', v_xp_amount,
        'remaining_credits', v_current_credit - p_credits
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Seed default Pride challenges
INSERT INTO public.pride_challenges (slug, title, description, category, xp_reward, target_value, progress_type, keyword_triggers, icon, sort_order)
VALUES
    ('pride_spirit', 'Pride Spirit', 'Send 10 messages containing Pride keywords in chat', 'chat', 25, 10, 'count', ARRAY['pride', 'love', 'rainbow', 'lgbtq', 'equality'], '🏳️‍🌈', 1),
    ('pride_warrior', 'Pride Warrior', 'Complete 5 Pride keyword challenges', 'engagement', 100, 5, 'count', '{}', '⚔️', 2),
    ('pride_ally', 'Proud Ally', 'Send 25 supportive messages', 'social', 15, 25, 'count', ARRAY['ally', 'support', 'love wins', 'proud'], '🤝', 3),
    ('pride_celebration', 'Pride Celebration', 'Spend 500 credits on Pride items', 'general', 50, 1, 'boolean', '{}', '🎉', 4),
    ('pride_voice', 'Pride Voice', 'Send 50 chat messages during Pride Month', 'chat', 10, 50, 'count', '{}', '📣', 5),
    ('pride_community', 'Community Builder', 'Engage with 5 different Pride challenges', 'engagement', 200, 5, 'count', '{}', '🌈', 6)
ON CONFLICT (slug) DO NOTHING;

-- 10. Seed default Pride keywords
INSERT INTO public.pride_keyword_config (keyword, xp_reward, cooldown_seconds, daily_limit)
VALUES
    ('pride', 10, 30, 50),
    ('love', 5, 30, 100),
    ('rainbow', 8, 30, 50),
    ('lgbtq', 10, 30, 50),
    ('equality', 10, 30, 50),
    ('ally', 8, 30, 50),
    ('support', 5, 30, 100),
    ('love wins', 15, 60, 25),
    ('proud', 8, 30, 50),
    ('celebrate', 5, 30, 75),
    ('inclusive', 10, 30, 50),
    ('acceptance', 10, 30, 50),
    ('diversity', 10, 30, 50),
    ('together', 5, 30, 100)
ON CONFLICT (keyword) DO NOTHING;
