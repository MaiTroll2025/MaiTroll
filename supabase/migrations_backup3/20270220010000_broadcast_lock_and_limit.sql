-- 1. Add lock and badge columns to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS is_broadcast_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_broadcast_badge BOOLEAN DEFAULT false;

-- 2. Add max_broadcasters setting to admin_settings if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.admin_settings WHERE setting_key = 'max_broadcasters') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_settings' AND column_name = 'key') THEN
            INSERT INTO public.admin_settings (setting_key, setting_value, description, key)
            VALUES ('max_broadcasters', '{"limit": 100}', 'Maximum number of authorized broadcasters', 'max_broadcasters');
        ELSE
            INSERT INTO public.admin_settings (setting_key, setting_value, description)
            VALUES ('max_broadcasters', '{"limit": 100}', 'Maximum number of authorized broadcasters');
        END IF;
    END IF;
END $$;

-- 3. RPC to attempt granting a badge (Run this before allowing a stream start)
CREATE OR REPLACE FUNCTION public.ensure_broadcaster_badge(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_has_badge BOOLEAN;
    v_current_count INT;
    v_limit INT;
    v_is_admin BOOLEAN;
BEGIN
    -- Check if user already has badge
    SELECT has_broadcast_badge, (COALESCE(is_admin, false) OR role IN ('admin', 'secretary', 'lead_troll_officer', 'troll_officer'))
    INTO v_has_badge, v_is_admin
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF v_has_badge OR v_is_admin THEN
        RETURN jsonb_build_object('success', true, 'message', 'User already has badge or is admin');
    END IF;

    -- Get limit
    SELECT (setting_value->>'limit')::int
    INTO v_limit
    FROM public.admin_settings
    WHERE setting_key = 'max_broadcasters';

    v_limit := COALESCE(v_limit, 100);

    -- Count current badge holders
    SELECT count(*)
    INTO v_current_count
    FROM public.user_profiles
    WHERE has_broadcast_badge = true;

    -- Check limit
    IF v_current_count >= v_limit THEN
        RETURN jsonb_build_object('success', false, 'message', 'Broadcaster limit reached');
    END IF;

    -- Grant badge
    UPDATE public.user_profiles
    SET has_broadcast_badge = true
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Badge granted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_broadcaster_badge(UUID) TO authenticated;

-- 4. Update can_start_broadcast RPC to check all conditions
CREATE OR REPLACE FUNCTION public.can_start_broadcast(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_lockdown_enabled BOOLEAN;
    v_is_locked BOOLEAN;
    v_has_badge BOOLEAN;
BEGIN
    -- Get user info
    SELECT
        (COALESCE(is_admin, false) = true OR role IN ('admin', 'secretary', 'lead_troll_officer', 'troll_officer')),
        COALESCE(is_broadcast_locked, false),
        COALESCE(has_broadcast_badge, false)
    INTO v_is_admin, v_is_locked, v_has_badge
    FROM public.user_profiles
    WHERE id = p_user_id;

    -- If user is locked, deny immediately
    IF v_is_locked THEN
        RETURN false;
    END IF;

    -- Get global lockdown setting
    SELECT
        (setting_value->>'enabled')::boolean
    INTO v_lockdown_enabled
    FROM public.admin_settings
    WHERE setting_key = 'broadcast_lockdown_enabled'
    LIMIT 1;

    v_lockdown_enabled := COALESCE(v_lockdown_enabled, false);

    -- If global lockdown is ON, only admins can broadcast
    IF v_lockdown_enabled AND NOT v_is_admin THEN
        RETURN false;
    END IF;

    -- Check Broadcaster Badge
    -- Admins bypass badge requirement
    IF NOT v_has_badge AND NOT v_is_admin THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$;
