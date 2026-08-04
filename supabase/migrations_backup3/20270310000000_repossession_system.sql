-- Repossession System Migration
-- Adds repossession fields to properties and vehicles tables
-- Creates functions for repossessing assets and issuing court summons

-- 1. Add repossession fields to properties table
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS is_repossessed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS repossessed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS repossessed_by UUID REFERENCES public.user_profiles(id);

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS repossession_reason TEXT;

-- 2. Add repossession fields to user_vehicles table
ALTER TABLE public.user_vehicles
ADD COLUMN IF NOT EXISTS is_repossessed BOOLEAN DEFAULT FALSE;

ALTER TABLE public.user_vehicles
ADD COLUMN IF NOT EXISTS repossessed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.user_vehicles
ADD COLUMN IF NOT EXISTS repossessed_by UUID REFERENCES public.user_profiles(id);

ALTER TABLE public.user_vehicles
ADD COLUMN IF NOT EXISTS repossession_reason TEXT;

-- 3. Create court_summons_loan_default table for instant summons related to loan defaults
CREATE TABLE IF NOT EXISTS public.loan_default_summons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id),
    vehicle_id UUID REFERENCES public.user_vehicles(id),
    summon_type TEXT NOT NULL DEFAULT 'property_repossession' CHECK (summon_type IN ('property_repossession', 'vehicle_repossession', 'loan_default_hearing')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'served', 'cancelled', 'resolved')),
    reason TEXT NOT NULL,
    amount_owed BIGINT DEFAULT 0,
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    served_at TIMESTAMP WITH TIME ZONE,
    court_date TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.loan_default_summons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage loan default summons"
    ON public.loan_default_summons
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true OR role = 'lead_troll_officer')
        )
    );

CREATE POLICY "Users can view their own summons"
    ON public.loan_default_summons
    FOR SELECT
    USING (user_id = auth.uid());

