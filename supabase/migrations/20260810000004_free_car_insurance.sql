-- ============================================================================
-- Free first month insurance for new users (server-enforced)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.issue_free_car_insurance(p_user_id uuid, p_vehicle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.car_insurances%ROWTYPE;
  v_now timestamptz := now();
  v_expiry timestamptz := v_now + interval '30 days';
  v_insurance_id uuid;
BEGIN
  -- Check if user already has ANY car insurance (prevents repeated claims)
  SELECT * INTO v_existing
  FROM public.car_insurances
  WHERE user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'ALREADY_HAS_INSURANCE',
      'message', 'User already has car insurance',
      'data', jsonb_build_object('existing_id', v_existing.id, 'expires_at', v_existing.expires_at)
    );
  END IF;

  INSERT INTO public.car_insurances (
    user_id,
    vehicle_id,
    status,
    starts_at,
    expires_at,
    deductible_paid,
    is_free_issue,
    issued_at
  ) VALUES (
    p_user_id,
    p_vehicle_id,
    'active',
    v_now,
    v_expiry,
    0,
    true,
    v_now
  ) RETURNING id INTO v_insurance_id;

  UPDATE public.user_profiles
  SET car_insurance_expiry = v_expiry,
      updated_at = v_now
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'FREE_INSURANCE_ISSUED',
    'message', 'Free 30-day car insurance issued',
    'data', jsonb_build_object('insurance_id', v_insurance_id, 'expires_at', v_expiry)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_free_car_insurance(uuid, uuid) TO authenticated;

-- Ensure underlying car_insurance_policies table has required columns
ALTER TABLE public.car_insurance_policies
  ADD COLUMN IF NOT EXISTS is_free_issue boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz DEFAULT now();
