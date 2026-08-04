-- Agency enforcement and audit infrastructure
BEGIN;

CREATE TABLE IF NOT EXISTS public.agency_enforcement_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (
        action_type IN (
            'application_approved',
            'application_denied',
            'member_suspended',
            'member_removed',
            'member_restored'
        )
    ),
    reason TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agency_feature_flags (
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    flag_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (agency_id, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_agency_enforcement_actions_agency_id
    ON public.agency_enforcement_actions (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agency_enforcement_actions_actor_id
    ON public.agency_enforcement_actions (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agency_enforcement_actions_target_user_id
    ON public.agency_enforcement_actions (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agency_feature_flags_agency_id
    ON public.agency_feature_flags (agency_id);

ALTER TABLE public.agency_enforcement_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency owners and managers can view agency enforcement actions"
    ON public.agency_enforcement_actions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.agencies
            WHERE id = agency_enforcement_actions.agency_id
              AND owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1
            FROM public.agency_members
            WHERE agency_id = agency_enforcement_actions.agency_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'manager')
              AND status = 'active'
        )
    );

CREATE POLICY "System can create agency enforcement actions"
    ON public.agency_enforcement_actions
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Agency owners and managers can manage agency feature flags"
    ON public.agency_feature_flags
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.agencies
            WHERE id = agency_feature_flags.agency_id
              AND owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1
            FROM public.agency_members
            WHERE agency_id = agency_feature_flags.agency_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'manager')
              AND status = 'active'
        )
    );

CREATE POLICY "System can create agency feature flags"
    ON public.agency_feature_flags
    FOR INSERT
    WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_agency_feature_flag(
    p_agency_id UUID,
    p_flag_key TEXT,
    p_enabled BOOLEAN
)
RETURNS public.agency_feature_flags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_flag public.agency_feature_flags;
BEGIN
    SELECT *
    INTO v_flag
    FROM public.agency_feature_flags
    WHERE agency_id = p_agency_id
      AND flag_key = p_flag_key;

    IF FOUND THEN
        UPDATE public.agency_feature_flags
        SET enabled = p_enabled,
            updated_at = NOW()
        WHERE agency_id = p_agency_id
          AND flag_key = p_flag_key
        RETURNING *
        INTO v_flag;
    ELSE
        INSERT INTO public.agency_feature_flags (agency_id, flag_key, enabled)
        VALUES (p_agency_id, p_flag_key, p_enabled)
        RETURNING *
        INTO v_flag;
    END IF;

    RETURN v_flag;
END;
$$;

CREATE OR REPLACE FUNCTION public.manage_agency_member(
    p_member_id UUID,
    p_actor_id UUID,
    p_action TEXT,
    p_reason TEXT DEFAULT ''
)
RETURNS public.agency_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_member public.agency_members;
    v_actor_role TEXT;
BEGIN
    SELECT m.*
    INTO v_member
    FROM public.agency_members m
    WHERE m.id = p_member_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agency membership not found';
    END IF;

    SELECT role
    INTO v_actor_role
    FROM public.agency_members
    WHERE agency_id = v_member.agency_id
      AND user_id = p_actor_id
      AND status = 'active'
    LIMIT 1;

    IF v_actor_role IS NULL THEN
        RAISE EXCEPTION 'You do not have permission to manage this agency';
    END IF;

    IF v_member.role = 'owner' THEN
        RAISE EXCEPTION 'You cannot manage the agency owner';
    END IF;

    IF v_actor_role = 'manager' AND v_member.role = 'manager' THEN
        RAISE EXCEPTION 'Managers cannot manage other managers';
    END IF;

    IF p_action NOT IN ('suspend', 'remove', 'restore') THEN
        RAISE EXCEPTION 'Unsupported action %', p_action;
    END IF;

    CASE p_action
        WHEN 'suspend' THEN
            UPDATE public.agency_members
            SET status = 'suspended', removed_at = NULL
            WHERE id = p_member_id
            RETURNING *
            INTO v_member;

            INSERT INTO public.agency_enforcement_actions (
                agency_id,
                actor_id,
                target_user_id,
                action_type,
                reason,
                metadata
            )
            VALUES (
                v_member.agency_id,
                p_actor_id,
                v_member.user_id,
                'member_suspended',
                p_reason,
                jsonb_build_object('member_id', p_member_id, 'action', p_action)
            );

        WHEN 'remove' THEN
            UPDATE public.agency_members
            SET status = 'removed', removed_at = NOW()
            WHERE id = p_member_id
            RETURNING *
            INTO v_member;

            INSERT INTO public.agency_enforcement_actions (
                agency_id,
                actor_id,
                target_user_id,
                action_type,
                reason,
                metadata
            )
            VALUES (
                v_member.agency_id,
                p_actor_id,
                v_member.user_id,
                'member_removed',
                p_reason,
                jsonb_build_object('member_id', p_member_id, 'action', p_action)
            );

        WHEN 'restore' THEN
            UPDATE public.agency_members
            SET status = 'active', removed_at = NULL
            WHERE id = p_member_id
            RETURNING *
            INTO v_member;

            INSERT INTO public.agency_enforcement_actions (
                agency_id,
                actor_id,
                target_user_id,
                action_type,
                reason,
                metadata
            )
            VALUES (
                v_member.agency_id,
                p_actor_id,
                v_member.user_id,
                'member_restored',
                p_reason,
                jsonb_build_object('member_id', p_member_id, 'action', p_action)
            );
    END CASE;

    INSERT INTO public.agency_activity_logs (
        agency_id,
        actor_id,
        target_user_id,
        action,
        metadata
    )
    VALUES (
        v_member.agency_id,
        p_actor_id,
        v_member.user_id,
        'agency_member_' || p_action,
        jsonb_build_object('member_id', p_member_id, 'reason', p_reason)
    );

    RETURN v_member;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_agency_application(
    p_application_id UUID,
    p_actor_id UUID,
    p_reason TEXT DEFAULT ''
)
RETURNS public.agency_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_application public.agency_applications;
    v_actor_role TEXT;
