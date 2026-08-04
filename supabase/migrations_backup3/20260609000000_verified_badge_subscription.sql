-- Verified Badge Subscription System
-- Adds subscription-based verification with $5/month pricing
-- Supports both PayPal and Troll Coin (500 TC) payment methods

-- Add new columns to user_profiles for subscription verification
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS verified_since TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verification_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS badge_type TEXT DEFAULT 'verified';

-- Create index for efficient verification status queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_verification_expires_at
  ON public.user_profiles(verification_expires_at)
  WHERE is_verified = true;

CREATE INDEX IF NOT EXISTS idx_user_profiles_badge_type
  ON public.user_profiles(badge_type);

-- Table to track verification subscription transactions
CREATE TABLE IF NOT EXISTS public.verification_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  subscription_id TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('paypal', 'coins')),
  amount_usd NUMERIC(10,2),
  amount_coins INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  paypal_order_id TEXT,
  paypal_capture_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_verification_subscriptions_user_id
  ON public.verification_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_verification_subscriptions_status
  ON public.verification_subscriptions(status);

-- RPC: Subscribe user to verification (PayPal payment)
CREATE OR REPLACE FUNCTION public.subscribe_verification_paypal(
  p_user_id UUID,
  p_paypal_order_id TEXT,
  p_paypal_capture_id TEXT,
  p_amount_usd NUMERIC DEFAULT 5.00
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := now();
  v_expires TIMESTAMP WITH TIME ZONE;
  v_subscription_id TEXT;
BEGIN
  -- Calculate expiration (30 days from now)
  v_expires := v_now + INTERVAL '30 days';
  v_subscription_id := 'ver_' || substr(md5(random()::text), 1, 12);

  -- Update user profile
  UPDATE public.user_profiles
  SET
    is_verified = true,
    verified_since = COALESCE(verified_since, v_now),
    verification_subscription_id = v_subscription_id,
    verification_expires_at = v_expires,
    badge_type = 'verified',
    verification_payment_method = 'paypal',
    verification_paid_amount = p_amount_usd,
    updated_at = v_now
  WHERE id = p_user_id;

  -- Insert subscription record
  INSERT INTO public.verification_subscriptions (
    user_id, subscription_id, payment_method, amount_usd,
    status, started_at, expires_at, paypal_order_id, paypal_capture_id
  ) VALUES (
    p_user_id, v_subscription_id, 'paypal', p_amount_usd,
    'active', v_now, v_expires, p_paypal_order_id, p_paypal_capture_id
  );

  RETURN json_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'expires_at', v_expires
  );
END;
$$;

-- RPC: Subscribe user to verification (Coin payment - 500 TC)
CREATE OR REPLACE FUNCTION public.subscribe_verification_coins(
  p_user_id UUID,
  p_amount_coins INTEGER DEFAULT 500
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := now();
  v_expires TIMESTAMP WITH TIME ZONE;
  v_subscription_id TEXT;
  v_current_coins INTEGER;
BEGIN
  -- Check coin balance
  SELECT COALESCE(troll_coins, 0) INTO v_current_coins
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF v_current_coins < p_amount_coins THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient coins. Need ' || p_amount_coins || ' but have ' || v_current_coins
    );
  END IF;

  -- Calculate expiration (30 days from now)
  v_expires := v_now + INTERVAL '30 days';
  v_subscription_id := 'ver_' || substr(md5(random()::text), 1, 12);

  -- Deduct coins and update profile
  UPDATE public.user_profiles
  SET
    troll_coins = troll_coins - p_amount_coins,
    is_verified = true,
    verified_since = COALESCE(verified_since, v_now),
    verification_subscription_id = v_subscription_id,
    verification_expires_at = v_expires,
    badge_type = 'verified',
    verification_payment_method = 'coins',
    verification_paid_amount = p_amount_coins,
    updated_at = v_now
  WHERE id = p_user_id;

  -- Insert subscription record
  INSERT INTO public.verification_subscriptions (
    user_id, subscription_id, payment_method, amount_coins,
    status, started_at, expires_at
  ) VALUES (
    p_user_id, v_subscription_id, 'coins', p_amount_coins,
    'active', v_now, v_expires
  );

  RETURN json_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'expires_at', v_expires
  );
END;
$$;

-- RPC: Check and expire verification subscriptions (run periodically)
CREATE OR REPLACE FUNCTION public.expire_verification_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Mark expired subscriptions
  UPDATE public.verification_subscriptions
  SET status = 'expired', updated_at = now()
  WHERE status = 'active'
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Remove verification from users whose subscription expired
  UPDATE public.user_profiles
  SET
    is_verified = false,
    badge_type = NULL,
    updated_at = now()
  WHERE is_verified = true
    AND verification_expires_at < now();

  RETURN v_count;
