-- ============================================================================
-- License enforcement RPCs for broadcast and cashout
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_start_broadcast(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_license public.user_driver_licenses%ROWTYPE;
  v_license_status text;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_profile FROM public.user_profiles WHERE id = p_user_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND', 'message', 'User not found');
  END IF;

  SELECT * INTO v_license FROM public.user_driver_licenses WHERE user_id = p_user_id LIMIT 1;
  v_license_status := COALESCE(v_license.status, 'none');

  IF v_license_status = 'suspended' THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_SUSPENDED', 'message', 'Your Mai Troll license is suspended. You cannot start a broadcast.');
  END IF;

  IF v_license_status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_REVOKED', 'message', 'Your Mai Troll license has been revoked. You cannot start a broadcast.');
  END IF;

  IF v_license_status = 'expired' OR (v_license.expires_at IS NOT NULL AND v_license.expires_at < v_now) THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_EXPIRED', 'message', 'Your Mai Troll license has expired. Renew it to broadcast.');
  END IF;

  IF v_license_status = 'none' THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_LICENSE', 'message', 'You need a Mai Troll license to start a broadcast.');
  END IF;

  RETURN jsonb_build_object('success', true, 'code', 'LICENSE_ACTIVE', 'message', 'License valid', 'data', jsonb_build_object('status', v_license_status));
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_start_broadcast(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_cashout(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_license public.user_driver_licenses%ROWTYPE;
  v_license_status text;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_license FROM public.user_driver_licenses WHERE user_id = p_user_id LIMIT 1;
  v_license_status := COALESCE(v_license.status, 'none');

  IF v_license_status = 'suspended' THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_SUSPENDED', 'message', 'Your Mai Troll license is suspended. You cannot cash out.');
  END IF;

  IF v_license_status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_REVOKED', 'message', 'Your Mai Troll license has been revoked. You cannot cash out.');
  END IF;

  IF v_license_status = 'expired' OR (v_license.expires_at IS NOT NULL AND v_license.expires_at < v_now) THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_EXPIRED', 'message', 'Your Mai Troll license has expired. Renew it to cash out.');
  END IF;

  IF v_license_status = 'none' THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_LICENSE', 'message', 'You need a Mai Troll license to cash out.');
  END IF;

  RETURN jsonb_build_object('success', true, 'code', 'LICENSE_ACTIVE', 'message', 'License valid for cashout', 'data', jsonb_build_object('status', v_license_status));
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_cashout(uuid) TO authenticated;
