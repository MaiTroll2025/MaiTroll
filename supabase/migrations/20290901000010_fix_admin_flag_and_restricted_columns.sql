-- ============================================================================
-- Fix admin flag and allow admin updates to restricted profile columns
-- ============================================================================
-- 1. Drop the existing restrictive trigger so we can promote the user
-- 2. Ensure the specific user has is_admin = true
-- 3. Update protect_sensitive_columns() so admins can update restricted columns
-- 4. Recreate the trigger
-- ============================================================================

-- 1. Drop existing restrictive trigger
DROP TRIGGER IF EXISTS trg_protect_user_profiles ON public.user_profiles;

-- 2. Promote the specific user to admin
UPDATE public.user_profiles
SET is_admin = true,
    updated_at = NOW()
WHERE id = '3da9479f-2fb1-49d3-8b6a-a2bf25873d31';

-- 3. Allow admins to update restricted columns on user_profiles
CREATE OR REPLACE FUNCTION public.protect_sensitive_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'service_role' OR auth.role() = 'supabase_admin' THEN
    RETURN NEW;
  END IF;

  IF session_user != current_user THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'user_profiles' THEN
    IF public.is_admin(auth.uid()) THEN
      RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot update restricted column: role';
    END IF;
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Cannot update restricted column: is_admin';
    END IF;
    IF NEW.is_lead_officer IS DISTINCT FROM OLD.is_lead_officer THEN
      RAISE EXCEPTION 'Cannot update restricted column: is_lead_officer';
    END IF;
    IF NEW.troll_coins IS DISTINCT FROM OLD.troll_coins THEN
      RAISE EXCEPTION 'Cannot update restricted column: troll_coins';
    END IF;
    IF NEW.total_earned_coins IS DISTINCT FROM OLD.total_earned_coins THEN
      RAISE EXCEPTION 'Cannot update restricted column: total_earned_coins';
    END IF;
    IF NEW.level IS DISTINCT FROM OLD.level THEN
      RAISE EXCEPTION 'Cannot update restricted column: level';
    END IF;
    IF NEW.xp IS DISTINCT FROM OLD.xp THEN
      RAISE EXCEPTION 'Cannot update restricted column: xp';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recreate the trigger
CREATE TRIGGER trg_protect_user_profiles
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_columns();
