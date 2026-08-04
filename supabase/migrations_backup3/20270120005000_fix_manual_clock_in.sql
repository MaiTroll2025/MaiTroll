-- Fix manual_clock_in to use user_profiles instead of profiles
CREATE OR REPLACE FUNCTION public.manual_clock_in(p_officer_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_active_session_id uuid;
BEGIN
    -- Check if officer already has an active session
    SELECT id INTO v_active_session_id
    FROM officer_work_sessions
    WHERE officer_id = p_officer_id 
    AND clock_out IS NULL 
    LIMIT 1;

    IF v_active_session_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Officer already has an active session');
    END IF;

    -- Create new session
    INSERT INTO officer_work_sessions (officer_id, clock_in, status)
    VALUES (p_officer_id, now(), 'active');

    -- Update officer status in user_profiles
    UPDATE user_profiles 
    SET is_officer_active = true,
        last_activity_at = now()
    WHERE id = p_officer_id;

    RETURN jsonb_build_object('success', true, 'message', 'Clocked in successfully');
END;
$$;
