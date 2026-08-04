-- Migration: Replace starter car with voucher on signup
-- Instead of granting a car directly, new users get a voucher for a free car

-- 1. Create user_vouchers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    voucher_type TEXT NOT NULL DEFAULT 'vehicle',
    item_id TEXT NOT NULL, -- The car_id or item slug
    item_name TEXT,
    description TEXT,
    is_claimed BOOLEAN DEFAULT false,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ, -- Optional expiration
    CONSTRAINT user_vouchers_one_per_user_type UNIQUE (user_id, voucher_type, item_id)
);

-- Enable RLS
ALTER TABLE public.user_vouchers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own vouchers" ON public.user_vouchers;
CREATE POLICY "Users can view own vouchers" ON public.user_vouchers
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can claim own vouchers" ON public.user_vouchers;
CREATE POLICY "Users can claim own vouchers" ON public.user_vouchers
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage vouchers" ON public.user_vouchers;
CREATE POLICY "Service role can manage vouchers" ON public.user_vouchers
    TO service_role USING (true) WITH CHECK (true);

-- 2. Update handle_new_user_credit to give voucher instead of car
CREATE OR REPLACE FUNCTION public.handle_new_user_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    -- Create user credit record
    INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
    VALUES (
        NEW.id,
        400, -- Default starting score
        'Building', -- Default tier
        0, -- No trend yet
        NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Instead of granting starter car, give a voucher for the free car
    INSERT INTO public.user_vouchers (user_id, voucher_type, item_id, item_name, description)
    VALUES (
        NEW.id,
        'vehicle',
        'ac8121bd-0320-45eb-8b3c-7d9b445c7b38', -- The free car ID from vehicles_catalog
        'Free Starter Vehicle',
        'Welcome voucher for a free starter vehicle. Claim it from your inventory!'
    )
    ON CONFLICT (user_id, voucher_type, item_id) DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail auth user creation
    RAISE WARNING 'Error in handle_new_user_credit for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- 3. Update handle_user_signup to also give voucher
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

  -- Give welcome voucher for free car (if not already given by handle_new_user_credit)
  INSERT INTO public.user_vouchers (user_id, voucher_type, item_id, item_name, description)
  VALUES (
    NEW.id,
    'vehicle',
    'ac8121bd-0320-45eb-8b3c-7d9b445c7b38',
    'Free Starter Vehicle',
    'Welcome voucher for a free starter vehicle. Claim it from your inventory!'
  )
  ON CONFLICT (user_id, voucher_type, item_id) DO NOTHING;

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

-- 4. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user_credit() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_user_signup() TO service_role, authenticated;

COMMENT ON TABLE public.user_vouchers IS 'User vouchers for free items (vehicles, etc.)';
COMMENT ON COLUMN public.user_vouchers.voucher_type IS 'Type of voucher: vehicle, item, etc.';
COMMENT ON COLUMN public.user_vouchers.item_id IS 'The ID or slug of the item being vouchered';
