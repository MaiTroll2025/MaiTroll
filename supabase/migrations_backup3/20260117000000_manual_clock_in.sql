-- Manual Clock In RPC
DROP FUNCTION IF EXISTS "public"."manual_clock_in"("uuid");
CREATE OR REPLACE FUNCTION "public"."manual_clock_in"("p_officer_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
    INSERT INTO officer_work_sessions (officer_id, clock_in)
    VALUES (p_officer_id, now());

    -- Update officer status
    UPDATE profiles 
    SET is_officer_active = true,
        last_activity_at = now()
    WHERE id = p_officer_id;

    RETURN jsonb_build_object('success', true, 'message', 'Clocked in successfully');
END;
$$;

-- Manual Clock Out RPC
DROP FUNCTION IF EXISTS "public"."manual_clock_out"("uuid");
CREATE OR REPLACE FUNCTION "public"."manual_clock_out"("p_session_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_officer_id uuid;
    v_clock_in timestamp with time zone;
    v_now timestamp with time zone := now();
    v_hours numeric;
    v_coins bigint;
    v_hourly_rate bigint := 500; -- Baseline rate
BEGIN
    -- Get session details
    SELECT officer_id, clock_in INTO v_officer_id, v_clock_in
    FROM officer_work_sessions
    WHERE id = p_session_id;

    IF v_officer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Session not found');
    END IF;

    -- Calculate hours and coins
    v_hours := EXTRACT(EPOCH FROM (v_now - v_clock_in)) / 3600;
    v_coins := floor(v_hours * v_hourly_rate);

    -- Update session
    UPDATE officer_work_sessions
    SET clock_out = v_now,
        hours_worked = v_hours,
        coins_earned = v_coins
    WHERE id = p_session_id;

    -- Update officer status
    UPDATE profiles
    SET is_officer_active = false,
        last_activity_at = v_now
    WHERE id = v_officer_id;

    -- Final payout logic: In this system, we log it and it gets processed in payroll runs
    -- Add coins to balance if desired immediately, or let payroll handle it.
    -- Most systems here seem to let payroll handle it, but we can do a direct add if needed.
    
    RETURN jsonb_build_object('success', true, 'message', 'Clocked out successfully', 'hours', v_hours, 'coins', v_coins);
END;
$$;

-- Grant permissions
GRANT ALL ON FUNCTION "public"."manual_clock_in"("uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."manual_clock_out"("uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."manual_clock_in"("uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."manual_clock_out"("uuid") TO "service_role";