-- 4. Function to repossess a property
CREATE OR REPLACE FUNCTION public.repossess_property(
    p_property_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT 'Loan default - property repossessed'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_property RECORD;
    v_user_id UUID;
    v_loan RECORD;
    v_result JSON;
BEGIN
    -- Get property details
    SELECT * INTO v_property
    FROM public.properties
    WHERE id = p_property_id;

    IF v_property IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Property not found');
    END IF;

    IF v_property.is_repossessed THEN
        RETURN json_build_object('success', false, 'error', 'Property already repossessed');
    END IF;

    v_user_id := v_property.owner_user_id;

    -- Find any active loans for this user
    SELECT * INTO v_loan
    FROM public.loans
    WHERE user_id = v_user_id
    AND status = 'active'
    AND balance > 0
    ORDER BY created_at DESC
    LIMIT 1;

    -- Update property as repossessed
    UPDATE public.properties
    SET
        is_repossessed = true,
        repossessed_at = NOW(),
        repossessed_by = p_admin_id,
        repossession_reason = p_reason,
        owner_user_id = NULL, -- Remove ownership
        is_active_home = false
    WHERE id = p_property_id;

    -- Create instant court summon if loan exists
    IF v_loan IS NOT NULL THEN
        INSERT INTO public.loan_default_summons (
            user_id,
            loan_id,
            property_id,
            summon_type,
            status,
            reason,
            amount_owed,
            created_by,
            court_date
        ) VALUES (
            v_user_id,
            v_loan.id,
            p_property_id,
            'property_repossession',
            'pending',
            p_reason || ' - Amount owed: ' || v_loan.balance::TEXT,
            v_loan.balance,
            p_admin_id,
            NOW() + INTERVAL '24 hours' -- 24 hours to respond
        );
    END IF;

    -- Log the action
    INSERT INTO public.admin_action_logs (
        admin_id,
        action_type,
        target_id,
        details
    ) VALUES (
        p_admin_id,
        'property_repossession',
        p_property_id,
        json_build_object(
            'property_name', v_property.property_name,
            'previous_owner', v_user_id,
            'reason', p_reason,
            'loan_id', v_loan.id,
            'amount_owed', v_loan.balance
        )
    );

    RETURN json_build_object(
        'success', true,
        'property_id', p_property_id,
        'property_name', v_property.property_name,
        'repossessed', true,
        'summon_created', v_loan IS NOT NULL
    );
END;
$$;

-- 5. Function to repossess a vehicle
CREATE OR REPLACE FUNCTION public.repossess_vehicle(
    p_vehicle_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT 'Loan default - vehicle repossessed'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_vehicle RECORD;
    v_user_id UUID;
    v_loan RECORD;
BEGIN
    -- Get vehicle details
    SELECT uv.*, vc.name as vehicle_name INTO v_vehicle
    FROM public.user_vehicles uv
    JOIN public.vehicles_catalog vc ON uv.catalog_id = vc.id
    WHERE uv.id = p_vehicle_id;

    IF v_vehicle IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Vehicle not found');
    END IF;

    IF v_vehicle.is_repossessed THEN
        RETURN json_build_object('success', false, 'error', 'Vehicle already repossessed');
    END IF;

    v_user_id := v_vehicle.user_id;

    -- Find any active loans for this user
    SELECT * INTO v_loan
    FROM public.loans
    WHERE user_id = v_user_id
    AND status = 'active'
    AND balance > 0
    ORDER BY created_at DESC
    LIMIT 1;

    -- Update vehicle as repossessed
    UPDATE public.user_vehicles
    SET
        is_repossessed = true,
        repossessed_at = NOW(),
        repossessed_by = p_admin_id,
        repossession_reason = p_reason,
        user_id = NULL, -- Remove ownership
        is_active = false
    WHERE id = p_vehicle_id;

    -- Create instant court summon if loan exists
    IF v_loan IS NOT NULL THEN
        INSERT INTO public.loan_default_summons (
            user_id,
            loan_id,
            vehicle_id,
            summon_type,
            status,
            reason,
            amount_owed,
            created_by,
            court_date
        ) VALUES (
            v_user_id,
            v_loan.id,
            p_vehicle_id,
            'vehicle_repossession',
            'pending',
            p_reason || ' - Amount owed: ' || v_loan.balance::TEXT,
            v_loan.balance,
            p_admin_id,
            NOW() + INTERVAL '24 hours'
        );
    END IF;

    -- Log the action
    INSERT INTO public.admin_action_logs (
        admin_id,
        action_type,
        target_id,
        details
    ) VALUES (
        p_admin_id,
        'vehicle_repossession',
        p_vehicle_id,
        json_build_object(
            'vehicle_name', v_vehicle.vehicle_name,
            'previous_owner', v_user_id,
            'reason', p_reason,
            'loan_id', v_loan.id,
            'amount_owed', v_loan.balance
        )
    );

    RETURN json_build_object(
        'success', true,
        'vehicle_id', p_vehicle_id,
        'vehicle_name', v_vehicle.vehicle_name,
        'repossessed', true,
        'summon_created', v_loan IS NOT NULL
    );
END;
$$;

-- 6. Function to issue instant court summon for loan default hearing
CREATE OR REPLACE FUNCTION public.issue_loan_default_summon(
    p_user_id UUID,
    p_admin_id UUID,
    p_summon_type TEXT DEFAULT 'loan_default_hearing',
    p_reason TEXT DEFAULT 'Loan default - Court appearance required'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_loan RECORD;
    v_summon RECORD;
BEGIN
    -- Get active loan for user
    SELECT * INTO v_loan
    FROM public.loans
    WHERE user_id = p_user_id
    AND status = 'active'
    AND balance > 0
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_loan IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'No active loan found for user');
    END IF;

    -- Create court summon
    INSERT INTO public.loan_default_summons (
        user_id,
        loan_id,
        summon_type,
        status,
        reason,
        amount_owed,
        created_by,
        court_date
    ) VALUES (
        p_user_id,
        v_loan.id,
        p_summon_type,
        'pending',
        p_reason || ' - Total owed: ' || v_loan.balance::TEXT,
        v_loan.balance,
        p_admin_id,
        NOW() + INTERVAL '48 hours'
    )
    RETURNING * INTO v_summon;

    -- Update loan status to indicate legal action
    UPDATE public.loans
    SET status = 'legal_action'
    WHERE id = v_loan.id;

    -- Log the action
    INSERT INTO public.admin_action_logs (
        admin_id,
        action_type,
        target_id,
        details
    ) VALUES (
        p_admin_id,
        'loan_default_summon',
        v_loan.id,
        json_build_object(
            'user_id', p_user_id,
            'summon_type', p_summon_type,
            'reason', p_reason,
            'amount_owed', v_loan.balance,
            'summon_id', v_summon.id
        )
    );

    RETURN json_build_object(
        'success', true,
        'summon_id', v_summon.id,
        'user_id', p_user_id,
        'loan_id', v_loan.id,
        'amount_owed', v_loan.balance,
        'court_date', v_summon.court_date
    );
END;
$$;

-- 7. Function to restore repossessed asset (if loan is paid)
CREATE OR REPLACE FUNCTION public.restore_repossessed_asset(
    p_asset_id UUID,
    p_asset_type TEXT, -- 'property' or 'vehicle'
    p_user_id UUID,
    p_admin_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    IF p_asset_type = 'property' THEN
        UPDATE public.properties
        SET
            is_repossessed = false,
            repossessed_at = NULL,
            repossessed_by = NULL,
            repossession_reason = NULL,
            owner_user_id = p_user_id
        WHERE id = p_asset_id;

        SELECT json_build_object(
            'success', true,
            'asset_type', 'property',
            'asset_id', p_asset_id,
            'restored', true
        ) INTO v_result;

    ELSIF p_asset_type = 'vehicle' THEN
        UPDATE public.user_vehicles
        SET
            is_repossessed = false,
            repossessed_at = NULL,
            repossessed_by = NULL,
            repossession_reason = NULL,
            user_id = p_user_id
        WHERE id = p_asset_id;

        SELECT json_build_object(
            'success', true,
            'asset_type', 'vehicle',
            'asset_id', p_asset_id,
            'restored', true
        ) INTO v_result;
    ELSE
        SELECT json_build_object('success', false, 'error', 'Invalid asset type') INTO v_result;
    END IF;

    -- Log the restoration
    INSERT INTO public.admin_action_logs (
        admin_id,
        action_type,
        target_id,
        details
    ) VALUES (
        p_admin_id,
        'restore_repossessed_asset',
        p_asset_id,
        json_build_object(
            'asset_type', p_asset_type,
            'user_id', p_user_id,
            'restored', true
        )
    );

    RETURN v_result;
END;
$$;

-- 8. Function to get users with delinquent loans (for repossession list)
CREATE OR REPLACE FUNCTION public.get_delinquent_loan_users()
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    total_balance BIGINT,
    days_overdue INTEGER,
    owned_properties JSONB,
    owned_vehicles JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.user_id,
        up.username,
        SUM(l.balance) as total_balance,
        EXTRACT(DAY FROM (NOW() - l.created_at))::INTEGER as days_overdue,
        (
            SELECT json_agg(json_build_object(
                'id', p.id,
                'name', p.property_name,
                'is_repossessed', p.is_repossessed
            ))
            FROM public.properties p
            WHERE p.owner_user_id = l.user_id
            AND p.is_repossessed = false
        ) as owned_properties,
        (
            SELECT json_agg(json_build_object(
                'id', uv.id,
                'name', vc.name,
                'is_repossessed', uv.is_repossessed
            ))
            FROM public.user_vehicles uv
            JOIN public.vehicles_catalog vc ON uv.catalog_id = vc.id
            WHERE uv.user_id = l.user_id
            AND uv.is_repossessed = false
        ) as owned_vehicles
    FROM public.loans l
    JOIN public.user_profiles up ON l.user_id = up.id
    WHERE l.status = 'active'
    AND l.balance > 0
    GROUP BY l.user_id, up.username, l.created_at
    ORDER BY total_balance DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.repossess_property(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repossess_vehicle(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_loan_default_summon(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_repossessed_asset(UUID, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delinquent_loan_users() TO authenticated;
