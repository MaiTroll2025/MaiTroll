-- Migration: Add terms_accepted to user_profiles and update signup trigger

-- 1. Ensure terms_accepted column exists on user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;

-- 2. Update handle_user_signup to respect metadata
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
  v_terms_accepted boolean;
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

  v_email := NEW.email;
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  
  -- Extract terms_accepted from metadata (default to false if missing)
  v_terms_accepted := COALESCE((NEW.raw_user_meta_data->>'terms_accepted')::boolean, false);

  -- 1. Insert User Profile
  BEGIN
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
      onboarding_completed,
      created_at,
      updated_at
    )
    VALUES (
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
      v_terms_accepted, -- Set from metadata
      false,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      terms_accepted = EXCLUDED.terms_accepted, -- Update if they re-signup/merge
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error inserting user_profile for %: %', NEW.id, SQLERRM;
  END;

  -- 2. Insert User Credit
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

  -- 3. Insert Welcome Coin Transaction
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
