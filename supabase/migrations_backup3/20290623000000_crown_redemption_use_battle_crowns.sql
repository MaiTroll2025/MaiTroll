-- ============================================================
-- CROWN REDEMPTION: USE battle_crowns COLUMN
-- ============================================================
-- The battle system awards battle_crowns, but the redemption RPCs
-- were reading/writing the separate crowns column. Update all
-- functions to use battle_crowns so redemption works with the
-- crowns users actually earn from battles.
-- ============================================================

-- 1. Update redeem_crowns_for_coins
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
  -- Bypass security trigger for coin updates
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Lock the user profile row to prevent race conditions
  SELECT COALESCE(battle_crowns, 0) INTO v_current_crowns
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
  SET battle_crowns = COALESCE(battle_crowns, 0) - p_crowns,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING COALESCE(battle_crowns, 0) INTO v_new_crowns;

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

COMMENT ON FUNCTION public.redeem_crowns_for_coins IS 'Atomically converts battle_crowns to troll coins (1:1 ratio)';

-- 2. Update redeem_crowns_for_gift_card
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
  -- Bypass security trigger for coin updates
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Lock the user profile row
  SELECT COALESCE(battle_crowns, 0) INTO v_current_crowns
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
  SET battle_crowns = COALESCE(battle_crowns, 0) - p_crowns,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING COALESCE(battle_crowns, 0) INTO v_new_crowns;

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

COMMENT ON FUNCTION public.redeem_crowns_for_gift_card IS 'Creates a pending gift card redemption request, deducts battle_crowns, and notifies user';

-- 3. Update admin_reject_redemption to refund battle_crowns
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

  -- Bypass security trigger for coin updates
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Refund battle_crowns
  UPDATE public.user_profiles
  SET battle_crowns = COALESCE(battle_crowns, 0) + v_redemption.crowns_redeemed,
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

COMMENT ON FUNCTION public.admin_reject_redemption IS 'Rejects a redemption, refunds battle_crowns, and notifies user (admin or secretary)';

-- 4. Update cancel_redemption to refund battle_crowns
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

  -- Bypass security trigger for coin updates
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Refund battle_crowns
  UPDATE public.user_profiles
  SET battle_crowns = COALESCE(battle_crowns, 0) + v_redemption.crowns_redeemed,
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

COMMENT ON FUNCTION public.cancel_redemption IS 'Cancels own pending redemption and refunds battle_crowns';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.redeem_crowns_for_coins TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_crowns_for_gift_card TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_redemption TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_redemption TO authenticated;
