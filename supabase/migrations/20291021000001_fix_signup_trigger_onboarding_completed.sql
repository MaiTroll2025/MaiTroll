-- Fix the signup trigger so new users can be created again.
--
-- The live public.handle_user_signup() trigger function referenced the PL/pgSQL
-- variable v_onboarding_completed without ever declaring it. Postgres resolves the
-- unknown identifier as a column reference, so every insert into auth.users failed:
--
--   Failed to create user profile for <uuid>: column "v_onboarding_completed" does not exist
--
-- The trigger re-raises that error, which aborts the auth.users insert and makes
-- signups return HTTP 500. This migration declares the variable, parses it safely
-- from the signup metadata and keeps the profile insert contract unchanged.

-- The trigger depends on these columns existing.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;

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
  v_onboarding_completed boolean;
BEGIN
  v_email := COALESCE(NEW.email, '');

  -- Default username logic
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NULLIF(split_part(v_email, '@', 1), ''),
    'user' || substr(replace(NEW.id::text, '-', ''), 1, 8)
  );

  -- Default avatar logic
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_username
  );

  -- Force all new users to the regular user role
  v_role := 'user';

  -- Safe Boolean Parsing for terms_accepted
  BEGIN
    v_terms_accepted := (NEW.raw_user_meta_data->>'terms_accepted')::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_terms_accepted := false;
  END;
  v_terms_accepted := COALESCE(v_terms_accepted, false);

  -- Safe Boolean Parsing for onboarding_completed
  BEGIN
    v_onboarding_completed := (NEW.raw_user_meta_data->>'onboarding_completed')::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_onboarding_completed := false;
  END;
  v_onboarding_completed := COALESCE(v_onboarding_completed, false);

  -- Main Profile Insert (Must succeed - this is critical)
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
      credit_score,
      credit_limit,
      credit_used,
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
      1,  -- Welcome bonus: 100 troll_coins
      1,  -- Track the bonus
      0,
      v_email,
      v_terms_accepted,
      v_onboarding_completed,
      400,  -- Default credit score (matches user_credit default)
      250,  -- Default credit limit
      0,    -- Default credit used
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      updated_at = NOW();
  EXCEPTION WHEN OTHERS THEN
    -- If profile insert fails, we must raise an error to fail the transaction
    -- because the auth user would be created without a profile
    RAISE EXCEPTION 'Failed to create user profile for %: %', NEW.id, SQLERRM;
  END;

  -- Auxiliary: User Credit (Safe to fail, wrapped in exception handler)
  BEGIN
    INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
    VALUES (NEW.id, 400, 'Building', 0, NOW())
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error inserting user_credit for %: %', NEW.id, SQLERRM;
  END;

  -- Auxiliary: Coin Transaction for welcome bonus (Safe to fail)
  BEGIN
    INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
    VALUES (NEW.id, 'purchase', 100, 'Welcome bonus coins!', NOW())
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error inserting coin_transaction for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_user_signup() OWNER TO postgres;

-- Make sure the trigger is attached to auth.users.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_signup();
