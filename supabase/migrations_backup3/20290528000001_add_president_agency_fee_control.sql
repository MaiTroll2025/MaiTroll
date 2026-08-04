BEGIN;

-- Create agency_fee_settings table for president-controlled agency fee rules
CREATE TABLE IF NOT EXISTS public.agency_fee_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    value_type TEXT NOT NULL,
    description TEXT,
    updated_by UUID,
    updated_by_role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create agency_fee_setting_audit_logs table for tracking changes
CREATE TABLE IF NOT EXISTS public.agency_fee_setting_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB NOT NULL,
    changed_by UUID NOT NULL,
    changed_by_role TEXT NOT NULL,
    reason TEXT,
    effective_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default agency fee settings
INSERT INTO public.agency_fee_settings (setting_key, setting_value, value_type, description) VALUES
    ('default_agency_split_percent', '10', 'integer', 'Default agency split percent'),
    ('max_agency_split_percent', '15', 'integer', 'Maximum agency split percent'),
    ('min_agency_split_percent', '0', 'integer', 'Minimum agency split percent'),
    ('default_agency_hr_manager_fee_percent', '5', 'integer', 'Default agency HR manager fee percent'),
    ('max_agency_hr_manager_fee_percent', '5', 'integer', 'Maximum agency HR manager fee percent'),
    ('agency_application_fee_enabled', 'false', 'boolean', 'Enable agency application fee'),
    ('agency_application_fee_coins', '0', 'integer', 'Agency application fee in coins'),
    ('agency_approval_fee_enabled', 'false', 'boolean', 'Enable agency approval fee'),
    ('agency_approval_fee_coins', '0', 'integer', 'Agency approval fee in coins'),
    ('agency_monthly_operating_fee_enabled', 'false', 'boolean', 'Enable agency monthly operating fee'),
    ('agency_monthly_operating_fee_coins', '0', 'integer', 'Agency monthly operating fee in coins'),
    ('agency_cashout_fee_enabled', 'true', 'boolean', 'Enable agency cashout fee'),
    ('agency_cashout_fee_coins', '300', 'integer', 'Agency cashout fee in coins'),
    ('qualified_broadcaster_reward_coins', '100', 'integer', 'Qualified broadcaster reward in coins'),
    ('gift_milestone_1000_reward_coins', '200', 'integer', 'Gift milestone 1000 reward in coins'),
    ('agency_role_bail_1st_offense_coins', '1000', 'integer', 'Agency role bail for 1st offense'),
    ('agency_role_bail_2nd_offense_coins', '2500', 'integer', 'Agency role bail for 2nd offense'),
    ('agency_role_bail_3rd_offense_coins', '3500', 'integer', 'Agency role bail for 3rd offense'),
    ('agency_role_bail_4th_offense_coins', '7500', 'integer', 'Agency role bail for 4th offense'),
    ('agency_role_bail_5th_offense_coins', '10000', 'integer', 'Agency role bail for 5th offense'),
    ('agency_role_bail_6th_offense_coins', '15000', 'integer', 'Agency role bail for 6th offense'),
    ('agency_role_bail_7th_offense_requires_admin_review', 'true', 'boolean', '7th offense requires admin review'),
    ('friday_payout_fee_enabled', 'true', 'boolean', 'Enable friday payout fee'),
    ('thursday_agency_settlement_enabled', 'true', 'boolean', 'Enable thursday agency settlement')
ON CONFLICT (setting_key) DO NOTHING;

-- Create function to check if user is president
CREATE OR REPLACE FUNCTION public.is_president(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = user_id AND (role = 'president' OR badge = 'president')
    );
$$;

-- Create function to check if user can manage agency fee settings
CREATE OR REPLACE FUNCTION public.can_manage_agency_fee_settings(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
    SELECT 
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = user_id AND (role = 'president' OR badge = 'president')
        ) OR
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = user_id AND (role IN ('admin', 'owner', 'ceo') OR is_admin = true)
        );
$$;

