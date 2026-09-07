-- ============================================================================
-- Auto-Follow Admin Migration
-- ============================================================================
-- Automatically makes admin accounts follow all users,
-- and ensures admin follows all new users upon signup.

BEGIN;

-- ============================================================================
-- 1. BACKFILL: Make all admins follow all existing non-admin users
-- ============================================================================

INSERT INTO public.user_follows (follower_id, following_id, created_at)
SELECT 
    admin.id,
    target.id,
    NOW()
FROM public.user_profiles admin
CROSS JOIN public.user_profiles target
WHERE 
    (admin.is_admin = true OR admin.role IN ('admin', 'superadmin', 'ceo', 'owner', 'president', 'secretary'))
    AND target.id != admin.id
    AND NOT EXISTS (
        SELECT 1 FROM public.user_follows uf
        WHERE uf.follower_id = admin.id AND uf.following_id = target.id
    );

-- ============================================================================
-- 2. TRIGGER: Auto-follow new users when they sign up
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_follow_admin_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    admin_record RECORD;
BEGIN
    FOR admin_record IN 
        SELECT id FROM public.user_profiles
        WHERE 
            is_admin = true 
            OR role IN ('admin', 'superadmin', 'ceo', 'owner', 'president', 'secretary')
    LOOP
        INSERT INTO public.user_follows (follower_id, following_id, created_at)
        VALUES (admin_record.id, NEW.id, NOW())
        ON CONFLICT (follower_id, following_id) DO NOTHING;
    END LOOP;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_follow_admin_on_signup ON public.user_profiles;

CREATE TRIGGER trigger_auto_follow_admin_on_signup
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_follow_admin_on_signup();

COMMIT;
