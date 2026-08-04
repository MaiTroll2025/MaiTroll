-- Enforce Single Source of Truth for User Signup
-- Consolidates user_profiles, user_credit, and coin_transactions creation into one safe trigger.

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
  -- 1. Determine User Details
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
  -- Note: We check specifically for the main admin email
  IF v_email = 'Mai Troll2025@gmail.com' THEN
    v_role := 'admin';
  ELSE
    v_role := 'user';
  END IF;

  -- 2. Insert User Profile
  -- We wrap this in a block to ensure it never aborts the transaction
  BEGIN
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
      0,                -- paid_coins
      100,              -- troll_coins (Welcome bonus: 100)
      100,              -- total_earned_coins (Track the bonus)
      0,                -- total_spent_coins
      v_email,
      false,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error inserting user_profile for %: %', NEW.id, SQLERRM;
  END;

  -- 3. Insert User Credit
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error inserting user_credit for %: %', NEW.id, SQLERRM;
  END;

  -- 4. Insert Welcome Coin Transaction
  BEGIN
    INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
    VALUES (NEW.id, 'purchase', 100, 'Welcome bonus coins!', NOW())
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail auth user creation
    RAISE WARNING 'Error inserting coin_transaction for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Recreate the main trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_signup();

-- Remove the redundant credit trigger to prevent race conditions
DROP TRIGGER IF EXISTS on_auth_user_created_credit ON auth.users;
DROP FUNCTION IF EXISTS public.create_user_credit_on_signup();