BEGIN
    SELECT a.*
    INTO v_application
    FROM public.agency_applications a
    WHERE a.id = p_application_id
      AND a.status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found or already reviewed';
    END IF;

    -- CHECK APPLICATION FEE PAYMENT - NEW REQUIREMENT
    IF EXISTS (
        SELECT 1
        FROM public.agency_applications
        WHERE id = p_application_id
          AND coalesce(application_fee_paid, false) = false
    ) THEN
        RAISE EXCEPTION 'Agency application fee has not been paid';
    END IF;

    SELECT role
    INTO v_actor_role
    FROM public.agency_members
    WHERE agency_id = v_application.agency_id
      AND user_id = p_actor_id
      AND status = 'active'
    LIMIT 1;

    IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'manager') THEN
        RAISE EXCEPTION 'You do not have permission to approve agency applications';
    END IF;

    UPDATE public.agency_applications
    SET status = 'approved',
        reviewed_by = p_actor_id,
        reviewed_at = NOW()
    WHERE id = p_application_id
    RETURNING *
    INTO v_application;

    UPDATE public.agency_members
    SET role = 'creator',
        status = 'active',
        removed_at = NULL
    WHERE agency_id = v_application.agency_id
      AND user_id = v_application.applicant_id;

    IF NOT FOUND THEN
        INSERT INTO public.agency_members (
            agency_id,
            user_id,
            role,
            status
        )
        VALUES (
            v_application.agency_id,
            v_application.applicant_id,
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
        v_application.agency_id,
        p_actor_id,
        v_application.applicant_id,
        'application_approved',
        p_reason,
        jsonb_build_object('application_id', p_application_id)
    );

    INSERT INTO public.agency_activity_logs (
        agency_id,
        actor_id,
        target_user_id,
        action,
        metadata
    )
    VALUES (
        v_application.agency_id,
        p_actor_id,
        v_application.applicant_id,
        'application_approved',
        jsonb_build_object('application_id', p_application_id, 'reason', p_reason)
    );

    RETURN v_application;
END;
$$;

CREATE OR REPLACE FUNCTION public.deny_agency_application(
    p_application_id UUID,
    p_actor_id UUID,
    p_reason TEXT DEFAULT ''
)
RETURNS public.agency_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_application public.agency_applications;
    v_actor_role TEXT;
BEGIN
    SELECT a.*
    INTO v_application
    FROM public.agency_applications a
    WHERE a.id = p_application_id
      AND a.status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found or already reviewed';
    END IF;

    SELECT role
    INTO v_actor_role
    FROM public.agency_members
    WHERE agency_id = v_application.agency_id
      AND user_id = p_actor_id
      AND status = 'active'
    LIMIT 1;

    IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'manager') THEN
        RAISE EXCEPTION 'You do not have permission to deny agency applications';
    END IF;

    UPDATE public.agency_applications
    SET status = 'denied',
        reviewed_by = p_actor_id,
        reviewed_at = NOW()
    WHERE id = p_application_id
    RETURNING *
    INTO v_application;

    INSERT INTO public.agency_enforcement_actions (
        agency_id,
        actor_id,
        target_user_id,
        action_type,
        reason,
        metadata
    )
    VALUES (
        v_application.agency_id,
        p_actor_id,
        v_application.applicant_id,
        'application_denied',
        p_reason,
        jsonb_build_object('application_id', p_application_id)
    );

    INSERT INTO public.agency_activity_logs (
        agency_id,
        actor_id,
        target_user_id,
        action,
        metadata
    )
    VALUES (
        v_application.agency_id,
        p_actor_id,
        v_application.applicant_id,
        'application_denied',
        jsonb_build_object('application_id', p_application_id, 'reason', p_reason)
    );

    RETURN v_application;
END;
$$;

COMMENT ON TABLE public.agency_enforcement_actions IS 'Agency enforcement audit trail for member and application actions';
COMMENT ON TABLE public.agency_feature_flags IS 'Per-agency feature flags for rollout and compliance controls';

COMMIT;
