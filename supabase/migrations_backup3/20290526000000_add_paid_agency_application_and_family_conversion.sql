BEGIN;

CREATE TABLE IF NOT EXISTS public.agency_platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_hr_manager_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    application_fee_coins INTEGER NOT NULL DEFAULT 25000 CHECK (application_fee_coins >= 0),
    monthly_fee_coins INTEGER NOT NULL DEFAULT 10000 CHECK (monthly_fee_coins >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agency_billing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
    billing_type TEXT NOT NULL CHECK (billing_type IN ('application_fee', 'monthly_fee')),
    amount_coins INTEGER NOT NULL CHECK (amount_coins >= 0),
    status TEXT NOT NULL CHECK (status IN ('paid', 'failed', 'pending')) DEFAULT 'pending',
    payer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    paid_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_billing_events_agency_id ON public.agency_billing_events (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agency_billing_events_status ON public.agency_billing_events (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agency_billing_events_billing_type ON public.agency_billing_events (billing_type, created_at DESC);

ALTER TABLE public.agencies
    ADD COLUMN IF NOT EXISTS last_monthly_fee_paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS monthly_fee_status TEXT DEFAULT 'pending' CHECK (monthly_fee_status IN ('pending', 'paid', 'failed'));

INSERT INTO public.agency_platform_settings (agency_hr_manager_user_id, application_fee_coins, monthly_fee_coins)
SELECT NULL, 25000, 10000
WHERE NOT EXISTS (
    SELECT 1
    FROM public.agency_platform_settings
);

DO $$
DECLARE
    v_default_hr_manager UUID;
BEGIN
    SELECT id
    INTO v_default_hr_manager
    FROM public.user_profiles
    WHERE is_admin = true
       OR lower(COALESCE(role, '')) IN ('admin', 'owner', 'ceo')
    ORDER BY created_at
    LIMIT 1;

    IF v_default_hr_manager IS NOT NULL THEN
        UPDATE public.agency_platform_settings
        SET agency_hr_manager_user_id = v_default_hr_manager,
            updated_at = NOW()
        WHERE agency_hr_manager_user_id IS NULL;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.upsert_agency_platform_settings(
    p_agency_hr_manager_user_id UUID,
    p_application_fee_coins INTEGER DEFAULT 25000,
    p_monthly_fee_coins INTEGER DEFAULT 10000
)
RETURNS public.agency_platform_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_role TEXT;
    v_settings public.agency_platform_settings;
BEGIN
    IF p_application_fee_coins < 0 THEN
        RAISE EXCEPTION 'application_fee_coins cannot be negative';
    END IF;

    IF p_monthly_fee_coins < 0 THEN
        RAISE EXCEPTION 'monthly_fee_coins cannot be negative';
    END IF;

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT lower(COALESCE(role, ''))
    INTO v_user_role
    FROM public.user_profiles
    WHERE id = auth.uid()
    LIMIT 1;

    IF COALESCE(v_user_role, '') NOT IN ('admin', 'owner', 'ceo', 'agency hr manager', 'agency_hr_manager') AND COALESCE((SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()), false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Only admins and Agency HR Managers can update the agency platform settings';
    END IF;

    SELECT *
    INTO v_settings
    FROM public.agency_platform_settings
    ORDER BY updated_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        UPDATE public.agency_platform_settings
        SET agency_hr_manager_user_id = p_agency_hr_manager_user_id,
            application_fee_coins = p_application_fee_coins,
            monthly_fee_coins = p_monthly_fee_coins,
            updated_at = NOW()
        WHERE id = v_settings.id
        RETURNING * INTO v_settings;
    ELSE
        INSERT INTO public.agency_platform_settings (
            agency_hr_manager_user_id,
            application_fee_coins,
            monthly_fee_coins
        )
        VALUES (
            p_agency_hr_manager_user_id,
            p_application_fee_coins,
            p_monthly_fee_coins
        )
        RETURNING * INTO v_settings;
    END IF;

    RETURN v_settings;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_agency_platform_settings()
RETURNS public.agency_platform_settings
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
    SELECT *
    FROM public.agency_platform_settings
    ORDER BY updated_at DESC
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.apply_for_agency_with_fee(
    p_name TEXT,
    p_bio TEXT DEFAULT NULL,
    p_default_split_percent INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_settings public.agency_platform_settings;
    v_application_fee INTEGER;
    v_monthly_fee INTEGER;
    v_total_fee INTEGER;
    v_balance INTEGER;
    v_agency_id UUID;
    v_application_id UUID;
    v_slug TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF btrim(COALESCE(p_name, '')) = '' THEN
        RAISE EXCEPTION 'Agency name is required';
    END IF;

    IF p_default_split_percent < 0 OR p_default_split_percent > 15 THEN
        RAISE EXCEPTION 'Default split must be between 0 and 15';
    END IF;

    SELECT *
    INTO v_settings
    FROM public.agency_platform_settings
    ORDER BY updated_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agency platform settings are not configured';
    END IF;

    v_application_fee := GREATEST(COALESCE(v_settings.application_fee_coins, 0), 25000);
    v_monthly_fee := GREATEST(COALESCE(v_settings.monthly_fee_coins, 0), 10000);
    v_total_fee := v_application_fee + v_monthly_fee;

    IF v_settings.agency_hr_manager_user_id IS NULL THEN
        RAISE EXCEPTION 'Agency HR Manager recipient account is not configured';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_settings.agency_hr_manager_user_id) THEN
        RAISE EXCEPTION 'Agency HR Manager recipient profile was not found';
    END IF;

    SELECT troll_coins
    INTO v_balance
    FROM public.user_profiles
    WHERE id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile was not found';
    END IF;

    IF v_total_fee > 0 AND COALESCE(v_balance, 0) < v_total_fee THEN
        RAISE EXCEPTION 'Insufficient Troll Coins to pay the agency startup and monthly fees';
    END IF;

    v_slug := trim(both '-' from lower(regexp_replace(COALESCE(p_name, 'agency'), '[^a-z0-9]+', '-', 'gi')));
    IF v_slug = '' THEN
        v_slug := 'agency';
    END IF;
    v_slug := v_slug || '-' || substring(md5(uuid_generate_v4()::text), 1, 8);

    INSERT INTO public.agencies (
        owner_id,
        name,
        slug,
        bio,
        status,
        default_split_percent,
        created_at,
        updated_at
    )
    VALUES (
        v_user_id,
        btrim(p_name),
        v_slug,
        nullif(btrim(COALESCE(p_bio, '')), ''),
        'pending',
        p_default_split_percent,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_agency_id;

    INSERT INTO public.agency_members (
        agency_id,
        user_id,
        role,
        status
    )
    VALUES (
        v_agency_id,
        v_user_id,
        'owner',
        'active'
    );

    IF v_total_fee > 0 THEN
        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_total_fee,
            total_spent_coins = COALESCE(total_spent_coins, 0) + v_total_fee
        WHERE id = v_user_id;

        UPDATE public.user_profiles
        SET troll_coins = troll_coins + v_total_fee,
            total_earned_coins = COALESCE(total_earned_coins, 0) + v_total_fee
        WHERE id = v_settings.agency_hr_manager_user_id;

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
            )
            VALUES (
                v_agency_id,
                'application_fee',
                v_application_fee,
                'paid',
                v_user_id,
                v_settings.agency_hr_manager_user_id,
                v_user_id,
                NOW(),
                jsonb_build_object(
                    'source', 'apply_for_agency_with_fee',
                    'note', 'Paid agency application fee'
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
            )
            VALUES (
                v_agency_id,
                'monthly_fee',
                v_monthly_fee,
                'paid',
                v_user_id,
                v_settings.agency_hr_manager_user_id,
                v_user_id,
                NOW(),
                jsonb_build_object(
                    'source', 'apply_for_agency_with_fee',
                    'note', 'Paid first monthly agency fee'
                )
            );

            UPDATE public.agencies
            SET last_monthly_fee_paid_at = NOW(),
                monthly_fee_status = 'paid'
            WHERE id = v_agency_id;
        END IF;
    END IF;

    INSERT INTO public.agency_applications (
        agency_id,
        applicant_id,
        message,
        content_type,
        status,
        application_fee_paid
    )
    VALUES (
        v_agency_id,
        v_user_id,
        'Paid agency application submission',
        'new_agency',
        'pending',
        v_application_fee > 0
    )
    RETURNING id INTO v_application_id;

    RETURN jsonb_build_object(
        'success', true,
        'agency_id', v_agency_id,
        'application_id', v_application_id,
        'application_fee_coins', v_application_fee,
        'monthly_fee_coins', v_monthly_fee,
        'total_fee_coins', v_total_fee,
        'agency_hr_manager_user_id', v_settings.agency_hr_manager_user_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_for_agency_from_family(
    p_family_id UUID,
    p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_settings public.agency_platform_settings;
    v_application_fee INTEGER;
    v_monthly_fee INTEGER;
    v_total_fee INTEGER;
    v_balance INTEGER;
    v_family RECORD;
    v_agency_id UUID;
    v_application_id UUID;
    v_slug TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT *
    INTO v_family
    FROM public.troll_families
    WHERE id = p_family_id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Family not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.troll_family_members
        WHERE family_id = p_family_id
          AND user_id = v_user_id
          AND lower(COALESCE(role, '')) IN ('leader', 'co-leader', 'co_leader')
    ) THEN
        RAISE EXCEPTION 'Only the family leader or co-leader can convert this family to an agency';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.agency_applications
        WHERE applicant_id = v_user_id
          AND content_type = 'family_conversion'
          AND status IN ('pending', 'approved')
    ) THEN
        RAISE EXCEPTION 'You already have a pending or approved family-to-agency conversion request';
    END IF;

    SELECT *
    INTO v_settings
    FROM public.agency_platform_settings
    ORDER BY updated_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agency platform settings are not configured';
    END IF;

    v_application_fee := GREATEST(COALESCE(v_settings.application_fee_coins, 0), 25000);
    v_monthly_fee := GREATEST(COALESCE(v_settings.monthly_fee_coins, 0), 10000);
    v_total_fee := v_application_fee + v_monthly_fee;

    IF v_settings.agency_hr_manager_user_id IS NULL THEN
        RAISE EXCEPTION 'Agency HR Manager recipient account is not configured';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_settings.agency_hr_manager_user_id) THEN
        RAISE EXCEPTION 'Agency HR Manager recipient profile was not found';
    END IF;

    SELECT troll_coins
    INTO v_balance
    FROM public.user_profiles
    WHERE id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile was not found';
    END IF;

    IF v_total_fee > 0 AND COALESCE(v_balance, 0) < v_total_fee THEN
        RAISE EXCEPTION 'Insufficient Troll Coins to pay the agency startup and monthly fees';
    END IF;

    v_slug := trim(both '-' from lower(regexp_replace(COALESCE(v_family.name, 'family'), '[^a-z0-9]+', '-', 'gi')));
    IF v_slug = '' THEN
        v_slug := 'family';
    END IF;
    v_slug := v_slug || '-' || substring(md5(uuid_generate_v4()::text), 1, 8);

    INSERT INTO public.agencies (
        owner_id,
        name,
        slug,
        bio,
        status,
        default_split_percent,
        created_at,
        updated_at
    )
    VALUES (
        v_user_id,
        COALESCE(v_family.name, 'Converted Family'),
        v_slug,
        COALESCE(v_family.description, NULL),
        'pending',
        10,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_agency_id;

    INSERT INTO public.agency_members (
        agency_id,
        user_id,
        role,
        status
    )
    VALUES (
        v_agency_id,
        v_user_id,
        'owner',
        'active'
    );

    IF v_total_fee > 0 THEN
        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_total_fee,
            total_spent_coins = COALESCE(total_spent_coins, 0) + v_total_fee
        WHERE id = v_user_id;

        UPDATE public.user_profiles
        SET troll_coins = troll_coins + v_total_fee,
            total_earned_coins = COALESCE(total_earned_coins, 0) + v_total_fee
        WHERE id = v_settings.agency_hr_manager_user_id;

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
            )
            VALUES (
                v_agency_id,
                'application_fee',
                v_application_fee,
                'paid',
                v_user_id,
                v_settings.agency_hr_manager_user_id,
                v_user_id,
                NOW(),
                jsonb_build_object(
                    'source', 'apply_for_agency_from_family',
                    'family_id', p_family_id,
                    'note', 'Paid family conversion application fee'
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
            )
            VALUES (
                v_agency_id,
                'monthly_fee',
                v_monthly_fee,
                'paid',
                v_user_id,
                v_settings.agency_hr_manager_user_id,
                v_user_id,
                NOW(),
                jsonb_build_object(
                    'source', 'apply_for_agency_from_family',
                    'family_id', p_family_id,
                    'note', 'Paid first monthly agency fee'
                )
            );

            UPDATE public.agencies
            SET last_monthly_fee_paid_at = NOW(),
                monthly_fee_status = 'paid'
            WHERE id = v_agency_id;
        END IF;
    END IF;

    INSERT INTO public.agency_applications (
        agency_id,
        applicant_id,
        message,
        content_type,
        status,
        application_fee_paid
    )
    VALUES (
        v_agency_id,
        v_user_id,
        COALESCE(nullif(btrim(p_message), ''), 'Family-to-agency conversion request'),
        'family_conversion',
        'pending',
        v_application_fee > 0
    )
    RETURNING id INTO v_application_id;

    RETURN jsonb_build_object(
        'success', true,
        'agency_id', v_agency_id,
        'application_id', v_application_id,
        'application_fee_coins', v_application_fee,
        'monthly_fee_coins', v_monthly_fee,
        'total_fee_coins', v_total_fee,
        'family_id', p_family_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_family_agency_conversion(
    p_application_id UUID,
    p_actor_id UUID,
    p_reason TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_app public.agency_applications;
    v_actor_role TEXT;
    v_actor_is_hr BOOLEAN;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
        RAISE EXCEPTION 'Authentication required for the requesting actor';
    END IF;

    SELECT a.*
    INTO v_app
    FROM public.agency_applications a
    WHERE a.id = p_application_id
      AND a.status = 'pending'
      AND a.content_type = 'family_conversion'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Family conversion request not found or already reviewed';
    END IF;

    SELECT lower(COALESCE(role, ''))
    INTO v_actor_role
    FROM public.user_profiles
    WHERE id = p_actor_id
    LIMIT 1;

    SELECT COALESCE((SELECT is_admin FROM public.user_profiles WHERE id = p_actor_id), false)
    INTO v_actor_is_hr;

    IF v_actor_is_hr IS NOT TRUE AND COALESCE(v_actor_role, '') NOT IN ('admin', 'agency hr manager', 'agency_hr_manager') THEN
        RAISE EXCEPTION 'You do not have permission to approve family conversion requests';
    END IF;

    UPDATE public.agency_applications
    SET status = 'approved',
        reviewed_by = p_actor_id,
        reviewed_at = NOW()
    WHERE id = p_application_id;

    UPDATE public.agencies
    SET status = 'approved',
        updated_at = NOW()
    WHERE id = v_app.agency_id;

    UPDATE public.agency_members
    SET role = 'creator',
        status = 'active',
        removed_at = NULL
    WHERE agency_id = v_app.agency_id
      AND user_id = v_app.applicant_id;

    IF NOT FOUND THEN
        INSERT INTO public.agency_members (
            agency_id,
            user_id,
            role,
            status
        )
        VALUES (
            v_app.agency_id,
            v_app.applicant_id,
            'creator',
            'active'
        );
    END IF;

    INSERT INTO public.agency_enforcement_actions (
        agency_id,
        actor_id,
        target_user_id,
        action_type,
        reason,
        metadata
    )
    VALUES (
        v_app.agency_id,
        p_actor_id,
        v_app.applicant_id,
        'application_approved',
        COALESCE(nullif(btrim(p_reason), ''), 'Family conversion approved'),
        jsonb_build_object('application_id', p_application_id, 'source', 'family_conversion')
    );

    INSERT INTO public.agency_activity_logs (
        agency_id,
        actor_id,
        target_user_id,
        action,
        metadata
    )
    VALUES (
        v_app.agency_id,
        p_actor_id,
        v_app.applicant_id,
        'family_conversion_approved',
        jsonb_build_object('application_id', p_application_id, 'reason', COALESCE(nullif(btrim(p_reason), ''), 'Family conversion approved'))
    );

    RETURN jsonb_build_object(
        'success', true,
        'application_id', p_application_id,
        'agency_id', v_app.agency_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_family_agency_conversion(
    p_application_id UUID,
    p_actor_id UUID,
    p_reason TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_app public.agency_applications;
    v_actor_role TEXT;
    v_actor_is_hr BOOLEAN;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_actor_id THEN
        RAISE EXCEPTION 'Authentication required for the requesting actor';
    END IF;

    SELECT a.*
    INTO v_app
    FROM public.agency_applications a
    WHERE a.id = p_application_id
      AND a.status = 'pending'
      AND a.content_type = 'family_conversion'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Family conversion request not found or already reviewed';
    END IF;

    SELECT lower(COALESCE(role, ''))
    INTO v_actor_role
    FROM public.user_profiles
    WHERE id = p_actor_id
    LIMIT 1;

    SELECT COALESCE((SELECT is_admin FROM public.user_profiles WHERE id = p_actor_id), false)
    INTO v_actor_is_hr;

    IF v_actor_is_hr IS NOT TRUE AND COALESCE(v_actor_role, '') NOT IN ('admin', 'agency hr manager', 'agency_hr_manager') THEN
        RAISE EXCEPTION 'You do not have permission to reject family conversion requests';
    END IF;

    UPDATE public.agency_applications
    SET status = 'denied',
        reviewed_by = p_actor_id,
        reviewed_at = NOW()
    WHERE id = p_application_id;

    INSERT INTO public.agency_enforcement_actions (
        agency_id,
        actor_id,
        target_user_id,
        action_type,
        reason,
        metadata
    )
    VALUES (
        v_app.agency_id,
        p_actor_id,
        v_app.applicant_id,
        'application_denied',
        COALESCE(nullif(btrim(p_reason), ''), 'Family conversion rejected'),
        jsonb_build_object('application_id', p_application_id, 'source', 'family_conversion')
    );

    INSERT INTO public.agency_activity_logs (
        agency_id,
        actor_id,
        target_user_id,
        action,
        metadata
    )
    VALUES (
        v_app.agency_id,
        p_actor_id,
        v_app.applicant_id,
        'family_conversion_rejected',
        jsonb_build_object('application_id', p_application_id, 'reason', COALESCE(nullif(btrim(p_reason), ''), 'Family conversion rejected'))
    );

    DELETE FROM public.agencies
    WHERE id = v_app.agency_id;

    RETURN jsonb_build_object(
        'success', true,
        'application_id', p_application_id,
        'agency_id', v_app.agency_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_agency_monthly_fee(
    p_agency_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_settings public.agency_platform_settings;
    v_fee INTEGER;
    v_balance INTEGER;
    v_agency RECORD;
    v_processed_count INTEGER := 0;
    v_user_role TEXT;
BEGIN
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT lower(COALESCE(role, ''))
    INTO v_user_role
    FROM public.user_profiles
    WHERE id = v_actor_id
    LIMIT 1;

    IF COALESCE((SELECT is_admin FROM public.user_profiles WHERE id = v_actor_id), false) IS NOT TRUE
       AND COALESCE(v_user_role, '') NOT IN ('admin', 'agency hr manager', 'agency_hr_manager') THEN
        RAISE EXCEPTION 'Only Agency HR Managers can process monthly agency fees';
    END IF;

    SELECT *
    INTO v_settings
    FROM public.agency_platform_settings
    ORDER BY updated_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agency platform settings are not configured';
    END IF;

    IF v_settings.agency_hr_manager_user_id IS NULL THEN
        RAISE EXCEPTION 'Agency HR Manager recipient account is not configured';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_settings.agency_hr_manager_user_id) THEN
        RAISE EXCEPTION 'Agency HR Manager recipient profile was not found';
    END IF;

    v_fee := GREATEST(COALESCE(v_settings.monthly_fee_coins, 0), 10000);

    FOR v_agency IN
        SELECT a.id, a.owner_id, a.status
        FROM public.agencies a
        WHERE a.status = 'approved'
          AND (p_agency_id IS NULL OR a.id = p_agency_id)
    LOOP
        SELECT troll_coins
        INTO v_balance
        FROM public.user_profiles
        WHERE id = v_agency.owner_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Agency owner profile was not found';
        END IF;

        IF COALESCE(v_balance, 0) < v_fee THEN
            UPDATE public.agencies
            SET monthly_fee_status = 'failed',
                updated_at = NOW()
            WHERE id = v_agency.id;

            INSERT INTO public.agency_billing_events (
                agency_id,
                billing_type,
                amount_coins,
                status,
                payer_user_id,
                recipient_user_id,
                created_by,
                metadata
            )
            VALUES (
                v_agency.id,
                'monthly_fee',
                v_fee,
                'failed',
                v_agency.owner_id,
                v_settings.agency_hr_manager_user_id,
                v_actor_id,
                jsonb_build_object('source', 'process_agency_monthly_fee', 'reason', 'Insufficient Troll Coins')
            );

            CONTINUE;
        END IF;

        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_fee,
            total_spent_coins = COALESCE(total_spent_coins, 0) + v_fee
        WHERE id = v_agency.owner_id;

        UPDATE public.user_profiles
        SET troll_coins = troll_coins + v_fee,
            total_earned_coins = COALESCE(total_earned_coins, 0) + v_fee
        WHERE id = v_settings.agency_hr_manager_user_id;

        UPDATE public.agencies
        SET last_monthly_fee_paid_at = NOW(),
            monthly_fee_status = 'paid',
            updated_at = NOW()
        WHERE id = v_agency.id;

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
        )
        VALUES (
            v_agency.id,
            'monthly_fee',
            v_fee,
            'paid',
            v_agency.owner_id,
            v_settings.agency_hr_manager_user_id,
            v_actor_id,
            NOW(),
            jsonb_build_object('source', 'process_agency_monthly_fee')
        );

        v_processed_count := v_processed_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'processed_count', v_processed_count,
        'monthly_fee_coins', v_fee
    );
END;
$$;

COMMIT;