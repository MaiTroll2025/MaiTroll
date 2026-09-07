-- Disable signup coin grants without changing existing user balances.
-- Legacy signup triggers have granted 100 coins through "Welcome bonus coins!".

DO $$
BEGIN
  IF to_regclass('public.platform_economy_settings') IS NOT NULL THEN
    UPDATE public.platform_economy_settings
    SET signup_bonus_enabled = false,
        signup_bonus_coins = 0,
        updated_at = NOW()
    WHERE id = 1;
  END IF;
END
$$;

-- Keep the legacy trigger contract, but remove the coin grant.
CREATE OR REPLACE FUNCTION public.handle_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_username TEXT;
  v_avatar_url TEXT;
  v_email TEXT;
  v_role TEXT;
BEGIN
  v_username := trim(both '_' from regexp_replace(lower(COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    NULLIF(NEW.raw_app_meta_data->>'username', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'user'
  )), '[^a-z0-9_]+', '_', 'g')) || '_' || substr(replace(NEW.id::text, '-', ''), 1, 12);

  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_username
  );
  v_email := COALESCE(NEW.email, '');
  v_role := CASE WHEN lower(v_email) = lower('Mai Troll2025@gmail.com') THEN 'admin' ELSE 'user' END;

  INSERT INTO public.user_profiles (
    id, user_id, username, avatar_url, bio, role, tier,
    troll_coins, total_earned_coins, total_spent_coins,
    email, terms_accepted, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.id, v_username, v_avatar_url, 'New troll in the city!', v_role, 'Bronze',
    0, 0, 0, v_email, false, NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_troll_coins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, user_id, troll_coins, total_earned_coins)
  VALUES (NEW.id, NEW.id, 0, 0)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating zero-balance profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_user_signup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user_troll_coins() FROM PUBLIC;
