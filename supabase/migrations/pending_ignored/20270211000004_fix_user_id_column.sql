-- Migration: Fix user_id column in user_profiles trigger functions
-- This fixes the "operator does not exist: integer = text" error during signup

-- 1. Update handle_new_user_profile function to include user_id
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.user_profiles (id, user_id, email)
  values (new.id, new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- 2. Update handle_new_user_troll_coins function to include user_id
CREATE OR REPLACE FUNCTION public.handle_new_user_troll_coins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, user_id, troll_coins)
  VALUES (NEW.id, NEW.id, 500)
  ON CONFLICT (id)
  DO UPDATE SET troll_coins = COALESCE(user_profiles.troll_coins, 500);

  RETURN NEW;
END;
$$;

-- 3. Update handle_user_signup function to include user_id
CREATE OR REPLACE FUNCTION public.handle_user_signup()
RETURNS TRIGGER
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
  -- Default username logic
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    'user' || substr(replace(NEW.id::text, '-', ''), 1, 8)
  );
  
  -- Default avatar logic
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_username
  );
  
  v_email := COALESCE(NEW.email, '');
  
  -- Set role based on email (admin check)
  IF v_email = 'Mai Troll2025@gmail.com' THEN
    v_role := 'admin';
  ELSE
    v_role := 'user';
  END IF;

  INSERT INTO public.user_profiles (
    id,
    user_id,
    username,
    avatar_url,
    bio,
    role,
    tier,
    paid_coins,
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
    100,
    100,
    0,
    v_email,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create welcome coin transaction
  INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
  VALUES (NEW.id, 'purchase', 100, 'Welcome bonus coins!', NOW())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail auth user creation
  RAISE WARNING 'Error in handle_user_signup for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 4. Update existing user_profiles to set user_id where it's NULL
UPDATE public.user_profiles
SET user_id = id
WHERE user_id IS NULL;

-- 5. Ensure triggers are properly attached
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

DROP TRIGGER IF EXISTS on_auth_user_created_troll_coins ON auth.users;
CREATE TRIGGER on_auth_user_created_troll_coins
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_troll_coins();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_signup();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_troll_coins() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_user_signup() TO service_role, authenticated;
