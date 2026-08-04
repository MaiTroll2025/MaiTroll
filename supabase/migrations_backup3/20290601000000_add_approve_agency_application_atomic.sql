BEGIN;

CREATE OR REPLACE FUNCTION public.approve_agency_application_atomic(
    p_application_id UUID,
    p_approved_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_application public.agency_applications;
    v_settings public.agency_platform_settings;
    v_actor_role TEXT;
    v_applicant_balance INTEGER;
    v_application_fee INTEGER;
    v_monthly_fee INTEGER;
    v_total_fee INTEGER;
    v_member_updated INTEGER;
BEGIN
    IF p_approved_by IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Approval actor is required'
        );
    END IF;

    SELECT *
    INTO v_application
    FROM public.agency_applications
    WHERE id = p_application_id
      AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Application not found or already reviewed'
        );
    END IF;

    IF v_application.agency_id IS NULL OR v_application.applicant_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Application is missing agency_id or applicant_id'
        );
    END IF;

    SELECT role
    INTO v_actor_role
    FROM public.agency_members
    WHERE agency_id = v_application.agency_id
      AND user_id = p_approved_by
      AND status = 'active'
    LIMIT 1;

    IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'manager') THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'You do not have permission to approve agency applications'
        );
    END IF;

    SELECT *
    INTO v_settings
    FROM public.agency_platform_settings
    ORDER BY updated_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Agency platform settings are not configured'
        );
    END IF;

    IF v_settings.agency_hr_manager_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Agency HR Manager recipient account is not configured'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_settings.agency_hr_manager_user_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Agency HR Manager recipient profile was not found'
        );
    END IF;

    v_application_fee := GREATEST(COALESCE(v_settings.application_fee_coins, 0), 25000);
    v_monthly_fee := GREATEST(COALESCE(v_settings.monthly_fee_coins, 0), 10000);
    v_total_fee := v_application_fee + v_monthly_fee;

    SELECT troll_coins
    INTO v_applicant_balance
    FROM public.user_profiles
    WHERE id = v_application.applicant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Applicant profile not found'
        );
    END IF;

    IF v_total_fee > 0 AND COALESCE(v_applicant_balance, 0) < v_total_fee THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Insufficient Troll Coins to pay agency application fee'
        );
    END IF;

    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_total_fee,
        total_spent_coins = COALESCE(total_spent_coins, 0) + v_total_fee,
        updated_at = NOW()
    WHERE id = v_application.applicant_id
      AND COALESCE(troll_coins, 0) >= v_total_fee;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Insufficient Troll Coins to pay agency application fee'
        );
    END IF;

    IF v_application_fee > 0 THEN
        INSERT INTO public.agency_billing_events (
            agency_id,
            billing_type,
            amount_coins,
            status,
            payer_user_id,
            recipient_user_id,
            created_by,
            paid_at,
            metadata
        ) VALUES (
            v_application.agency_id,
            'application_fee',
            v_application_fee,
            'paid',
            v_application.applicant_id,
            v_settings.agency_hr_manager_user_id,
            p_approved_by,
            NOW(),
            jsonb_build_object(
                'source', 'approve_agency_application_atomic',
                'application_id', p_application_id,
                'application_fee_coins', v_application_fee,
                'monthly_fee_coins', v_monthly_fee
            )
        );
    END IF;

    IF v_monthly_fee > 0 THEN
        INSERT INTO public.agency_billing_events (
            agency_id,
            billing_type,
            amount_coins,
            status,
            payer_user_id,
            recipient_user_id,
            created_by,
            paid_at,
            metadata
        ) VALUES (
            v_application.agency_id,
            'monthly_fee',
            v_monthly_fee,
            'paid',
            v_application.applicant_id,
            v_settings.agency_hr_manager_user_id,
            p_approved_by,
            NOW(),
            jsonb_build_object(
                'source', 'approve_agency_application_atomic',
                'application_id', p_application_id,
                'application_fee_coins', v_application_fee,
                'monthly_fee_coins', v_monthly_fee
            )
        );

        UPDATE public.agencies
        SET last_monthly_fee_paid_at = NOW(),
            monthly_fee_status = 'paid',
            updated_at = NOW()
        WHERE id = v_application.agency_id;
    END IF;

    UPDATE public.agency_applications
    SET status = 'approved',
        reviewed_by = p_approved_by,
        reviewed_at = NOW(),
        application_fee_paid = true
    WHERE id = p_application_id;

    UPDATE public.agency_members
    SET role = 'creator',
        status = 'active',
        removed_at = NULL,
        joined_at = COALESCE(joined_at, NOW()),
        created_at = COALESCE(created_at, NOW())
    WHERE agency_id = v_application.agency_id
      AND user_id = v_application.applicant_id;

    GET DIAGNOSTICS v_member_updated = ROW_COUNT;

    IF v_member_updated = 0 THEN
        INSERT INTO public.agency_members (
            agency_id,
            user_id,
            role,
            status,
            joined_at
        ) VALUES (
            v_application.agency_id,
            v_application.applicant_id,
            'creator',
            'active',
            NOW()
        );
    END IF;

    INSERT INTO public.agency_enforcement_actions (
        agency_id,
        actor_id,
        target_user_id,
        action_type,
        reason,
        metadata
    ) VALUES (
        v_application.agency_id,
        p_approved_by,
        v_application.applicant_id,
        'application_approved',
        'Approved agency application and charged fees',
        jsonb_build_object(
            'application_id', p_application_id,
            'application_fee_coins', v_application_fee,
            'monthly_fee_coins', v_monthly_fee,
            'total_fee_coins', v_total_fee
        )
    );

    INSERT INTO public.agency_activity_logs (
        agency_id,
        actor_id,
        target_user_id,
        action,
        metadata
    ) VALUES (
        v_application.agency_id,
        p_approved_by,
        v_application.applicant_id,
        'application_approved',
        jsonb_build_object(
            'application_id', p_application_id,
            'application_fee_coins', v_application_fee,
            'monthly_fee_coins', v_monthly_fee,
            'total_fee_coins', v_total_fee
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'agency_id', v_application.agency_id,
        'fee_charged_amount', v_total_fee,
        'application_fee_coins', v_application_fee,
        'monthly_fee_coins', v_monthly_fee
    );
END;
$$;

COMMIT;
