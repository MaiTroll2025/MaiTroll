-- ============================================================================
-- Fast Pay application ID verification and admin approval workflow
-- ============================================================================

ALTER TABLE public.fast_pay_applications
  ADD COLUMN IF NOT EXISTS id_verification_url text,
  ADD COLUMN IF NOT EXISTS id_verification_uploaded_at timestamptz;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS cashout_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cashout_approved_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_user_id_fkey'
  ) THEN
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_user_id_fkey;
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.submit_fast_pay_application(
  p_payout_method text,
  p_payout_username text,
  p_payout_email text DEFAULT null,
  p_cashtag text DEFAULT null,
  p_venmo_handle text DEFAULT null,
  p_accepted_terms boolean DEFAULT false,
  p_accepted_fees boolean DEFAULT false,
  p_accepted_identity_verification boolean DEFAULT false,
  p_id_verification_url text DEFAULT null,
  p_id_verification_uploaded_at timestamptz DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile user_profiles;
  v_user_stats user_stats;
  v_account_age_days int;
  v_user_level int;
  v_application_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT p_accepted_terms OR NOT p_accepted_fees OR NOT p_accepted_identity_verification THEN
    RETURN jsonb_build_object('success', false, 'error', 'All terms must be accepted');
  END IF;

  IF p_payout_username IS NULL OR trim(p_payout_username) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout username is required');
  END IF;

  IF p_id_verification_url IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ID verification upload is required');
  END IF;

  SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_user_id;
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  SELECT * INTO v_user_stats FROM public.user_stats WHERE user_id = v_user_id;
  v_user_level := COALESCE(v_user_stats.level, v_profile.level, 1);
  v_account_age_days := COALESCE(EXTRACT(DAY FROM now() - v_profile.created_at), 0);

  IF EXISTS (
    SELECT 1 FROM public.fast_pay_applications
    WHERE user_id = v_user_id
    AND status IN ('pending', 'under_review', 'approved')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a pending or approved Fast Pay application');
  END IF;

  INSERT INTO public.fast_pay_applications (
    user_id, payout_method, payout_username, payout_email,
    cashtag, venmo_handle, accepted_terms, accepted_fees,
    accepted_identity_verification, user_level, account_age_days,
    has_verified_identity, has_violations, has_fraud_history,
    id_verification_url, id_verification_uploaded_at
  ) VALUES (
    v_user_id, p_payout_method, trim(p_payout_username), p_payout_email,
    p_cashtag, p_venmo_handle, p_accepted_terms, p_accepted_fees,
    p_accepted_identity_verification, v_user_level, v_account_age_days,
    COALESCE(v_profile.verified_since IS NOT NULL, false),
    COALESCE(v_profile.banned_at IS NOT NULL OR v_profile.suspended_until IS NOT NULL, false),
    COALESCE(v_profile.fast_pay_no_fraud_history, false),
    p_id_verification_url,
    p_id_verification_uploaded_at
  )
  ON CONFLICT (user_id) DO UPDATE SET
    payout_method = EXCLUDED.payout_method,
    payout_username = EXCLUDED.payout_username,
    payout_email = EXCLUDED.payout_email,
    cashtag = EXCLUDED.cashtag,
    venmo_handle = EXCLUDED.venmo_handle,
    accepted_terms = EXCLUDED.accepted_terms,
    accepted_fees = EXCLUDED.accepted_fees,
    accepted_identity_verification = EXCLUDED.accepted_identity_verification,
    user_level = EXCLUDED.user_level,
    account_age_days = EXCLUDED.account_age_days,
    has_verified_identity = EXCLUDED.has_verified_identity,
    has_violations = EXCLUDED.has_violations,
    has_fraud_history = EXCLUDED.has_fraud_history,
    id_verification_url = EXCLUDED.id_verification_url,
    id_verification_uploaded_at = EXCLUDED.id_verification_uploaded_at,
    status = 'pending',
    updated_at = now()
  RETURNING id INTO v_application_id;

  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_application_id,
    'message', 'Fast Pay application submitted for review'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.review_fast_pay_application(
  p_application_id uuid,
  p_new_status text,
  p_admin_notes text DEFAULT null,
  p_rejection_reason text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app fast_pay_applications;
  v_admin_id uuid := auth.uid();
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = v_admin_id
    AND role IN ('admin', 'superadmin', 'secretary')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin role required');
  END IF;

  SELECT * INTO v_app FROM public.fast_pay_applications WHERE id = p_application_id;
  IF v_app IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;

  IF v_app.status NOT IN ('pending', 'under_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application is not in a reviewable state');
  END IF;

  IF p_new_status NOT IN ('approved', 'rejected', 'under_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  UPDATE public.fast_pay_applications
  SET status = p_new_status,
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      admin_notes = p_admin_notes,
      rejection_reason = CASE WHEN p_new_status = 'rejected' THEN COALESCE(p_rejection_reason, '') ELSE admin_notes END,
      updated_at = now()
  WHERE id = p_application_id;

  IF p_new_status = 'approved' THEN
    UPDATE public.user_profiles
    SET cashout_approved = true,
        cashout_approved_at = now(),
        updated_at = now()
    WHERE id = v_app.user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE
      WHEN p_new_status = 'approved' THEN 'Fast Pay application approved'
      WHEN p_new_status = 'rejected' THEN 'Fast Pay application rejected'
      ELSE 'Application marked as under review'
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_friday_cashout(
    p_user_id UUID,
    p_coins_to_redeem BIGINT,
    p_provider_type TEXT,
    p_provider_username TEXT,
    p_user_tag TEXT DEFAULT NULL,
    p_id_verification_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user RECORD;
    v_available_coins BIGINT;
    v_tier RECORD;
    v_cash_amount NUMERIC(12,2);
    v_fee_amount NUMERIC(12,2) := 0;
    v_net_amount NUMERIC(12,2);
    v_payout_id UUID;
    v_last_approved_at TIMESTAMPTZ;
    v_now TIMESTAMPTZ := NOW();
    v_is_admin BOOLEAN := FALSE;
    v_is_cashout_approved BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    v_is_admin := (
        v_user.role = 'admin'
        OR v_user.is_admin = TRUE
        OR v_user.is_superadmin = TRUE
        OR v_user.role = 'owner'
        OR v_user.role = 'ceo_assistant'
        OR v_user.role = 'noah_assistant'
        OR v_user.role = 'secretary'
        OR v_user.troll_role = 'admin'
    );

    v_is_cashout_approved := COALESCE(v_user.cashout_approved, false);

    IF v_user.role = 'troller' OR v_user.is_troller = TRUE OR v_user.troll_role = 'troller' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trollers do not earn coins and cannot request cashouts.');
    END IF;

    IF NOT v_is_admin AND NOT v_is_cashout_approved THEN
        IF NOT (EXTRACT(ISODOW FROM v_now AT TIME ZONE 'America/Denver') IN (5, 6, 7)) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Cashout requests are only available on Fridays, Saturdays, and Sundays.');
        END IF;

        IF NOT (EXTRACT(HOUR FROM v_now AT TIME ZONE 'America/Denver') BETWEEN 1 AND 18) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Cashout requests are only accepted between 1:00 AM and 7:00 PM Mountain Time on weekends.');
        END IF;
    END IF;

    IF p_id_verification_url IS NULL AND NOT v_is_cashout_approved THEN
        SELECT created_at INTO v_last_approved_at
        FROM public.payout_requests
        WHERE user_id = p_user_id
          AND status IN ('approved', 'completed')
        ORDER BY created_at DESC
        LIMIT 1;

        IF NOT FOUND OR v_last_approved_at < (v_now - INTERVAL '30 days') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Please upload a government-issued ID in your MAI Pay application before requesting cashouts.'
            );
        END IF;
    END IF;

    v_available_coins := COALESCE(v_user.cashout_coins, 0) - COALESCE(v_user.cashout_reserved_coins, 0);

    IF v_available_coins < p_coins_to_redeem THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient cashout coin balance. Please move eligible coins to Cashout Escrow first.',
            'available_coins', v_available_coins,
            'requested', p_coins_to_redeem
        );
    END IF;

    SELECT * INTO v_tier
    FROM public.cashout_tiers
    WHERE coin_amount <= p_coins_to_redeem
      AND is_active = TRUE
    ORDER BY coin_amount DESC
    LIMIT 1;

    IF NOT FOUND THEN
        SELECT * INTO v_tier
        FROM public.cashout_tiers
        WHERE is_active = TRUE
        ORDER BY coin_amount ASC
        LIMIT 1;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'No active cashout tiers configured.');
        END IF;
    END IF;

    v_cash_amount := v_tier.cash_amount;
    v_fee_amount := ROUND(p_coins_to_redeem * 0.029, 0);
    v_net_amount := v_cash_amount;

    UPDATE public.user_profiles
    SET cashout_reserved_coins = COALESCE(cashout_reserved_coins, 0) + p_coins_to_redeem,
        updated_at = v_now
    WHERE id = p_user_id;

    INSERT INTO public.payout_requests (
        user_id,
        coin_amount,
        cash_amount,
        net_amount,
        status,
        provider_type,
        provider_username,
        user_tag,
        id_verification_url,
        id_verification_uploaded_at,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_coins_to_redeem,
        v_cash_amount,
        v_net_amount,
        'pending',
        p_provider_type,
        p_provider_username,
        p_user_tag,
        p_id_verification_url,
        CASE WHEN p_id_verification_url IS NOT NULL THEN v_now ELSE NULL END,
        v_now,
        v_now
    )
    RETURNING id INTO v_payout_id;

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'coins_reserved', p_coins_to_redeem,
        'usd_amount', v_cash_amount,
        'fee_coins', v_fee_amount,
        'status', 'pending'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_fast_pay_application(text, text, text, text, text, boolean, boolean, boolean, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_fast_pay_application(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_friday_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
