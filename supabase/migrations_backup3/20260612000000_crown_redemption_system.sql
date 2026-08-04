-- ============================================================
-- CROWN REDEMPTION SYSTEM
-- Created: 2026-06-12
-- ============================================================
-- This migration creates the crown_redemptions table, RLS policies,
-- and RPC functions for the Crown Redemption System.
-- ============================================================

-- 0. Ensure user_profiles has a crowns column (may already exist from battle system)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'crowns'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN crowns INTEGER DEFAULT 0;
  END IF;
END $$;

-- 1. Create the crown_redemptions table
CREATE TABLE IF NOT EXISTS public.crown_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('troll_coins', 'gift_card')),
  crowns_redeemed INTEGER NOT NULL CHECK (crowns_redeemed > 0),
  reward_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'rejected', 'cancelled')),
  email_sent BOOLEAN DEFAULT FALSE,
  fulfilled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fulfilled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments
COMMENT ON TABLE public.crown_redemptions IS 'Tracks all crown redemption requests';
COMMENT ON COLUMN public.crown_redemptions.reward_type IS 'Type of reward: troll_coins or gift_card';
COMMENT ON COLUMN public.crown_redemptions.crowns_redeemed IS 'Number of crowns deducted';
COMMENT ON COLUMN public.crown_redemptions.reward_value IS 'Human-readable reward value (e.g. "$10 Gift Card", "50 Troll Coins")';
COMMENT ON COLUMN public.crown_redemptions.status IS 'Redemption status: pending, approved, fulfilled, rejected, cancelled';
COMMENT ON COLUMN public.crown_redemptions.email_sent IS 'Whether the gift card email was sent';
COMMENT ON COLUMN public.crown_redemptions.fulfilled_by IS 'Admin user who fulfilled the request';
COMMENT ON COLUMN public.crown_redemptions.notes IS 'Admin notes about the redemption';

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_crown_redemptions_user_id ON public.crown_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_crown_redemptions_status ON public.crown_redemptions(status);
CREATE INDEX IF NOT EXISTS idx_crown_redemptions_reward_type ON public.crown_redemptions(reward_type);
CREATE INDEX IF NOT EXISTS idx_crown_redemptions_created_at ON public.crown_redemptions(created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.crown_redemptions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Users can read their own redemptions
CREATE POLICY "users_read_own_redemptions"
  ON public.crown_redemptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own redemptions
CREATE POLICY "users_insert_own_redemptions"
  ON public.crown_redemptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update only their own pending redemptions (to cancel)
CREATE POLICY "users_cancel_own_redemptions"
  ON public.crown_redemptions
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- Admins can read all redemptions
CREATE POLICY "admin_read_all_redemptions"
  ON public.crown_redemptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
    )
  );

-- Admins can update all redemptions (approve, reject, fulfill)
CREATE POLICY "admin_manage_redemptions"
  ON public.crown_redemptions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
    )
  );

-- 5. RPC: Redeem crowns for troll coins (atomic, server-side)
CREATE OR REPLACE FUNCTION public.redeem_crowns_for_coins(
  p_user_id UUID,
  p_crowns INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_crowns INTEGER;
  v_new_crowns INTEGER;
  v_redemption_id UUID;
BEGIN
  -- Lock the user profile row to prevent race conditions
  SELECT COALESCE(crowns, 0) INTO v_current_crowns
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_crowns IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF p_crowns <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must redeem at least 1 crown');
  END IF;

  IF v_current_crowns < p_crowns THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient crowns', 'current_crowns', v_current_crowns);
  END IF;

  -- Deduct crowns
  UPDATE public.user_profiles
  SET crowns = COALESCE(crowns, 0) - p_crowns,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING COALESCE(crowns, 0) INTO v_new_crowns;

  -- Add troll coins (1 crown = 1 troll coin)
  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + p_crowns,
      updated_at = now()
  WHERE id = p_user_id;

  -- Create redemption record
  INSERT INTO public.crown_redemptions (
    user_id, reward_type, crowns_redeemed, reward_value, status
  ) VALUES (
    p_user_id, 'troll_coins', p_crowns, p_crowns || ' Troll Coins', 'fulfilled'
  ) RETURNING id INTO v_redemption_id;

  -- Record coin transaction
  INSERT INTO public.coin_transactions (
    user_id, type, amount, description, metadata
  ) VALUES (
    p_user_id, 'crown_redemption', p_crowns,
    'Converted ' || p_crowns || ' crowns to ' || p_crowns || ' Troll Coins',
    jsonb_build_object('crown_redemption_id', v_redemption_id, 'crowns_redeemed', p_crowns)
  );

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'crowns_redeemed', p_crowns,
    'coins_awarded', p_crowns,
    'new_crown_balance', v_new_crowns
  );
END;
$$;

COMMENT ON FUNCTION public.redeem_crowns_for_coins IS 'Atomically converts crowns to troll coins (1:1 ratio)';

