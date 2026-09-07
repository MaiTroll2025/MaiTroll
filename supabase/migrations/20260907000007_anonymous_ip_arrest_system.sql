-- ============================================================================
-- Anonymous IP Arrest System
-- ============================================================================
-- This migration adds the ability to arrest anonymous viewers by IP address
-- and block devices from accessing the platform.

-- ============================================================================
-- 1. CREATE ANONYMOUS ARRESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.anonymous_arrests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address TEXT NOT NULL,
    anon_display_name TEXT,
    reason TEXT NOT NULL DEFAULT 'Anonymous viewer violation',
    severity TEXT DEFAULT 'moderate' CHECK (severity IN ('minor', 'moderate', 'serious', 'severe')),
    arrested_by UUID REFERENCES public.user_profiles(id),
    release_time TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_anonymous_arrests_ip ON public.anonymous_arrests(ip_address);
CREATE INDEX IF NOT EXISTS idx_anonymous_arrests_active ON public.anonymous_arrests(ip_address, is_active, release_time);

-- ============================================================================
-- 2. CREATE ANONYMOUS VIEWER SESSIONS TABLE
-- ============================================================================
-- Maps anonymous display names to their last known IP for mod arrest tracking

CREATE TABLE IF NOT EXISTS public.anonymous_viewer_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    anon_display_name TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    stream_id TEXT,
    user_agent TEXT,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anon_sessions_name ON public.anonymous_viewer_sessions(anon_display_name);
CREATE INDEX IF NOT EXISTS idx_anon_sessions_ip ON public.anonymous_viewer_sessions(ip_address);

-- Some live databases are missing this column from the original baseline.
ALTER TABLE public.ip_bans
    ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;

ALTER TABLE public.anonymous_viewer_sessions
    ADD CONSTRAINT anonymous_viewer_sessions_anon_display_name_key UNIQUE (anon_display_name);

-- ============================================================================
-- 3. CREATE is_ip_blocked FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip_address text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM ip_bans
        WHERE ip_address = p_ip_address
        AND (banned_until IS NULL OR banned_until > now())
        AND is_active = true
    ) OR EXISTS (
        SELECT 1 FROM anonymous_arrests
        WHERE ip_address = p_ip_address
        AND is_active = true
        AND release_time > now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_ip_blocked(text) TO anon, authenticated, service_role;

-- ============================================================================
-- 4. CREATE is_anon_arrested FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_anon_arrested(p_ip_address text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM anonymous_arrests
        WHERE ip_address = p_ip_address
        AND is_active = true
        AND release_time > now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_anon_arrested(text) TO anon, authenticated, service_role;

-- ============================================================================
-- 5. CREATE record_anonymous_arrest FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_anonymous_arrest(
    p_ip_address text,
    p_anon_display_name text DEFAULT NULL,
    p_reason text DEFAULT 'Anonymous viewer violation',
    p_severity text DEFAULT 'moderate',
    p_arrested_by uuid DEFAULT NULL,
    p_duration_minutes integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_release_time timestamptz;
    v_effective_ip text;
BEGIN
    v_release_time := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

    IF p_ip_address IS NOT NULL THEN
        v_effective_ip := p_ip_address;
    ELSIF p_anon_display_name IS NOT NULL THEN
        SELECT ip_address INTO v_effective_ip
        FROM public.anonymous_viewer_sessions
        WHERE anon_display_name = p_anon_display_name
        ORDER BY last_seen DESC
        LIMIT 1;

        IF v_effective_ip IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', 'No IP found for anonymous viewer');
        END IF;
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'IP address or anon display name required');
    END IF;

    INSERT INTO public.anonymous_arrests (
        ip_address,
        anon_display_name,
        reason,
        severity,
        arrested_by,
        release_time
    ) VALUES (
        v_effective_ip,
        p_anon_display_name,
        p_reason,
        p_severity,
        p_arrested_by,
        v_release_time
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Anonymous arrest recorded',
        'release_time', v_release_time,
        'ip_address', v_effective_ip
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_anonymous_arrest(text, text, text, text, uuid, integer) TO authenticated, service_role;

-- ============================================================================
-- 6. CREATE track_anonymous_viewer FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.track_anonymous_viewer(
    p_anon_display_name text,
    p_ip_address text,
    p_stream_id text DEFAULT NULL,
    p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.anonymous_viewer_sessions (
        anon_display_name,
        ip_address,
        stream_id,
        user_agent,
        last_seen
    ) VALUES (
        p_anon_display_name,
        p_ip_address,
        p_stream_id,
        p_user_agent,
        NOW()
    )
    ON CONFLICT (anon_display_name) DO UPDATE SET
        ip_address = EXCLUDED.ip_address,
        stream_id = EXCLUDED.stream_id,
        user_agent = EXCLUDED.user_agent,
        last_seen = NOW();

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_anonymous_viewer(text, text, text, text) TO anon, authenticated, service_role;

-- ============================================================================
-- 7. CREATE auto_arrest_new_account_on_ip FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_arrest_new_account_on_ip(p_user_id uuid, p_ip_address text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_jail_id uuid;
BEGIN
    IF p_ip_address IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No IP address provided');
    END IF;

    IF NOT public.is_ip_blocked(p_ip_address) THEN
        RETURN jsonb_build_object('success', false, 'message', 'IP is not blocked');
    END IF;

    INSERT INTO public.jail (
        user_id,
        reason,
        severity,
        status,
        release_time,
        created_at
    ) VALUES (
        p_user_id,
        'Auto-arrest: Account created on flagged IP address',
        'severe',
        'jailed',
        NOW() + INTERVAL '24 hours',
        NOW()
    ) RETURNING id INTO v_jail_id;

    INSERT INTO public.jail_security_violations (
        user_id,
        ip_address,
        violation_type,
        severity,
        details
    ) VALUES (
        p_user_id,
        p_ip_address,
        'multi_account',
        'critical',
        jsonb_build_object(
            'reason', 'Auto-arrested on signup due to flagged IP',
            'ip_address', p_ip_address
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'New account auto-arrested due to flagged IP',
        'jail_id', v_jail_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_arrest_new_account_on_ip(uuid, text) TO authenticated, service_role;

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

ALTER TABLE public.anonymous_arrests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view anonymous arrests" ON public.anonymous_arrests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (is_admin = true OR is_troll_officer = true OR role = 'admin')
        )
    );

CREATE POLICY "Staff can insert anonymous arrests" ON public.anonymous_arrests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (is_admin = true OR is_troll_officer = true OR role = 'admin')
        )
    );

CREATE POLICY "Staff can update anonymous arrests" ON public.anonymous_arrests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (is_admin = true OR is_troll_officer = true OR role = 'admin')
        )
    );

ALTER TABLE public.anonymous_viewer_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert anonymous viewer sessions" ON public.anonymous_viewer_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can view anonymous viewer sessions" ON public.anonymous_viewer_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (is_admin = true OR is_troll_officer = true OR role = 'admin')
        )
    );
