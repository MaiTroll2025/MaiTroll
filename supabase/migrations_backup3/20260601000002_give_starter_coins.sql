-- Migration: Give 500 starter troll_coins to all users except admin, and update signup trigger for new users
-- Admin account Mai Troll2025@gmail.com is excluded
-- Insurance activation is free and separate from coin balance

-- Step 1: Update all existing non-admin users to have at least 500 troll_coins
UPDATE public.user_profiles
SET
  troll_coins = GREATEST(COALESCE(troll_coins, 0), 500),
  total_earned_coins = GREATEST(COALESCE(total_earned_coins, 0), 500),
  updated_at = now()
WHERE
  lower(COALESCE(email, '')) <> 'Mai Troll2025@gmail.com'
  AND COALESCE(troll_coins, 0) < 500;

-- Step 2: Update signup trigger to give new users 500 starter troll_coins
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
    500,
    500,
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
    troll_coins = GREATEST(COALESCE(public.user_profiles.troll_coins, 0), 500),
    total_earned_coins = GREATEST(COALESCE(public.user_profiles.total_earned_coins, 0), 500),
    updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Step 3: Update the second signup trigger (handle_user_signup) for new users
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
    500,
    500,
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
    troll_coins = GREATEST(COALESCE(public.user_profiles.troll_coins, 0), 500),
    total_earned_coins = GREATEST(COALESCE(public.user_profiles.total_earned_coins, 0), 500),
    updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_new_user_troll_coins() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_user_signup() TO service_role, authenticated;
NOTIFY pgrst, 'reload schema';
