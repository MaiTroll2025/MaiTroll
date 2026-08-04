-- Church Live Sessions & Moderation Migration

-- 1. Church Live Sessions
CREATE TABLE IF NOT EXISTS public.church_live_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pastor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    room_name TEXT NOT NULL,
    livekit_room_id TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
    sermon_title TEXT,
    scripture_reference TEXT,
    is_private BOOLEAN DEFAULT false,
    viewer_count INTEGER DEFAULT 0,
    attendee_count INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.church_live_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Anyone can view live sessions" ON public.church_live_sessions
        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Pastors can manage own sessions" ON public.church_live_sessions
        FOR ALL USING (
            auth.uid() = pastor_id OR EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Church Prayer Replies (Pastor responses to prayers)
CREATE TABLE IF NOT EXISTS public.church_prayer_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prayer_id UUID NOT NULL REFERENCES public.church_prayers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.church_prayer_replies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Anyone can view prayer replies" ON public.church_prayer_replies
        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Pastors can create replies" ON public.church_prayer_replies
        FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE id = auth.uid() AND (is_pastor = true OR role = 'admin' OR is_admin = true)
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Pastors can manage own replies" ON public.church_prayer_replies
        FOR ALL USING (
            auth.uid() = pastor_id OR EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Church Moderation Actions (kick, mute, warn log)
CREATE TABLE IF NOT EXISTS public.church_mod_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moderator_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('kick', 'mute', 'warn', 'ban', 'unmute', 'unban', 'prayer_delete', 'prayer_restored')),
    reason TEXT,
    prayer_id UUID REFERENCES public.church_prayers(id) ON DELETE SET NULL,
    duration_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ
);

ALTER TABLE public.church_mod_actions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Moderators can view mod actions" ON public.church_mod_actions
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE id = auth.uid() AND (is_pastor = true OR role = 'admin' OR is_admin = true OR is_troll_officer = true OR is_lead_officer = true)
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Moderators can create mod actions" ON public.church_mod_actions
        FOR INSERT WITH CHECK (
            auth.uid() = moderator_id AND EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE id = auth.uid() AND (is_pastor = true OR role = 'admin' OR is_admin = true OR is_troll_officer = true OR is_lead_officer = true)
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Add church_banned_users for persistent church bans
CREATE TABLE IF NOT EXISTS public.church_banned_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    banned_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    reason TEXT,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

ALTER TABLE public.church_banned_users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Moderators can view banned users" ON public.church_banned_users
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE id = auth.uid() AND (is_pastor = true OR role = 'admin' OR is_admin = true OR is_troll_officer = true)
            ) OR auth.uid() = user_id
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Moderators can manage bans" ON public.church_banned_users
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE id = auth.uid() AND (is_pastor = true OR role = 'admin' OR is_admin = true OR is_troll_officer = true)
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_church_live_sessions_status ON public.church_live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_church_live_sessions_pastor ON public.church_live_sessions(pastor_id);
CREATE INDEX IF NOT EXISTS idx_church_prayer_replies_prayer ON public.church_prayer_replies(prayer_id);
CREATE INDEX IF NOT EXISTS idx_church_mod_actions_target ON public.church_mod_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_church_mod_actions_moderator ON public.church_mod_actions(moderator_id);
CREATE INDEX IF NOT EXISTS idx_church_banned_users_user ON public.church_banned_users(user_id);

-- 6. RPC: Perform church mod action
CREATE OR REPLACE FUNCTION perform_church_mod_action(
    target_user_id UUID,
    action_type TEXT,
    reason TEXT DEFAULT NULL,
    duration_minutes INTEGER DEFAULT NULL,
    prayer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    is_moderator BOOLEAN;
    result JSONB;
BEGIN
    current_user_id := auth.uid();

    -- Check moderator status
    SELECT (
        up.is_pastor = true OR up.role = 'admin' OR up.is_admin = true OR
        up.is_troll_officer = true OR up.is_lead_officer = true
    ) INTO is_moderator
    FROM public.user_profiles up
    WHERE up.id = current_user_id;

    IF NOT is_moderator THEN
        RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to perform moderation actions');
    END IF;

    -- Log the action
    INSERT INTO public.church_mod_actions (moderator_id, target_user_id, action_type, reason, prayer_id, duration_minutes, expires_at)
    VALUES (
        current_user_id, target_user_id, action_type, reason, prayer_id, duration_minutes,
        CASE WHEN duration_minutes IS NOT NULL THEN now() + (duration_minutes || ' minutes')::INTERVAL ELSE NULL END
    );

    -- Handle ban action
    IF action_type IN ('kick', 'ban') THEN
        INSERT INTO public.church_banned_users (user_id, banned_by, reason, expires_at)
        VALUES (
            target_user_id, current_user_id, reason,
            CASE WHEN duration_minutes IS NOT NULL THEN now() + (duration_minutes || ' minutes')::INTERVAL ELSE NULL END
        )
        ON CONFLICT (user_id) DO UPDATE SET
            banned_by = EXCLUDED.banned_by,
            reason = EXCLUDED.reason,
            is_active = true,
            expires_at = EXCLUDED.expires_at;
    END IF;

    -- Handle unban
    IF action_type IN ('unmute', 'unban') THEN
        UPDATE public.church_banned_users SET is_active = false WHERE church_banned_users.user_id = target_user_id;
    END IF;

    -- Handle prayer delete
    IF action_type = 'prayer_delete' AND prayer_id IS NOT NULL THEN
        DELETE FROM public.church_prayers WHERE id = prayer_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'action', action_type, 'target_user_id', target_user_id);
END;
$$;

-- 7. RPC: Check if user is banned from church
CREATE OR REPLACE FUNCTION is_user_banned_from_church(check_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    ban_record RECORD;
BEGIN
    SELECT * INTO ban_record FROM public.church_banned_users
    WHERE user_id = check_user_id AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object('banned', true, 'reason', ban_record.reason, 'expires_at', ban_record.expires_at);
    END IF;

    RETURN jsonb_build_object('banned', false);
END;
$$;
