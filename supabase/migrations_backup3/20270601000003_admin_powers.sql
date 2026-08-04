-- Migration: Admin For A Week Powers
-- Description: Implements specific RPCs for moderation, visibility, governance, and soft economy.
-- Depends on: 20270601000002_admin_for_week_final.sql

-- ==========================================
-- 1. Schema Updates for Visibility & Governance
-- ==========================================

-- Streams: Feature & Boost columns
ALTER TABLE public.streams 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMPTZ;

-- City Polls (Governance)
CREATE TABLE IF NOT EXISTS public.city_polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of strings e.g. ["Yes", "No"]
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    result_metadata JSONB DEFAULT '{}'::jsonb
);

-- Poll Votes
CREATE TABLE IF NOT EXISTS public.city_poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES public.city_polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(poll_id, user_id)
);

-- City Events (Governance)
CREATE TABLE IF NOT EXISTS public.city_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL, -- 'double_xp', 'themed_night', etc.
    label TEXT NOT NULL,
    active_until TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.city_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Polls: Everyone can read active, Admins can create/update
CREATE POLICY "Public read polls" ON public.city_polls FOR SELECT USING (true);
CREATE POLICY "Admins manage polls" ON public.city_polls FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'temp_city_admin') OR is_admin = true))
);

-- Votes: Users can vote once, view all
CREATE POLICY "Public read votes" ON public.city_poll_votes FOR SELECT USING (true);
CREATE POLICY "Users vote" ON public.city_poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Events: Everyone read, Admins manage
CREATE POLICY "Public read events" ON public.city_events FOR SELECT USING (true);
CREATE POLICY "Admins manage events" ON public.city_events FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'temp_city_admin') OR is_admin = true))
);


-- ==========================================
-- 2. Access Control Updates (Reports & Logs)
-- ==========================================

-- Grant Temp Admin access to Stream Reports (View/Update)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stream_reports' AND policyname = 'Admins and Mods can view reports') THEN
        DROP POLICY "Admins and Mods can view reports" ON public.stream_reports;
        CREATE POLICY "Admins and Mods can view reports" ON public.stream_reports
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'moderator', 'temp_city_admin') OR is_admin = true))
        );
    END IF;

    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stream_reports' AND policyname = 'Admins and Mods can update reports') THEN
        DROP POLICY "Admins and Mods can update reports" ON public.stream_reports;
        CREATE POLICY "Admins and Mods can update reports" ON public.stream_reports
        FOR UPDATE USING (
            EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (role IN ('admin', 'moderator', 'temp_city_admin') OR is_admin = true))
        );
    END IF;
END $$;


-- ==========================================
-- 3. Moderation Powers (Wrappers with Logging)
-- ==========================================