END;
$$;

-- RPC: Cancel verification subscription
CREATE OR REPLACE FUNCTION public.cancel_verification_subscription(
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Cancel active subscription
  UPDATE public.verification_subscriptions
  SET status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE user_id = p_user_id AND status = 'active';

  -- Note: We don't immediately remove the badge - it stays until expiration
  -- This is a "cancel at end of period" model

  RETURN json_build_object(
    'success', true,
    'message', 'Subscription cancelled. Badge remains active until expiration.'
  );
END;
$$;

-- RPC: Admin remove verification
CREATE OR REPLACE FUNCTION public.admin_remove_verification(
  p_user_id UUID,
  p_admin_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Suspend all active subscriptions
  UPDATE public.verification_subscriptions
  SET status = 'suspended', updated_at = now()
  WHERE user_id = p_user_id AND status = 'active';

  -- Remove verification
  UPDATE public.user_profiles
  SET
    is_verified = false,
    verified_since = NULL,
    verification_subscription_id = NULL,
    verification_expires_at = NULL,
    badge_type = NULL,
    updated_at = now()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;

-- RPC: Admin extend verification
CREATE OR REPLACE FUNCTION public.admin_extend_verification(
  p_user_id UUID,
  p_days INTEGER,
  p_admin_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_expires TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate new expiration
  UPDATE public.user_profiles
  SET
    verification_expires_at = COALESCE(
      GREATEST(verification_expires_at, now()) + (p_days || ' days')::INTERVAL,
      now() + (p_days || ' days')::INTERVAL
    ),
    is_verified = true,
    verified_since = COALESCE(verified_since, now()),
    updated_at = now()
  WHERE id = p_user_id
  RETURNING verification_expires_at INTO v_new_expires;

  -- Update subscription expiration too
  UPDATE public.verification_subscriptions
  SET expires_at = v_new_expires, updated_at = now()
  WHERE user_id = p_user_id AND status = 'active';

  RETURN json_build_object(
    'success', true,
    'new_expires_at', v_new_expires
  );
END;
$$;

-- RPC: Check if user is eligible for verification
CREATE OR REPLACE FUNCTION public.check_verification_eligibility(
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile RECORD;
  v_account_age_hours INTEGER;
  v_has_reports BOOLEAN;
  v_is_jailed BOOLEAN;
BEGIN
  SELECT
    created_at,
    account_state,
    EXISTS(SELECT 1 FROM public.user_history WHERE user_id = p_user_id AND action_type = 'report' AND created_at > now() - INTERVAL '24 hours') as has_recent_reports,
    EXISTS(SELECT 1 FROM public.jail WHERE user_id = p_user_id AND status = 'jailed') as is_jailed
  INTO v_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('eligible', false, 'reason', 'User not found');
  END IF;

  v_account_age_hours := EXTRACT(EPOCH FROM (now() - v_profile.created_at)) / 3600;

  IF v_account_age_hours < 24 THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Account must be active for at least 24 hours'
    );
  END IF;

  IF v_profile.is_jailed THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Jailed accounts cannot apply for verification'
    );
  END IF;

  IF v_profile.has_recent_reports THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Accounts with recent reports cannot apply for verification'
    );
  END IF;

  IF v_profile.account_state IN ('banned', 'exiled') THEN
    RETURN json_build_object(
      'eligible', false,
      'reason', 'Banned or exiled accounts cannot apply for verification'
    );
  END IF;

  RETURN json_build_object('eligible', true);
END;
$$;

-- Grant permissions
GRANT ALL ON FUNCTION public.subscribe_verification_paypal(UUID, TEXT, TEXT, NUMERIC) TO authenticated;
GRANT ALL ON FUNCTION public.subscribe_verification_coins(UUID, INTEGER) TO authenticated;
GRANT ALL ON FUNCTION public.expire_verification_subscriptions() TO service_role;
GRANT ALL ON FUNCTION public.cancel_verification_subscription(UUID) TO authenticated;
GRANT ALL ON FUNCTION public.admin_remove_verification(UUID, UUID) TO service_role;
GRANT ALL ON FUNCTION public.admin_extend_verification(UUID, INTEGER, UUID) TO service_role;
GRANT ALL ON FUNCTION public.check_verification_eligibility(UUID) TO authenticated;
GRANT ALL ON public.verification_subscriptions TO authenticated;
GRANT ALL ON public.verification_subscriptions TO service_role;
