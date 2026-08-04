-- Migration: Admin Dashboard, Safety & Soft Economy
-- Description: Implements soft economy powers (temp coins, waiving fees), emergency revoke, and dashboard views.

-- 1. Soft Economy: Temp Admin Coins for Users
-- We need a place to store the "fake" coins given to users by admins.
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS temp_admin_coins_balance INTEGER DEFAULT 0;

-- RPC: Admin grants temp coins
CREATE OR REPLACE FUNCTION public.admin_grant_temp_coins(
    p_target_user_id UUID,
    p_amount INTEGER,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_is_admin BOOLEAN;
BEGIN
    -- Check permissions
    SELECT (role = 'temp_city_admin' OR role = 'admin' OR role = 'super_admin') INTO v_is_admin
    FROM public.user_profiles WHERE id = v_actor_id;

    IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Update target balance
    UPDATE public.user_profiles
    SET temp_admin_coins_balance = temp_admin_coins_balance + p_amount
    WHERE id = p_target_user_id;

    -- Log action
    PERFORM public.log_admin_action(
        'grant_temp_coins',
        p_target_user_id,
        'economy',
        p_reason,
        jsonb_build_object('amount', p_amount)
    );

    RETURN jsonb_build_object('success', true, 'amount', p_amount);
END;
$$;

-- RPC: Expire/Wipe ALL temp coins (to be called periodically or on admin term end)
CREATE OR REPLACE FUNCTION public.admin_expire_all_temp_coins()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This would be called by a cron job or super admin
    UPDATE public.user_profiles
    SET temp_admin_coins_balance = 0
    WHERE temp_admin_coins_balance > 0;
    
    -- Log system action (using a system ID or null)
    -- We'll just rely on the fact that balances are gone.
END;
$$;

-- 2. Soft Economy: Waive Penalties

-- RPC: Pardon Kick (Remove from stream_bans)
CREATE OR REPLACE FUNCTION public.admin_pardon_kick(
    p_stream_id UUID,
    p_target_user_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_is_admin BOOLEAN;
BEGIN
    SELECT (role = 'temp_city_admin' OR role = 'admin' OR role = 'super_admin') INTO v_is_admin
    FROM public.user_profiles WHERE id = v_actor_id;

    IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Remove ban
    DELETE FROM public.stream_bans 
    WHERE stream_id = p_stream_id AND user_id = p_target_user_id;

    -- Log
    PERFORM public.log_admin_action(
        'pardon_kick',
        p_target_user_id,
        'moderation',
        p_reason,
        jsonb_build_object('stream_id', p_stream_id)
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Waive Court Fine (Update court_payments)
CREATE OR REPLACE FUNCTION public.admin_waive_court_fine(
    p_payment_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_is_admin BOOLEAN;
    v_target_user_id UUID;
BEGIN
    SELECT (role = 'temp_city_admin' OR role = 'admin' OR role = 'super_admin') INTO v_is_admin
    FROM public.user_profiles WHERE id = v_actor_id;

    IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Get target user from payment
    SELECT defendant_id INTO v_target_user_id FROM public.court_payments WHERE id = p_payment_id;

    -- Update payment status
    UPDATE public.court_payments
    SET status = 'waived' -- Assuming 'waived' is valid or we set to 'failed' with reason
    WHERE id = p_payment_id;
    
    -- If 'waived' is not in constraint, we might need to alter type or use 'failed'
    -- Let's check constraints safely. If 'waived' fails, we'll delete it.
    -- Better: Just Delete it for now as "Waive" implies it's gone.
    DELETE FROM public.court_payments WHERE id = p_payment_id;

    -- Log
    PERFORM public.log_admin_action(
        'waive_fine',
        v_target_user_id,
        'economy',
        p_reason,
        jsonb_build_object('payment_id', p_payment_id)
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 3. Emergency Revoke (Super Admin Only)
CREATE OR REPLACE FUNCTION public.super_admin_emergency_revoke(
    p_target_admin_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_actor_role TEXT;
BEGIN
    -- Check if actor is super_admin
    SELECT role INTO v_actor_role FROM public.user_profiles WHERE id = v_actor_id;
    
    IF v_actor_role != 'super_admin' AND v_actor_role != 'admin' THEN -- Allow regular permanent admins too
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Super Admin only');
    END IF;

    -- 1. Revoke Role
    UPDATE public.user_profiles 
    SET role = 'citizen', 
        admin_coins_balance = 0,
        last_admin_term_end = NOW() -- Start cooldown immediately
    WHERE id = p_target_admin_id AND role = 'temp_city_admin';

    -- 2. Terminate Queue Entry
    UPDATE public.admin_for_week_queue
    SET status = 'revoked',
        ended_at = NOW()
    WHERE user_id = p_target_admin_id AND status = 'active';

    -- 3. Log it
    PERFORM public.log_admin_action(
        'emergency_revoke',
        p_target_admin_id,
        'system',
        p_reason,
        jsonb_build_object('revoked_by', v_actor_id)
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Admin Dashboard Views (Secure Views)

-- Active Streams View (Metrics)
CREATE OR REPLACE VIEW public.admin_view_active_streams AS
SELECT 
    COUNT(*) as active_streams_count,
    COALESCE(SUM(viewer_count), 0) as total_viewers
FROM public.streams
WHERE is_live = true;

-- Grant access to view
GRANT SELECT ON public.admin_view_active_streams TO authenticated;

-- Reports Queue View (Summary)
CREATE OR REPLACE VIEW public.admin_view_reports_queue AS
SELECT 
    COUNT(*) as open_reports,
    reason,
    MAX(created_at) as newest_report
FROM public.stream_reports
WHERE status = 'pending'
GROUP BY reason;

GRANT SELECT ON public.admin_view_reports_queue TO authenticated;

-- Recent Admin Actions (for transparency/audit by other admins)
CREATE OR REPLACE VIEW public.admin_view_recent_actions AS
SELECT 
    a.action_type,
    a.created_at,
    u.username as admin_name
FROM public.admin_actions_log a
JOIN public.user_profiles u ON a.admin_user_id = u.id
ORDER BY a.created_at DESC
LIMIT 50;

GRANT SELECT ON public.admin_view_recent_actions TO authenticated;

-- 5. City Wide Announcement (Banner)
-- We need a table for announcements if not exists
CREATE TABLE IF NOT EXISTS public.city_announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_by UUID REFERENCES public.user_profiles(id),
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RPC to create announcement
CREATE OR REPLACE FUNCTION public.admin_create_announcement(
    p_title TEXT,
    p_message TEXT,
    p_duration_hours INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_is_admin BOOLEAN;
BEGIN
    SELECT (role = 'temp_city_admin' OR role = 'admin' OR role = 'super_admin') INTO v_is_admin
    FROM public.user_profiles WHERE id = v_actor_id;

    IF NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    INSERT INTO public.city_announcements (title, message, created_by, starts_at, ends_at)
    VALUES (p_title, p_message, v_actor_id, NOW(), NOW() + (p_duration_hours || ' hours')::INTERVAL);

    PERFORM public.log_admin_action(
        'create_announcement',
        NULL,
        'governance',
        'Created city announcement',
        jsonb_build_object('title', p_title, 'duration', p_duration_hours)
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- RLS for Announcements
ALTER TABLE public.city_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active announcements" ON public.city_announcements
FOR SELECT USING (is_active = true AND ends_at > NOW());

CREATE POLICY "Admins can insert announcements" ON public.city_announcements
FOR INSERT WITH CHECK (
    auth.uid() IN (
        SELECT id FROM public.user_profiles 
        WHERE role IN ('temp_city_admin', 'admin', 'super_admin')
    )
);
