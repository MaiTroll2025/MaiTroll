-- ============================================================
-- CROWN REDEMPTION SYSTEM V2
-- Created: 2026-06-13
-- ============================================================
-- Adds giftcard_code storage, secretary access to crown_redemptions,
-- notification sending on fulfillment, and redemption notification types.
-- ============================================================

-- 1. Add giftcard_code column to crown_redemptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crown_redemptions'
      AND column_name = 'giftcard_code'
  ) THEN
    ALTER TABLE public.crown_redemptions
      ADD COLUMN giftcard_code TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.crown_redemptions.giftcard_code IS 'Gift card code entered by admin/secretary upon fulfillment';

-- 2. Drop and recreate RLS policies to include secretary role

-- Drop existing policies
DROP POLICY IF EXISTS "admin_read_all_redemptions" ON public.crown_redemptions;
DROP POLICY IF EXISTS "admin_manage_redemptions" ON public.crown_redemptions;

-- Admins and secretaries can read all redemptions
CREATE POLICY "staff_read_all_redemptions"
  ON public.crown_redemptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          is_admin = true
          OR role IN ('admin', 'secretary', 'Secretary', 'Troll_City_Secretary', 'Executive_Secretary')
        )
    )
  );

-- Admins and secretaries can update all redemptions
CREATE POLICY "staff_manage_redemptions"
  ON public.crown_redemptions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          is_admin = true
          OR role IN ('admin', 'secretary', 'Secretary', 'Troll_City_Secretary', 'Executive_Secretary')
        )
    )
  );

-- 3. Update admin_approve_redemption to accept secretary role
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
  -- Verify admin or secretary
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_admin_id
      AND (
        is_admin = true
        OR role IN ('admin', 'secretary', 'Secretary', 'Troll_City_Secretary', 'Executive_Secretary')
      )
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

COMMENT ON FUNCTION public.admin_approve_redemption IS 'Approves a pending redemption (admin or secretary)';

-- 4. Update admin_fulfill_redemption to accept secretary role, accept giftcard_code, and notify user
-- Must DROP first because we're changing the function signature (adding p_giftcard_code param)
DROP FUNCTION IF EXISTS public.admin_fulfill_redemption(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_fulfill_redemption(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_fulfill_redemption(UUID, UUID, TEXT, TEXT);
CREATE FUNCTION public.admin_fulfill_redemption(
  p_redemption_id UUID,
  p_admin_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_giftcard_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption RECORD;
  v_user_email TEXT;
  v_user_name TEXT;
BEGIN
  -- Verify admin or secretary
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_admin_id
      AND (
        is_admin = true
        OR role IN ('admin', 'secretary', 'Secretary', 'Troll_City_Secretary', 'Executive_Secretary')
      )
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

  -- Update redemption
  UPDATE public.crown_redemptions
  SET status = 'fulfilled',
      fulfilled_by = p_admin_id,
      fulfilled_at = now(),
      email_sent = true,
      notes = COALESCE(p_notes, notes),
      giftcard_code = COALESCE(p_giftcard_code, giftcard_code),
      updated_at = now()
  WHERE id = p_redemption_id;

  -- Get user info for notification
  SELECT COALESCE(display_name, username, 'User'), email
  INTO v_user_name, v_user_email
  FROM public.user_profiles
  WHERE id = v_redemption.user_id;

  -- Send in-app notification to user with gift card code if available
  IF p_giftcard_code IS NOT NULL AND p_giftcard_code != '' THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata, is_read, created_at)
    VALUES (
      v_redemption.user_id,
      'gift_received',
      'Gift Card Ready!',
      'Your ' || v_redemption.reward_value || ' gift card has been redeemed! Code: ' || p_giftcard_code,
      jsonb_build_object(
        'redemption_id', p_redemption_id,
        'reward_value', v_redemption.reward_value,
        'giftcard_code', p_giftcard_code,
        'crowns_redeemed', v_redemption.crowns_redeemed
      ),
      false,
      now()
    );
  ELSE
    INSERT INTO public.notifications (user_id, type, title, message, metadata, is_read, created_at)
    VALUES (
      v_redemption.user_id,
      'gift_received',
      'Gift Card Fulfilled!',
      'Your ' || v_redemption.reward_value || ' gift card request has been fulfilled. Check your email on file.',
      jsonb_build_object(
        'redemption_id', p_redemption_id,
        'reward_value', v_redemption.reward_value,
        'crowns_redeemed', v_redemption.crowns_redeemed
      ),
      false,
      now()
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'fulfilled');
END;
$$;

COMMENT ON FUNCTION public.admin_fulfill_redemption IS 'Marks an approved redemption as fulfilled, stores giftcard_code, and notifies user';

-- 5. Update admin_reject_redemption to accept secretary role
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
  -- Verify admin or secretary
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_admin_id
      AND (
        is_admin = true
        OR role IN ('admin', 'secretary', 'Secretary', 'Troll_City_Secretary', 'Executive_Secretary')
      )
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

  -- Notify user about rejection
  INSERT INTO public.notifications (user_id, type, title, message, metadata, is_read, created_at)
  VALUES (
    v_redemption.user_id,
    'refund_issued',
    'Crown Redemption Rejected',
    'Your ' || v_redemption.reward_value || ' redemption was rejected. ' || v_redemption.crowns_redeemed || ' crowns have been refunded.',
    jsonb_build_object(
      'redemption_id', p_redemption_id,
      'reward_value', v_redemption.reward_value,
      'crowns_refunded', v_redemption.crowns_redeemed
    ),
    false,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'rejected',
    'crowns_refunded', v_redemption.crowns_redeemed
  );
END;
$$;

COMMENT ON FUNCTION public.admin_reject_redemption IS 'Rejects a redemption, refunds crowns, and notifies user (admin or secretary)';

-- 6. Update redeem_crowns_for_gift_card to notify user on submission
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

  -- Notify user
  INSERT INTO public.notifications (user_id, type, title, message, metadata, is_read, created_at)
  VALUES (
    p_user_id,
    'gift_received',
    'Gift Card Request Submitted',
    'Your request for ' || v_reward_value || ' (' || p_crowns || ' crowns) has been submitted for review.',
    jsonb_build_object(
      'redemption_id', v_redemption_id,
      'reward_value', v_reward_value,
      'crowns_redeemed', p_crowns,
      'status', 'pending'
    ),
    false,
    now()
  );

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

COMMENT ON FUNCTION public.redeem_crowns_for_gift_card IS 'Creates a pending gift card redemption request, deducts crowns, and notifies user';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_approve_redemption TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_fulfill_redemption TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_redemption TO authenticated;
