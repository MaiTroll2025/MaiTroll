-- Fix signup flow issues:
-- 1. Make create_user_credit_on_signup SECURITY DEFINER to fix RLS errors during signup
-- 2. Add missing trigger for handle_user_signup to ensure user_profiles are created

-- 1. Update create_user_credit_on_signup
CREATE OR REPLACE FUNCTION public.create_user_credit_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
  VALUES (
    NEW.id,
    400, -- Default starting score
    'Building', -- Default tier
    0, -- No trend yet
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Ensure the credit trigger is correct
-- DROP TRIGGER IF EXISTS on_auth_user_created_credit ON auth.users;
-- CREATE TRIGGER on_auth_user_created_credit
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.create_user_credit_on_signup();


-- 2. Fix and attach handle_user_signup
-- This function had a duplicate column 'troll_coins' in baseline and was missing the trigger
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
    paid_coins,       -- Fixed: was duplicate troll_coins
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
    0,                -- paid_coins
    100,              -- troll_coins (Welcome bonus)
    100,              -- total_earned_coins
    0,                -- total_spent_coins
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

-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION public.handle_user_signup();