-- 3.1 Admin Mute User
CREATE OR REPLACE FUNCTION public.admin_mute_user(
    p_stream_id UUID,
    p_target_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
BEGIN
    -- Permission Check
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_actor_id 
        AND (role IN ('admin', 'temp_city_admin') OR is_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Call existing mute (if available) or insert directly
    INSERT INTO public.stream_mutes (stream_id, user_id)
    VALUES (p_stream_id, p_target_id)
    ON CONFLICT (stream_id, user_id) DO NOTHING;

    -- Log Action
    PERFORM public.log_admin_action('mute_user', p_target_id, p_reason, jsonb_build_object('stream_id', p_stream_id));

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3.2 Admin Kick User
CREATE OR REPLACE FUNCTION public.admin_kick_user(
    p_stream_id UUID,
    p_target_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
BEGIN
    -- Permission Check
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_actor_id 
        AND (role IN ('admin', 'temp_city_admin') OR is_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Insert into stream_bans (Kick implies temporary ban from stream)
    INSERT INTO public.stream_bans (stream_id, user_id, reason)
    VALUES (p_stream_id, p_target_id, p_reason)
    ON CONFLICT (stream_id, user_id) DO UPDATE SET reason = p_reason;

    -- Also mark seat as kicked if applicable (best effort)
    UPDATE public.stream_seat_sessions 
    SET status = 'kicked', kick_reason = p_reason, left_at = NOW()
    WHERE stream_id = p_stream_id AND user_id = p_target_id AND status = 'active';

    -- Log Action
    PERFORM public.log_admin_action('kick_user', p_target_id, p_reason, jsonb_build_object('stream_id', p_stream_id));

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3.3 Admin End Stream
CREATE OR REPLACE FUNCTION public.admin_end_stream(
    p_stream_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_stream_owner UUID;
BEGIN
    -- Permission Check
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_actor_id 
        AND (role IN ('admin', 'temp_city_admin') OR is_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Get stream owner for logging
    SELECT user_id INTO v_stream_owner FROM public.streams WHERE id = p_stream_id;

    -- End Stream
    UPDATE public.streams 
    SET status = 'ended', is_live = false, ended_at = NOW()
    WHERE id = p_stream_id;

    -- Log Action
    PERFORM public.log_admin_action('end_stream', v_stream_owner, p_reason, jsonb_build_object('stream_id', p_stream_id));

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ==========================================
-- 4. Visibility Powers
-- ==========================================

-- 4.1 Feature Stream
CREATE OR REPLACE FUNCTION public.admin_feature_stream(
    p_stream_id UUID,
    p_duration_hours INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_stream_owner UUID;
BEGIN
    -- Permission Check
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_actor_id 
        AND (role IN ('admin', 'temp_city_admin') OR is_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT user_id INTO v_stream_owner FROM public.streams WHERE id = p_stream_id;

    -- Update Stream
    UPDATE public.streams 
    SET is_featured = true 
    WHERE id = p_stream_id;

    -- Log Action
    PERFORM public.log_admin_action('feature_stream', v_stream_owner, 'Featured for ' || p_duration_hours || ' hours', jsonb_build_object('stream_id', p_stream_id, 'duration', p_duration_hours));

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4.2 Boost Stream (Time-boxed)
CREATE OR REPLACE FUNCTION public.admin_boost_stream(
    p_stream_id UUID,
    p_duration_minutes INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_stream_owner UUID;
    v_last_boost TIMESTAMPTZ;
BEGIN
    -- Permission Check
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_actor_id 
        AND (role IN ('admin', 'temp_city_admin') OR is_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT user_id INTO v_stream_owner FROM public.streams WHERE id = p_stream_id;

    -- Restriction: Admin cannot boost themselves more than once per 24 hours
    IF v_stream_owner = v_actor_id THEN
        -- Check last self-boost in logs
        SELECT created_at INTO v_last_boost
        FROM public.admin_actions_log
        WHERE admin_user_id = v_actor_id 
        AND action_type = 'boost_stream'
        AND (metadata->>'is_self_boost')::boolean = true
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_last_boost IS NOT NULL AND v_last_boost > NOW() - INTERVAL '24 hours' THEN
             RETURN jsonb_build_object('success', false, 'error', 'You can only boost yourself once every 24 hours.');
        END IF;
    END IF;

    -- Apply Boost
    UPDATE public.streams 
    SET boosted_until = NOW() + (p_duration_minutes || ' minutes')::INTERVAL
    WHERE id = p_stream_id;

    -- Log Action
    PERFORM public.log_admin_action('boost_stream', v_stream_owner, 'Boosted for ' || p_duration_minutes || ' minutes', 
        jsonb_build_object('stream_id', p_stream_id, 'duration', p_duration_minutes, 'is_self_boost', (v_stream_owner = v_actor_id))
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ==========================================
-- 5. Governance Powers
-- ==========================================

-- 5.1 Create Poll
CREATE OR REPLACE FUNCTION public.admin_create_poll(
    p_question TEXT,
    p_options JSONB,
    p_duration_minutes INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_poll_id UUID;
BEGIN
    -- Permission Check
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_actor_id 
        AND (role IN ('admin', 'temp_city_admin') OR is_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    INSERT INTO public.city_polls (question, options, created_by, expires_at)
    VALUES (p_question, p_options, v_actor_id, NOW() + (p_duration_minutes || ' minutes')::INTERVAL)
    RETURNING id INTO v_poll_id;

    -- Log Action
    PERFORM public.log_admin_action('create_poll', NULL, 'Created poll: ' || p_question, jsonb_build_object('poll_id', v_poll_id));

    RETURN jsonb_build_object('success', true, 'poll_id', v_poll_id);
END;
$$;

-- 5.2 Trigger Event
CREATE OR REPLACE FUNCTION public.admin_trigger_event(
    p_event_type TEXT,
    p_label TEXT,
    p_duration_minutes INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_event_id UUID;
BEGIN
    -- Permission Check
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_actor_id 
        AND (role IN ('admin', 'temp_city_admin') OR is_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    INSERT INTO public.city_events (event_type, label, created_by, active_until)
    VALUES (p_event_type, p_label, v_actor_id, NOW() + (p_duration_minutes || ' minutes')::INTERVAL)
    RETURNING id INTO v_event_id;

    -- Log Action
    PERFORM public.log_admin_action('trigger_event', NULL, 'Triggered event: ' || p_label, jsonb_build_object('event_id', v_event_id, 'type', p_event_type));

    RETURN jsonb_build_object('success', true, 'event_id', v_event_id);
END;
$$;

-- ==========================================
-- 6. Soft Economy Powers
-- ==========================================

-- 6.1 Issue Admin Coins (Test Coins)
CREATE OR REPLACE FUNCTION public.admin_issue_test_coins(
    p_target_id UUID,
    p_amount INTEGER,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
BEGIN
    -- Permission Check
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_actor_id 
        AND (role IN ('admin', 'temp_city_admin') OR is_admin = true)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_amount <= 0 OR p_amount > 10000 THEN
         RETURN jsonb_build_object('success', false, 'error', 'Invalid amount. Must be 1-10000.');
    END IF;

    -- Update Target's Admin Coins (NOT real coins)
    -- Ensure we only update if the column exists (it should from prev migration)
    UPDATE public.user_profiles
    SET admin_coins_balance = COALESCE(admin_coins_balance, 0) + p_amount
    WHERE id = p_target_id;

    -- Log Action
    PERFORM public.log_admin_action('issue_admin_coins', p_target_id, p_reason, jsonb_build_object('amount', p_amount));

    RETURN jsonb_build_object('success', true);
END;
$$;
