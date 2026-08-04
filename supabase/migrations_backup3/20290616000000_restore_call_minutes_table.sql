-- ============================================================================
-- RESTORE call_minutes TABLE
-- The call_minutes table was accidentally dropped. This migration recreates it
-- along with all constraints, indexes, RLS policies, grants, and RPC functions.
-- Bug: PGRST205 - Could not find the table 'public.call_minutes' in schema cache
-- ============================================================================

-- ============================================================================
-- 1. CREATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.call_minutes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    audio_minutes INTEGER DEFAULT 0 NOT NULL,
    video_minutes INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT call_minutes_audio_minutes_check CHECK (audio_minutes >= 0),
    CONSTRAINT call_minutes_video_minutes_check CHECK (video_minutes >= 0),
    CONSTRAINT call_minutes_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.call_minutes OWNER TO postgres;
COMMENT ON TABLE public.call_minutes IS 'Stores call minute balances for users';

-- ============================================================================
-- 2. FOREIGN KEY CONSTRAINT
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'call_minutes_user_id_fkey'
        AND table_name = 'call_minutes'
    ) THEN
        ALTER TABLE ONLY public.call_minutes
            ADD CONSTRAINT call_minutes_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_call_minutes_user_id ON public.call_minutes USING btree (user_id);

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.call_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ONLY public.call_minutes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_own" ON public.call_minutes;
CREATE POLICY "auth_select_own" ON public.call_minutes
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "auth_insert_own" ON public.call_minutes;
CREATE POLICY "auth_insert_own" ON public.call_minutes
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "auth_update_own" ON public.call_minutes;
CREATE POLICY "auth_update_own" ON public.call_minutes
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "auth_delete_own" ON public.call_minutes;
CREATE POLICY "auth_delete_own" ON public.call_minutes
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- 5. GRANTS
-- ============================================================================

GRANT ALL ON TABLE public.call_minutes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.call_minutes TO authenticated;

-- ============================================================================
-- 6. RPC: add_call_minutes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_call_minutes(
    p_user_id UUID,
    p_minutes INTEGER,
    p_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
    v_current_audio INTEGER := 0;
    v_current_video INTEGER := 0;
BEGIN
    -- Get current balance (handle no row case)
    SELECT COALESCE(audio_minutes, 0), COALESCE(video_minutes, 0)
    INTO v_current_audio, v_current_video
    FROM public.call_minutes
    WHERE user_id = p_user_id;

    -- Update or insert
    IF NOT FOUND THEN
        INSERT INTO public.call_minutes (user_id, audio_minutes, video_minutes, updated_at)
        VALUES (
            p_user_id,
            CASE WHEN p_type = 'audio' THEN p_minutes ELSE 0 END,
            CASE WHEN p_type = 'video' THEN p_minutes ELSE 0 END,
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE
        SET
            audio_minutes = public.call_minutes.audio_minutes + CASE WHEN p_type = 'audio' THEN p_minutes ELSE 0 END,
            video_minutes = public.call_minutes.video_minutes + CASE WHEN p_type = 'video' THEN p_minutes ELSE 0 END,
            updated_at = NOW();

        -- Re-fetch to be sure
        SELECT COALESCE(audio_minutes, 0), COALESCE(video_minutes, 0)
        INTO v_current_audio, v_current_video
        FROM public.call_minutes
        WHERE user_id = p_user_id;
    ELSE
        UPDATE public.call_minutes
        SET
            audio_minutes = CASE WHEN p_type = 'audio' THEN audio_minutes + p_minutes ELSE audio_minutes END,
            video_minutes = CASE WHEN p_type = 'video' THEN video_minutes + p_minutes ELSE video_minutes END,
            updated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING audio_minutes, video_minutes INTO v_current_audio, v_current_video;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'audio_minutes', v_current_audio,
        'video_minutes', v_current_video
    );
END;
$$;

ALTER FUNCTION public.add_call_minutes(p_user_id UUID, p_minutes INTEGER, p_type TEXT) OWNER TO postgres;
GRANT ALL ON FUNCTION public.add_call_minutes(UUID, INTEGER, TEXT) TO anon;
GRANT ALL ON FUNCTION public.add_call_minutes(UUID, INTEGER, TEXT) TO authenticated;
GRANT ALL ON FUNCTION public.add_call_minutes(UUID, INTEGER, TEXT) TO service_role;

-- ============================================================================
-- 7. RPC: deduct_call_minutes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.deduct_call_minutes(
    p_user_id UUID,
    p_minutes INTEGER,
    p_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
    v_current_audio INTEGER := 0;
    v_current_video INTEGER := 0;
    v_new_audio INTEGER;
    v_new_video INTEGER;
BEGIN
    -- Get current balance
    SELECT COALESCE(audio_minutes, 0), COALESCE(video_minutes, 0)
    INTO v_current_audio, v_current_video
    FROM public.call_minutes
    WHERE user_id = p_user_id;

    -- Calculate new balances
    IF p_type = 'audio' THEN
        v_new_audio := GREATEST(0, v_current_audio - p_minutes);
        v_new_video := v_current_video;
    ELSE -- video uses 2x minutes
        v_new_audio := v_current_audio;
        v_new_video := GREATEST(0, v_current_video - (p_minutes * 2));
    END IF;

    -- Update balance
    UPDATE public.call_minutes
    SET
        audio_minutes = v_new_audio,
        video_minutes = v_new_video,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Handle case where no row existed
    IF NOT FOUND THEN
        INSERT INTO public.call_minutes (user_id, audio_minutes, video_minutes)
        VALUES (p_user_id, 0, 0);
        v_new_audio := 0;
        v_new_video := 0;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'has_minutes', CASE WHEN p_type = 'audio' THEN v_new_audio > 0 ELSE v_new_video > 0 END,
        'audio_minutes', v_new_audio,
        'video_minutes', v_new_video
    );
END;
$$;

ALTER FUNCTION public.deduct_call_minutes(p_user_id UUID, p_minutes INTEGER, p_type TEXT) OWNER TO postgres;
GRANT ALL ON FUNCTION public.deduct_call_minutes(UUID, INTEGER, TEXT) TO anon;
GRANT ALL ON FUNCTION public.deduct_call_minutes(UUID, INTEGER, TEXT) TO authenticated;
GRANT ALL ON FUNCTION public.deduct_call_minutes(UUID, INTEGER, TEXT) TO service_role;

-- ============================================================================
-- 8. RPC: get_call_balances
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_call_balances(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
    v_audio INTEGER := 0;
    v_video INTEGER := 0;
BEGIN
    SELECT COALESCE(audio_minutes, 0), COALESCE(video_minutes, 0)
    INTO v_audio, v_video
    FROM public.call_minutes
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'audio_minutes', v_audio,
        'video_minutes', v_video
    );
END;
$$;

ALTER FUNCTION public.get_call_balances(p_user_id UUID) OWNER TO postgres;
GRANT ALL ON FUNCTION public.get_call_balances(UUID) TO anon;
GRANT ALL ON FUNCTION public.get_call_balances(UUID) TO authenticated;
GRANT ALL ON FUNCTION public.get_call_balances(UUID) TO service_role;
