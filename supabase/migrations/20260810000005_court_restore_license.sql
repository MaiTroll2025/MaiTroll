-- ============================================================================
-- Troll Court license restoration
-- ============================================================================

CREATE OR REPLACE FUNCTION public.court_restore_license(
  p_case_id uuid,
  p_judge_id uuid,
  p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_judge_profile public.user_profiles%ROWTYPE;
  v_target_profile public.user_profiles%ROWTYPE;
  v_case public.court_cases%ROWTYPE;
  v_license public.user_driver_licenses%ROWTYPE;
  v_now timestamptz := now();
  v_authorized boolean := false;
BEGIN
  -- 1. Verify judge exists and has authority
  SELECT * INTO v_judge_profile FROM public.user_profiles WHERE id = p_judge_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'JUDGE_NOT_FOUND', 'message', 'Judge not found');
  END IF;

  -- Authorized roles: admin, ceo, judge (if judge role exists), lead_troll_officer, secretary
  IF v_judge_profile.role IN ('admin', 'ceo', 'judge', 'lead_troll_officer', 'secretary')
     OR v_judge_profile.is_admin = true
     OR v_judge_profile.is_lead_officer = true THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_AUTHORIZED', 'message', 'You are not authorized to restore licenses');
  END IF;

  -- 2. Verify case exists and is in session/ruled state
  SELECT * INTO v_case FROM public.court_cases WHERE id = p_case_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'CASE_NOT_FOUND', 'message', 'Court case not found');
  END IF;

  IF v_case.status NOT IN ('in_session', 'open', 'scheduled') THEN
    RETURN jsonb_build_object('success', false, 'code', 'CASE_NOT_ACTIVE', 'message', 'Case is not active');
  END IF;

  -- 3. Verify target user exists and has suspended license
  SELECT * INTO v_target_profile FROM public.user_profiles WHERE id = p_target_user_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'TARGET_NOT_FOUND', 'message', 'Target user not found');
  END IF;

  SELECT * INTO v_license FROM public.user_driver_licenses WHERE user_id = p_target_user_id LIMIT 1;
  IF FOUND THEN
    IF v_license.status != 'suspended' THEN
      RETURN jsonb_build_object('success', false, 'code', 'LICENSE_NOT_SUSPENDED', 'message', 'Target license is not suspended');
    END IF;

    UPDATE public.user_driver_licenses
    SET status = 'active',
        suspended_until = NULL,
        suspension_reason = NULL,
        suspended_by = NULL,
        updated_at = v_now
    WHERE user_id = p_target_user_id;
  ELSE
    INSERT INTO public.user_driver_licenses (user_id, status, issued_at, expires_at, updated_at)
    VALUES (p_target_user_id, 'active', v_now, v_now + interval '1 year', v_now);
  END IF;

  UPDATE public.user_profiles
  SET license_status = 'active',
      drivers_license_expiry = COALESCE(drivers_license_expiry, v_now + interval '1 year'),
      license_restored_at = v_now,
      license_restored_by = p_judge_id,
      updated_at = v_now
  WHERE id = p_target_user_id;

  -- 4. Update case status
  UPDATE public.court_cases
  SET status = 'ruled',
      ruling = 'license_restored',
      ruled_at = v_now,
      judged_by = p_judge_id,
      updated_at = v_now
  WHERE id = p_case_id;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'LICENSE_RESTORED',
    'message', 'License restored successfully',
    'data', jsonb_build_object(
      'target_user_id', p_target_user_id,
      'case_id', p_case_id,
      'restored_at', v_now,
      'restored_by', p_judge_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.court_restore_license(uuid, uuid, uuid) TO authenticated;