-- Create function to get active agency fee settings
CREATE OR REPLACE FUNCTION public.get_active_agency_fee_settings()
RETURNS TABLE (
    setting_key TEXT,
    setting_value JSONB,
    value_type TEXT,
    description TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
    SELECT setting_key, setting_value, value_type, description
    FROM public.agency_fee_settings
    ORDER BY setting_key;
$$;

-- Create function to update agency fee setting with audit logging
CREATE OR REPLACE FUNCTION public.update_agency_fee_setting(
    p_setting_key TEXT,
    p_setting_value JSONB,
    p_reason TEXT DEFAULT NULL,
    p_effective_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.agency_fee_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role TEXT;
    v_old_setting public.agency_fee_settings%ROWTYPE;
    v_new_setting public.agency_fee_settings%ROWTYPE;
    v_setting_record public.agency_fee_settings%ROWTYPE;
    v_is_president BOOLEAN;
    v_can_manage BOOLEAN;
BEGIN
    -- Check authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Get user role
    SELECT lower(COALESCE(role, ''))
    INTO v_user_role
    FROM public.user_profiles
    WHERE id = v_user_id
    LIMIT 1;

    -- Check permissions
    v_is_president := public.is_president(v_user_id);
    v_can_manage := public.can_manage_agency_fee_settings(v_user_id);

    IF NOT v_can_manage THEN
        RAISE EXCEPTION 'Insufficient permissions to update agency fee settings';
    END IF;

    -- Get existing setting
    SELECT *
    INTO v_old_setting
    FROM public.agency_fee_settings
    WHERE setting_key = p_setting_key
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Setting % does not exist', p_setting_key;
    END IF;

    -- Validate setting based on key
    IF p_setting_key IN (
        'default_agency_split_percent',
        'max_agency_split_percent',
        'min_agency_split_percent',
        'default_agency_hr_manager_fee_percent',
        'max_agency_hr_manager_fee_percent',
        'agency_application_fee_coins',
        'agency_approval_fee_coins',
        'agency_monthly_operating_fee_coins',
        'agency_cashout_fee_coins',
        'qualified_broadcaster_reward_coins',
        'gift_milestone_1000_reward_coins',
        'agency_role_bail_1st_offense_coins',
        'agency_role_bail_2nd_offense_coins',
        'agency_role_bail_3rd_offense_coins',
        'agency_role_bail_4th_offense_coins',
        'agency_role_bail_5th_offense_coins',
        'agency_role_bail_6th_offense_coins'
    ) THEN
        -- Validate integer values
        IF p_setting_value->>0 IS NULL THEN
            RAISE EXCEPTION 'Setting % must be an integer', p_setting_key;
        END IF;
    ELSIF p_setting_key IN (
        'agency_application_fee_enabled',
        'agency_approval_fee_enabled',
        'agency_monthly_operating_fee_enabled',
        'agency_cashout_fee_enabled',
        'agency_role_bail_7th_offense_requires_admin_review',
        'friday_payout_fee_enabled',
        'thursday_agency_settlement_enabled'
    ) THEN
        -- Validate boolean values
        IF p_setting_value->>0 NOT IN ('true', 'false') THEN
            RAISE EXCEPTION 'Setting % must be a boolean', p_setting_key;
        END IF;
    END IF;

    -- Additional validation for president role (cannot exceed admin-defined caps)
    IF v_is_president AND NOT v_user_role IN ('admin', 'owner', 'ceo') AND NOT (SELECT is_admin FROM public.user_profiles WHERE id = v_user_id) THEN
        -- President cannot exceed max values set by admins
        IF p_setting_key = 'default_agency_split_percent' THEN
            DECLARE v_max_split INTEGER;
            BEGIN
                SELECT (setting_value->>0)::INTEGER INTO v_max_split
                FROM public.agency_fee_settings
                WHERE setting_key = 'max_agency_split_percent';

                IF (p_setting_value->>0)::INTEGER > v_max_split THEN
                    RAISE EXCEPTION 'President cannot set default split above maximum split (%)', v_max_split;
                END IF;
            END;
        ELSIF p_setting_key = 'max_agency_split_percent' THEN
            -- President can increase max but only up to admin-defined absolute limits
            -- For now, we'll allow president to set max up to a reasonable limit
            -- In a real system, this would be checked against admin-defined absolute caps
            NULL; -- Placeholder for admin cap validation
        ELSIF p_setting_key = 'default_agency_hr_manager_fee_percent' THEN
            DECLARE v_max_hr_fee INTEGER;
            BEGIN
                SELECT (setting_value->>0)::INTEGER INTO v_max_hr_fee
                FROM public.agency_fee_settings
                WHERE setting_key = 'max_agency_hr_manager_fee_percent';

                IF (p_setting_value->>0)::INTEGER > v_max_hr_fee THEN
                    RAISE EXCEPTION 'President cannot set HR fee above maximum HR fee (%)', v_max_hr_fee;
                END IF;
            END;
        ELSIF p_setting_key = 'max_agency_hr_manager_fee_percent' THEN
            -- Similar to above, would check against admin-defined absolute cap
            NULL;
        END IF;
    END IF;

    -- Update the setting
    UPDATE public.agency_fee_settings
    SET setting_value = p_setting_value,
        updated_by = v_user_id,
        updated_by_role = COALESCE(v_user_role, 
            CASE WHEN (SELECT is_admin FROM public.user_profiles WHERE id = v_user_id) THEN 'admin'
                 ELSE v_user_role END),
        updated_at = NOW()
    WHERE setting_key = p_setting_key
    RETURNING * INTO v_new_setting;

    -- Create audit log entry
    INSERT INTO public.agency_fee_setting_audit_logs (
        setting_key,
        old_value,
        new_value,
        changed_by,
        changed_by_role,
        reason,
        effective_at
    ) VALUES (
        p_setting_key,
        v_old_setting.setting_value,
        v_new_setting.setting_value,
        v_user_id,
        COALESCE(v_user_role, 
            CASE WHEN (SELECT is_admin FROM public.user_profiles WHERE id = v_user_id) THEN 'admin'
                 ELSE v_user_role END),
        p_reason,
        p_effective_at
    );

    RETURN v_new_setting;
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agency_fee_settings_key ON public.agency_fee_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_agency_fee_setting_audit_logs_setting_key ON public.agency_fee_setting_audit_logs(setting_key);
CREATE INDEX IF NOT EXISTS idx_agency_fee_setting_audit_logs_changed_by ON public.agency_fee_setting_audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_agency_fee_setting_audit_logs_created_at ON public.agency_fee_setting_audit_logs(created_at DESC);

COMMIT;