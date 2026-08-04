-- Clean up legacy triggers and functions that might be causing errors
-- The user reported "handle_new_user error", implying a legacy function exists
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Also drop the correct function name just in case we need to update it
-- DROP FUNCTION IF EXISTS public.handle_user_signup();

-- Redefine the correct handler with robust defaults
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
  v_email := COALESCE(NEW.email, '');

  -- Default username logic: Metadata -> Email -> ID
  -- This addresses "it needs to read from columes we already use" by falling back to email
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NULLIF(split_part(v_email, '@', 1), ''),
    'user' || substr(replace(NEW.id::text, '-', ''), 1, 8)
  );
  
  -- Ensure username is not empty string
  IF v_username IS NULL OR v_username = '' THEN
    v_username := 'user' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;

  -- Default avatar logic
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_username
  );
  
  -- Set role based on email (admin check)
  IF v_email = 'Mai Troll2025@gmail.com' THEN
    v_role := 'admin';
  ELSE
    v_role := 'user';
  END IF;

  INSERT INTO public.user_profiles (
    id,
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

-- Attach the correct trigger
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_user_signup();
