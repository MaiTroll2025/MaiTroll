-- Migration: Fix missing DB objects causing bug center reports
-- Description: Adds missing tables, columns, functions, and FK constraints
--              that are referenced by the frontend but missing from current migrations.

-- ============================================================================
-- 1. Create profile_views table (needed by get_viewed_me_users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profile_views (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    viewed_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, viewed_user_id, created_at)
);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile views" ON public.profile_views;
CREATE POLICY "Users can view their own profile views"
    ON public.profile_views FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() = viewed_user_id);

DROP POLICY IF EXISTS "Users can insert profile views" ON public.profile_views;
CREATE POLICY "Users can insert profile views"
    ON public.profile_views FOR INSERT
    WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.profile_views TO authenticated;

-- ============================================================================
-- 2. Create get_viewed_me_users RPC function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_viewed_me_users(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    viewer_id UUID,
    username TEXT,
    avatar_url TEXT,
    viewed_at TIMESTAMPTZ,
    is_online BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pv.viewer_id,
        up.username,
        up.avatar_url,
        pv.created_at as viewed_at,
        up.is_online
    FROM public.profile_views pv
    JOIN public.user_profiles up ON pv.viewer_id = up.id
    WHERE pv.viewed_user_id = p_user_id
    ORDER BY pv.created_at DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_viewed_me_users(UUID, INTEGER) TO authenticated;

-- ============================================================================
-- 3. Create get_tm_matches RPC function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tm_matches(
    p_user_id UUID,
    p_dating BOOLEAN DEFAULT false,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    avatar_url TEXT,
    interests TEXT[],
    shared_interests TEXT[],
    match_score INTEGER,
    is_online BOOLEAN,
    last_active TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_interests TEXT[];
    v_gender TEXT;
    v_preference TEXT[];
BEGIN
    SELECT up.interests, up.gender, up.preference INTO v_interests, v_gender, v_preference
    FROM public.user_profiles up
    WHERE up.id = p_user_id;

    IF v_interests IS NULL THEN
        v_interests := '{}';
    END IF;

    IF v_preference IS NULL THEN
        v_preference := '{}';
    END IF;

    RETURN QUERY
    SELECT 
        up.id::UUID as user_id,
        up.username::TEXT,
        up.avatar_url::TEXT,
        COALESCE(up.interests, '{}'::TEXT[]),
        COALESCE(ARRAY(
            SELECT i::TEXT 
            FROM unnest(v_interests) AS i
            WHERE i = ANY(COALESCE(up.interests, '{}'::TEXT[]))
        ), '{}'::TEXT[]) as shared_interests,
        (
            (SELECT COALESCE(COUNT(*), 0) FROM unnest(v_interests) AS i 
             WHERE i = ANY(COALESCE(up.interests, '{}'::TEXT[]))) * 2 +
            CASE WHEN up.is_online = true THEN 5 ELSE 0 END +
            CASE WHEN up.last_active > NOW() - INTERVAL '1 hour' THEN 3 
                 WHEN up.last_active > NOW() - INTERVAL '24 hours' THEN 2 
                 WHEN up.last_active > NOW() - INTERVAL '7 days' THEN 1 
                 ELSE 0 END +
            CASE WHEN (up.interests IS NULL OR array_length(up.interests, 1) IS NULL) THEN 10 ELSE 0 END
        )::INTEGER as match_score,
        up.is_online::BOOLEAN,
        up.last_active::TIMESTAMPTZ
    FROM public.user_profiles up
    WHERE up.id != p_user_id
    AND (
        v_interests && COALESCE(up.interests, '{}'::TEXT[])
        OR array_length(v_interests, 1) IS NULL
        OR array_length(up.interests, 1) IS NULL
    )
    AND (
        NOT p_dating 
        OR (
            up.dating_enabled = true
            AND up.gender = ANY(v_preference)
            AND v_gender = ANY(up.preference)
        )
    )
    ORDER BY match_score DESC, up.last_active DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tm_matches(UUID, BOOLEAN, INTEGER) TO authenticated;

-- ============================================================================
-- 4. Add storage_category columns to saved_streams
-- ============================================================================

ALTER TABLE public.saved_streams 
    ADD COLUMN IF NOT EXISTS storage_category TEXT DEFAULT 'broadcast_recording',
    ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS recording_duration INTEGER DEFAULT 0;

-- ============================================================================
-- 5. Add missing FK constraints to universe_showdown_invites
-- ============================================================================

-- Add battle_id FK to universe_showdown_battles
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'universe_showdown_invites_battle_id_fkey'
          AND table_name = 'universe_showdown_invites'
    ) THEN
        ALTER TABLE public.universe_showdown_invites
            ADD CONSTRAINT universe_showdown_invites_battle_id_fkey
            FOREIGN KEY (battle_id) REFERENCES public.universe_showdown_battles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add inviter_user_id FK to user_profiles
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'universe_showdown_invites_inviter_user_id_fkey'
          AND table_name = 'universe_showdown_invites'
    ) THEN
        ALTER TABLE public.universe_showdown_invites
            ADD CONSTRAINT universe_showdown_invites_inviter_user_id_fkey
            FOREIGN KEY (inviter_user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add invited_user_id FK to user_profiles
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'universe_showdown_invites_invited_user_id_fkey'
          AND table_name = 'universe_showdown_invites'
    ) THEN
        ALTER TABLE public.universe_showdown_invites
            ADD CONSTRAINT universe_showdown_invites_invited_user_id_fkey
            FOREIGN KEY (invited_user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
    END IF;
END $$;
