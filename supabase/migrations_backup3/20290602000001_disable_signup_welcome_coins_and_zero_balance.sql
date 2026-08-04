-- Disable signup welcome coins and reset existing coin balances.
-- This migration stops granting new users 250 troll coins on signup,
-- and zeros all current coin balance fields on existing user profiles.

CREATE OR REPLACE FUNCTION public.handle_new_user_troll_coins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_username text;
  v_avatar_url text;
  v_email text;
  v_role text;
BEGIN
  v_username := trim(both '_' from regexp_replace(lower(COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username',''),
    NULLIF(NEW.raw_app_meta_data->>'username',''),
    NULLIF(split_part(COALESCE(NEW.email,''), '@', 1), ''),
    'user'
  )), '[^a-z0-9_]+','_','g')) || '_' || substr(replace(NEW.id::text,'-',''),1,12);

  v_avatar_url := COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_username
  );

  v_email := COALESCE(NEW.email, '');
  v_role := CASE WHEN lower(v_email) = 'Mai Troll2025@gmail.com' THEN 'admin' ELSE 'user' END;

  INSERT INTO public.user_profiles (
    id,
    user_id,
    username,
    avatar_url,
    bio,
    role,
    tier,
    troll_coins,
    total_earned_coins,
    total_spent_coins,
    email,
    terms_accepted,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.id,
    v_username,
    v_avatar_url,
    'New troll in the city!',
    v_role,
    'Bronze',
    0,
    0,
    0,
    v_email,
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = COALESCE(public.user_profiles.user_id, EXCLUDED.user_id),
    email = COALESCE(public.user_profiles.email, EXCLUDED.email),
    username = COALESCE(public.user_profiles.username, EXCLUDED.username),
    avatar_url = COALESCE(public.user_profiles.avatar_url, EXCLUDED.avatar_url),
    role = COALESCE(public.user_profiles.role, EXCLUDED.role),
    troll_coins = COALESCE(public.user_profiles.troll_coins, 0),
    total_earned_coins = GREATEST(COALESCE(public.user_profiles.total_earned_coins, 0), 0),
    updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_username text;
  v_avatar_url text;
  v_email text;
  v_role text;
BEGIN
  v_username := trim(both '_' from regexp_replace(lower(COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username',''),
    NULLIF(NEW.raw_app_meta_data->>'username',''),
    NULLIF(split_part(COALESCE(NEW.email,''), '@', 1), ''),
    'user'
  )), '[^a-z0-9_]+','_','g')) || '_' || substr(replace(NEW.id::text,'-',''),1,12);

  v_avatar_url := COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_username
  );

  v_email := COALESCE(NEW.email, '');
  v_role := CASE WHEN lower(v_email) = 'Mai Troll2025@gmail.com' THEN 'admin' ELSE 'user' END;

  INSERT INTO public.user_profiles (
    id,
    user_id,
    username,
    avatar_url,
    bio,
    role,
    tier,
    troll_coins,
    total_earned_coins,
    total_spent_coins,
    email,
    terms_accepted,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.id,
    v_username,
    v_avatar_url,
    'New troll in the city!',
    v_role,
    'Bronze',
    0,
    0,
    0,
    v_email,
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = COALESCE(public.user_profiles.user_id, EXCLUDED.user_id),
    email = COALESCE(public.user_profiles.email, EXCLUDED.email),
    username = COALESCE(public.user_profiles.username, EXCLUDED.username),
    avatar_url = COALESCE(public.user_profiles.avatar_url, EXCLUDED.avatar_url),
    role = COALESCE(public.user_profiles.role, EXCLUDED.role),
    troll_coins = COALESCE(public.user_profiles.troll_coins, 0),
    total_earned_coins = GREATEST(COALESCE(public.user_profiles.total_earned_coins, 0), 0),
    updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

UPDATE public.user_profiles
SET
  troll_coins = 0,
  paid_coin_balance = 0,
  free_coin_balance = 0,
  total_earned_coins = 0,
  total_spent_coins = 0,
  updated_at = now()
WHERE
  COALESCE(troll_coins, 0) <> 0
  OR COALESCE(paid_coin_balance, 0) <> 0
  OR COALESCE(free_coin_balance, 0) <> 0
  OR COALESCE(total_earned_coins, 0) <> 0
  OR COALESCE(total_spent_coins, 0) <> 0;

GRANT EXECUTE ON FUNCTION public.handle_new_user_troll_coins() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_user_signup() TO service_role, authenticated;
NOTIFY pgrst, 'reload schema';
