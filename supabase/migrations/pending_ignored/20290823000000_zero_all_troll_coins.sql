-- Zero out all existing troll coin balances
-- This ensures no user has any troll coins unless explicitly earned through platform activity

-- Drop the restrictive trigger to allow the update
DROP TRIGGER IF EXISTS trg_protect_user_profiles ON public.user_profiles;

UPDATE public.user_profiles
SET
  troll_coins = 0,
  total_earned_coins = 0,
  total_spent_coins = 0,
  updated_at = now()
WHERE
  COALESCE(troll_coins, 0) != 0
  OR COALESCE(total_earned_coins, 0) != 0
  OR COALESCE(total_spent_coins, 0) != 0;

-- Recreate the restrictive trigger
CREATE TRIGGER trg_protect_user_profiles
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_columns();
