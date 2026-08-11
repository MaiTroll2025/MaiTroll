-- ============================================================================
-- Server-authoritative raid system
-- ============================================================================

CREATE OR REPLACE FUNCTION public.raid_property(
  p_attacker_id uuid,
  p_target_user_id uuid,
  p_target_house_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_attacker_profile public.user_profiles%ROWTYPE;
  v_target_profile public.user_profiles%ROWTYPE;
  v_house public.houses%ROWTYPE;
  v_active_insurance public.homeowners_insurances%ROWTYPE;
  v_repair_cost integer := 2000;
  v_deductible integer := 0;
  v_user_pays integer := 0;
  v_raid_id uuid;
  v_now timestamptz := now();
BEGIN
  -- 0. Verify authenticated user
  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'message', 'You must be signed in');
  END IF;

  -- Attacker must be the authenticated user
  IF v_auth_user_id != p_attacker_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'message', 'You can only raid as yourself');
  END IF;

  -- 1. Verify attacker
  SELECT * INTO v_attacker_profile FROM public.user_profiles WHERE id = p_attacker_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'ATTACKER_NOT_FOUND', 'message', 'Attacker profile not found');
  END IF;

  -- 2. Verify target
  SELECT * INTO v_target_profile FROM public.user_profiles WHERE id = p_target_user_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'TARGET_NOT_FOUND', 'message', 'Target user not found');
  END IF;

  IF p_attacker_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'CANNOT_RAID_SELF', 'message', 'Cannot raid yourself');
  END IF;

  -- 3. Verify house ownership
  SELECT * INTO v_house FROM public.houses WHERE id = p_target_house_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'HOUSE_NOT_FOUND', 'message', 'Property not found');
  END IF;
  IF v_house.owner_user_id != p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_TARGET_HOUSE', 'message', 'You can only raid the target user\'s property');
  END IF;

  -- 4. Check raid cooldown (prevent spam: 5 minutes)
  IF EXISTS (
    SELECT 1 FROM public.house_raids
    WHERE house_id = p_target_house_id
      AND raided_by_user_id = p_attacker_id
      AND raided_at > v_now - interval '5 minutes'
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'RAID_COOLDOWN', 'message', 'You must wait before raiding this property again');
  END IF;

  -- 5. Check attacker has enough coins
  IF COALESCE(v_attacker_profile.troll_coins, 0) < 100 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INSUFFICIENT_COINS', 'message', 'You need 100 Troll Coins to raid');
  END IF;

  -- 6. Check target active insurance
  SELECT * INTO v_active_insurance
  FROM public.homeowners_insurances
  WHERE user_id = p_target_user_id
    AND house_id = p_target_house_id
    AND status = 'active'
    AND is_active = true
    AND expires_at > v_now
  LIMIT 1;

  IF FOUND THEN
    v_deductible := COALESCE(v_active_insurance.deductible, 25);
    v_user_pays := v_deductible;
  ELSE
    v_user_pays := v_repair_cost;
  END IF;

  -- 7. Deduct attacker coins
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - 100,
      updated_at = v_now
  WHERE id = p_attacker_id;

  -- 8. Charge target for repair
  IF v_user_pays > 0 THEN
    IF COALESCE(v_target_profile.troll_coins, 0) < v_user_pays THEN
      -- Cannot afford repair; mark property as damaged/repossessed
      UPDATE public.houses
      SET condition = LEAST(condition - 30, 0),
          is_reposessed = true,
          updated_at = v_now
      WHERE id = p_target_house_id;
    ELSE
      UPDATE public.user_profiles
      SET troll_coins = troll_coins - v_user_pays,
          updated_at = v_now
      WHERE id = p_target_user_id;

      UPDATE public.houses
      SET condition = GREATEST(condition - 30, 0),
          updated_at = v_now
      WHERE id = p_target_house_id;
    END IF;
  END IF;

  -- 9. Record raid
  INSERT INTO public.house_raids (
    house_id,
    raided_by_user_id,
    damage_level,
    raided_at,
    repaired_at
  ) VALUES (
    p_target_house_id,
    p_attacker_id,
    'minor',
    v_now,
    NULL
  ) RETURNING id INTO v_raid_id;

  -- 10. Record insurance claim if insured
  IF FOUND AND v_active_insurance.id IS NOT NULL THEN
    UPDATE public.homeowners_insurances
    SET deductible_paid = deductible_paid + v_deductible,
        claims_made = claims_made + 1,
        updated_at = v_now
    WHERE id = v_active_insurance.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'RAID_SUCCESS',
    'message', 'Raid completed',
    'data', jsonb_build_object(
      'raid_id', v_raid_id,
      'repair_cost', v_repair_cost,
      'deductible', v_deductible,
      'user_pays', v_user_pays,
      'insured', FOUND
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.raid_property(uuid, uuid, uuid) TO authenticated;