-- 6. RPC: Redeem crowns for gift card (creates pending request)
CREATE OR REPLACE FUNCTION public.redeem_crowns_for_gift_card(
  p_user_id UUID,
  p_crowns INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_crowns INTEGER;
  v_new_crowns INTEGER;
  v_reward_value TEXT;
  v_redemption_id UUID;
BEGIN
  -- Lock the user profile row
  SELECT COALESCE(crowns, 0) INTO v_current_crowns
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_crowns IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF p_crowns <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must redeem at least 1 crown');
  END IF;

  IF v_current_crowns < p_crowns THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient crowns', 'current_crowns', v_current_crowns);
  END IF;

  -- Determine gift card tier
  v_reward_value := CASE
    WHEN p_crowns BETWEEN 101 AND 200 THEN '$10 Gift Card'
    WHEN p_crowns BETWEEN 201 AND 300 THEN '$20 Gift Card'
    WHEN p_crowns BETWEEN 301 AND 500 THEN '$30 Gift Card'
    WHEN p_crowns BETWEEN 501 AND 750 THEN '$50 Gift Card'
    WHEN p_crowns BETWEEN 751 AND 1000 THEN '$75 Gift Card'
    WHEN p_crowns >= 1001 THEN '$100 Gift Card'
    ELSE 'Invalid Tier'
  END;

  IF v_reward_value = 'Invalid Tier' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum 101 crowns required for gift card redemption');
  END IF;

  -- Deduct crowns immediately
  UPDATE public.user_profiles
  SET crowns = COALESCE(crowns, 0) - p_crowns,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING COALESCE(crowns, 0) INTO v_new_crowns;

  -- Create pending redemption record
  INSERT INTO public.crown_redemptions (
    user_id, reward_type, crowns_redeemed, reward_value, status
  ) VALUES (
    p_user_id, 'gift_card', p_crowns, v_reward_value, 'pending'
  ) RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'crowns_redeemed', p_crowns,
    'reward', v_reward_value,
    'new_crown_balance', v_new_crowns,
    'status', 'pending'
  );
END;
$$;

COMMENT ON FUNCTION public.redeem_crowns_for_gift_card IS 'Creates a pending gift card redemption request after deducting crowns';

-- 7. RPC: Admin approve redemption
CREATE OR REPLACE FUNCTION public.admin_approve_redemption(
  p_redemption_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption RECORD;
BEGIN
  -- Verify admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_admin_id AND (is_admin = true OR role = 'admin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Lock and fetch redemption
  SELECT * INTO v_redemption
  FROM public.crown_redemptions
  WHERE id = p_redemption_id
  FOR UPDATE;

  IF v_redemption IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redemption not found');
  END IF;

  IF v_redemption.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redemption is not pending');
  END IF;

  UPDATE public.crown_redemptions
  SET status = 'approved',
      updated_at = now()
  WHERE id = p_redemption_id;

  RETURN jsonb_build_object('success', true, 'status', 'approved');
END;
$$;

-- 8. RPC: Admin fulfill redemption (mark as fulfilled)
CREATE OR REPLACE FUNCTION public.admin_fulfill_redemption(
  p_redemption_id UUID,
  p_admin_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption RECORD;
BEGIN
  -- Verify admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_admin_id AND (is_admin = true OR role = 'admin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_redemption
  FROM public.crown_redemptions
  WHERE id = p_redemption_id
  FOR UPDATE;

  IF v_redemption IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redemption not found');
  END IF;

  IF v_redemption.status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redemption must be approved first');
  END IF;

  UPDATE public.crown_redemptions
  SET status = 'fulfilled',
      fulfilled_by = p_admin_id,
      fulfilled_at = now(),
      email_sent = true,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_redemption_id;

  RETURN jsonb_build_object('success', true, 'status', 'fulfilled');
END;
$$;

-- 9. RPC: Admin reject redemption (refund crowns)
CREATE OR REPLACE FUNCTION public.admin_reject_redemption(
  p_redemption_id UUID,
  p_admin_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption RECORD;
BEGIN
  -- Verify admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_admin_id AND (is_admin = true OR role = 'admin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_redemption
  FROM public.crown_redemptions
  WHERE id = p_redemption_id
  FOR UPDATE;

  IF v_redemption IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redemption not found');
  END IF;

  IF v_redemption.status NOT IN ('pending', 'approved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot reject this redemption');
  END IF;

  -- Refund crowns
  UPDATE public.user_profiles
  SET crowns = COALESCE(crowns, 0) + v_redemption.crowns_redeemed,
      updated_at = now()
  WHERE id = v_redemption.user_id;

  UPDATE public.crown_redemptions
  SET status = 'rejected',
      fulfilled_by = p_admin_id,
      fulfilled_at = now(),
      notes = COALESCE(p_notes, notes),
      updated_at = now()
  WHERE id = p_redemption_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'rejected',
    'crowns_refunded', v_redemption.crowns_redeemed
  );
END;
$$;

-- 10. RPC: Cancel own pending redemption (refund crowns)
CREATE OR REPLACE FUNCTION public.cancel_redemption(
  p_redemption_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption RECORD;
BEGIN
  SELECT * INTO v_redemption
  FROM public.crown_redemptions
  WHERE id = p_redemption_id AND user_id = p_user_id
  FOR UPDATE;

  IF v_redemption IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redemption not found');
  END IF;

  IF v_redemption.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only cancel pending redemptions');
  END IF;

  -- Refund crowns
  UPDATE public.user_profiles
  SET crowns = COALESCE(crowns, 0) + v_redemption.crowns_redeemed,
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.crown_redemptions
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = p_redemption_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'cancelled',
    'crowns_refunded', v_redemption.crowns_redeemed
  );
END;
$$;

-- 11. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.redeem_crowns_for_coins TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_crowns_for_gift_card TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_redemption TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_fulfill_redemption TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_redemption TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_redemption TO authenticated;
