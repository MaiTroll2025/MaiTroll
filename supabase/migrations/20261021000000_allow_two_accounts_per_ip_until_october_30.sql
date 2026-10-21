CREATE OR REPLACE FUNCTION public.check_duplicate_account_on_ip(
    p_ip_address TEXT,
    p_email TEXT DEFAULT NULL,
    p_role TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_user_id UUID;
    v_existing_username TEXT;
    v_account_count INTEGER;
    v_account_limit INTEGER;
BEGIN
    IF p_ip_address IS NULL THEN
        RETURN jsonb_build_object('is_duplicate', false, 'message', 'No IP address provided');
    END IF;

    IF p_role IS NOT NULL AND p_role IN (
        'admin', 'superadmin', 'ceo', 'secretary', 'moderator', 'owner',
        'troll_officer', 'lead_troll_officer'
    ) THEN
        RETURN jsonb_build_object('is_duplicate', false, 'message', 'Exempt role - IP check bypassed');
    END IF;

    -- Keep the temporary two-account allowance through October 30, 2026 UTC.
    v_account_limit := CASE
        WHEN now() < TIMESTAMPTZ '2026-10-31 00:00:00+00' THEN 2
        ELSE 1
    END;

    SELECT COUNT(DISTINCT usi.user_id)::INTEGER,
           (ARRAY_AGG(up.id ORDER BY usi.created_at DESC))[1],
           (ARRAY_AGG(up.username ORDER BY usi.created_at DESC))[1]
    INTO v_account_count, v_existing_user_id, v_existing_username
    FROM public.user_signup_ips usi
    JOIN public.user_profiles up ON up.id = usi.user_id
    WHERE usi.ip_address = p_ip_address
      AND (p_email IS NULL OR up.email IS DISTINCT FROM p_email)
      AND NOT (
          up.is_admin IS TRUE
          OR up.is_troll_officer IS TRUE
          OR up.is_org_student IS TRUE
          OR up.role IN ('admin', 'superadmin', 'ceo', 'secretary', 'moderator', 'owner')
          OR up.troll_role IN ('student', 'instructor', 'troll_family')
      );

    IF COALESCE(v_account_count, 0) < v_account_limit THEN
        RETURN jsonb_build_object(
            'is_duplicate', false,
            'message', format('Signup allowed (%s of %s accounts already on this IP)', COALESCE(v_account_count, 0), v_account_limit),
            'account_limit', v_account_limit,
            'existing_account_count', COALESCE(v_account_count, 0)
        );
    END IF;

    RETURN jsonb_build_object(
        'is_duplicate', true,
        'existing_user_id', v_existing_user_id,
        'existing_username', v_existing_username,
        'account_limit', v_account_limit,
        'existing_account_count', v_account_count,
        'message', format('The account limit for this IP address has been reached (%s)', v_account_limit)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_duplicate_account_on_ip(TEXT, TEXT, TEXT)
  TO authenticated, service_role;
