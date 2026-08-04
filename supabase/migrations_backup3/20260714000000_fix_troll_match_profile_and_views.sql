-- ============================================================================
-- Fix Troll Match preference saving and profile_views ON CONFLICT issues
-- ============================================================================
-- Bug: saving Troll Match preferences fails due to:
--   1. update_tm_profile RPC having wrong signature/table reference
--   2. profile_views missing unique constraint for ON CONFLICT (viewer_id, viewed_user_id)
-- ============================================================================

BEGIN;

-- 1. Ensure profile_views has a unique constraint for the ON CONFLICT clause
-- Use the same _ensure_upsert_unique helper from the bug center fix migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profile_views'
  ) THEN
    BEGIN PERFORM public._ensure_upsert_unique('public', 'profile_views', ARRAY['viewer_id', 'viewed_user_id']);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'profile_views constraint check: %', SQLERRM;
    END;
  END IF;
END $$;

-- 2. Fix update_tm_profile to use correct signature and target table
DROP FUNCTION IF EXISTS public.update_tm_profile(UUID, TEXT[], BOOLEAN, TEXT, TEXT[], INTEGER);

CREATE OR REPLACE FUNCTION public.update_tm_profile(
    p_user_id UUID,
    p_interests TEXT[] DEFAULT NULL,
    p_dating_enabled BOOLEAN DEFAULT NULL,
    p_gender TEXT DEFAULT NULL,
    p_preference TEXT[] DEFAULT NULL,
    p_message_price INTEGER DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.user_profiles SET
        interests = COALESCE(p_interests, interests),
        dating_enabled = COALESCE(p_dating_enabled, dating_enabled),
        gender = COALESCE(p_gender, gender),
        preference = COALESCE(p_preference, preference),
        message_price = COALESCE(p_message_price, message_price),
        last_active = NOW()
    WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_tm_profile(UUID, TEXT[], BOOLEAN, TEXT, TEXT[], INTEGER) TO authenticated;

-- 3. Fix record_profile_view to use correct column names and ON CONFLICT target
DROP FUNCTION IF EXISTS public.record_profile_view(UUID, UUID);

CREATE OR REPLACE FUNCTION public.record_profile_view(
    p_viewer_id UUID,
    p_viewed_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profile_views (viewer_id, viewed_user_id)
    VALUES (p_viewer_id, p_viewed_user_id)
    ON CONFLICT (viewer_id, viewed_user_id) DO UPDATE SET created_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_profile_view(UUID, UUID) TO authenticated;

-- 4. Fix get_viewed_me_users to use correct column names
DROP FUNCTION IF EXISTS public.get_viewed_me_users(UUID);

CREATE OR REPLACE FUNCTION public.get_viewed_me_users(
    p_user_id UUID
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
    ORDER BY pv.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_viewed_me_users(UUID) TO authenticated;

COMMIT;
