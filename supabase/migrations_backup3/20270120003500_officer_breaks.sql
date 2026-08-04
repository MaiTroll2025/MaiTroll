-- Add break tracking to officer_work_sessions
ALTER TABLE public.officer_work_sessions
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'break', 'completed')),
ADD COLUMN IF NOT EXISTS last_break_start timestamptz,
ADD COLUMN IF NOT EXISTS total_break_minutes integer DEFAULT 0;

-- RPC: Start Break
CREATE OR REPLACE FUNCTION public.manual_start_break(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session public.officer_work_sessions%rowtype;
BEGIN
    SELECT * INTO v_session FROM public.officer_work_sessions WHERE id = p_session_id;
    
    IF v_session.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Session not found');
    END IF;

    IF v_session.status = 'break' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Already on break');
    END IF;
    
    IF v_session.clock_out IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Session already ended');
    END IF;

    UPDATE public.officer_work_sessions
    SET status = 'break',
        last_break_start = now()
    WHERE id = p_session_id;

    RETURN jsonb_build_object('success', true, 'message', 'Break started');
END;
$$;

-- RPC: End Break
CREATE OR REPLACE FUNCTION public.manual_end_break(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session public.officer_work_sessions%rowtype;
    v_minutes int;
BEGIN
    SELECT * INTO v_session FROM public.officer_work_sessions WHERE id = p_session_id;
    
    IF v_session.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Session not found');
    END IF;

    IF v_session.status != 'break' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not on break');
    END IF;

    -- Calculate minutes
    v_minutes := EXTRACT(EPOCH FROM (now() - v_session.last_break_start)) / 60;

    UPDATE public.officer_work_sessions
    SET status = 'active',
        last_break_start = NULL,
        total_break_minutes = COALESCE(total_break_minutes, 0) + v_minutes
    WHERE id = p_session_id;

    RETURN jsonb_build_object('success', true, 'message', 'Break ended', 'minutes', v_minutes);
END;
$$;

-- Update manual_clock_out to handle open breaks
CREATE OR REPLACE FUNCTION public.manual_clock_out(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session public.officer_work_sessions%rowtype;
    v_now timestamptz := now();
    v_hours numeric;
    v_coins bigint;
    v_hourly_rate bigint := 500;
    v_break_minutes int := 0;
BEGIN
    SELECT * INTO v_session FROM public.officer_work_sessions WHERE id = p_session_id;

    IF v_session.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Session not found');
    END IF;

    -- If on break, close it first
    IF v_session.status = 'break' THEN
        v_break_minutes := EXTRACT(EPOCH FROM (v_now - v_session.last_break_start)) / 60;
        -- Update total break minutes in memory for calculation
        v_session.total_break_minutes := COALESCE(v_session.total_break_minutes, 0) + v_break_minutes;
    END IF;

    -- Calculate hours worked (excluding breaks)
    -- Total duration in hours
    v_hours := EXTRACT(EPOCH FROM (v_now - v_session.clock_in)) / 3600;
    -- Subtract break hours
    v_hours := v_hours - (COALESCE(v_session.total_break_minutes, 0)::numeric / 60.0);
    
    IF v_hours < 0 THEN v_hours := 0; END IF;

    v_coins := floor(v_hours * v_hourly_rate);

    UPDATE public.officer_work_sessions
    SET clock_out = v_now,
        status = 'completed',
        hours_worked = v_hours,
        coins_earned = v_coins,
        last_break_start = NULL, -- Clear temporary state
        total_break_minutes = COALESCE(total_break_minutes, 0) + CASE WHEN v_session.status = 'break' THEN v_break_minutes ELSE 0 END
    WHERE id = p_session_id;

    -- Update profile
    UPDATE public.user_profiles
    SET is_officer_active = false,
        last_activity_at = v_now
    WHERE id = v_session.officer_id;

    RETURN jsonb_build_object('success', true, 'message', 'Clocked out successfully', 'hours', v_hours, 'coins', v_coins);
END;
$$;
