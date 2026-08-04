
-- Fix ambiguous is_admin function by renaming the no-arg version
-- This avoids "not unique" errors while preserving dependencies (policies will track the rename)

-- 1. Rename the no-arg function (if it exists)
-- We wrap in DO block to avoid error if it doesn't exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'is_admin' AND p.pronargs = 0
    ) THEN
        ALTER FUNCTION public.is_admin() RENAME TO is_admin_internal_no_args;
    END IF;
END $$;

-- 2. Ensure the parameterized version exists and has the correct logic (keeping default)
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND (
            is_admin = true
            OR admin_override_until IS NOT NULL AND admin_override_until > NOW()
        )
    ) OR EXISTS (
        SELECT 1 FROM public.user_role_grants ur
        JOIN public.system_roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id
        AND r.is_admin = true
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        AND ur.revoked_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
