-- Make 500 signup coins cashable (earned_balance) for new users
-- and backfill existing users who have 500 troll_coins but no earned_balance

-- Step 0: Ensure earned_balance column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'earned_balance'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN earned_balance BIGINT DEFAULT 0 CHECK (earned_balance >= 0);
    RAISE NOTICE 'Added earned_balance column to user_profiles';
  ELSE
    RAISE NOTICE 'earned_balance column already exists';
  END IF;
END $$;

-- Step 1: Update handle_new_user_troll_coins to set earned_balance = 500
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
    earned_balance,
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
    earned_balance = GREATEST(COALESCE(public.user_profiles.earned_balance, 0), 500),
    total_earned_coins = GREATEST(COALESCE(public.user_profiles.total_earned_coins, 0), 500),
    updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Step 2: Update handle_user_signup to also set earned_balance = 500
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
    earned_balance,
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
    earned_balance = GREATEST(COALESCE(public.user_profiles.earned_balance, 0), 500),
    total_earned_coins = GREATEST(COALESCE(public.user_profiles.total_earned_coins, 0), 500),
    updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating user profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_new_user_troll_coins() TO service_role, authenticated;

-- Step 3: Backfill existing users who have 500 troll_coins but no earned_balance
-- This handles users who got the 500 signup coins but can't cash them out
UPDATE public.user_profiles
SET
  earned_balance = GREATEST(earned_balance, 500),
  updated_at = now()
WHERE
  troll_coins >= 500
  AND COALESCE(earned_balance, 0) < 500
  AND lower(COALESCE(email, '')) <> 'Mai Troll2025@gmail.com';
