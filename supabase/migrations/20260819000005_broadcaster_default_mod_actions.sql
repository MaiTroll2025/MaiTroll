-- Migration: Ensure all broadcasters have is_broadcaster=true and can use mod actions
-- Description: 
--   1. Backfills is_broadcaster=true for all existing user_profiles that are missing it
--   2. Creates a trigger on auth.user creation to ensure new users get is_broadcaster=true
--   3. Updates is_modo_role() to include is_broadcaster check (already done in separate migration)

-- ============================================================================
-- 1. Backfill existing users
-- ============================================================================
UPDATE public.user_profiles
SET is_broadcaster = true
WHERE is_broadcaster IS NULL OR is_broadcaster = false;

-- ============================================================================
-- 2. Trigger on auth.users insert to set is_broadcaster=true for new users
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    email,
    username,
    display_name,
    avatar_url,
    role,
    troll_role,
    is_broadcaster,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE(NEW.raw_user_meta_data->>'troll_role', NULL),
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    is_broadcaster = true,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 3. Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
