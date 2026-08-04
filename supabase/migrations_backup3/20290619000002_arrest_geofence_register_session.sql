-- ============================================================
-- Wire arrest device geofence into session registration
-- Extends register_session to check new device registrations
-- against active arrest locations (5-mile radius)
-- ============================================================

-- Replace register_session with geofence-aware version
CREATE OR REPLACE FUNCTION public.register_session(
    p_user_id UUID,
    p_session_id UUID,
    p_device_info JSONB DEFAULT '{}'::jsonb,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_is_admin BOOLEAN;
    v_is_officer BOOLEAN;
    v_is_lead_officer BOOLEAN;
    v_officer_role TEXT;
    v_user_lat DECIMAL(10, 8);
    v_user_lon DECIMAL(11, 8);
    v_arrest_lat DECIMAL(10, 8);
    v_arrest_lon DECIMAL(11, 8);
    v_distance_meters DECIMAL(10, 2);
    v_arrest RECORD;
    v_final_ip INET;
BEGIN
    -- Get user role info
    SELECT role, is_admin, is_troll_officer, is_lead_officer, officer_role
    INTO v_role, v_is_admin, v_is_officer, v_is_lead_officer, v_officer_role
    FROM user_profiles
    WHERE id = p_user_id;

    -- Deactivate any existing sessions for this user if NOT admin/officer/secretary
    IF NOT (
        v_role = 'admin' OR
        v_role = 'secretary' OR
        v_is_admin = TRUE OR
        v_is_officer = TRUE OR
        v_is_lead_officer = TRUE OR
        v_role = 'troll_officer' OR
        v_role = 'lead_troll_officer' OR
        v_officer_role IS NOT NULL
    ) THEN
        UPDATE active_sessions
        SET is_active = FALSE, last_active = NOW()
        WHERE user_id = p_user_id AND is_active = TRUE;
    END IF;

    -- Insert or update the new session
    INSERT INTO active_sessions (user_id, session_id, device_info, ip_address, user_agent)
    VALUES (p_user_id, p_session_id, p_device_info, p_ip_address, p_user_agent)
    ON CONFLICT (user_id, session_id) DO UPDATE
    SET is_active = TRUE,
        last_active = NOW(),
        device_info = p_device_info,
        ip_address = p_ip_address,
        user_agent = p_user_agent;

    -- ============================================================
    -- ARREST DEVICE GEOFENCE CHECK
    -- Flag this device if it registers within 5 miles of any active arrest
    -- ============================================================

    -- Get the user's most recent IP geolocation
    SELECT latitude, longitude
    INTO v_user_lat, v_user_lon
    FROM user_ip_tracking
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- Skip geofence check if no location data available
    IF v_user_lat IS NULL OR v_user_lon IS NULL THEN
        RETURN;
    END IF;

    -- Resolve IP: use provided IP, otherwise get from user_ip_tracking
    IF p_ip_address IS NOT NULL THEN
        v_final_ip := p_ip_address::inet;
    ELSE
        SELECT ip_address INTO v_final_ip
        FROM user_ip_tracking
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    -- Check against all active arrests with known locations
    FOR v_arrest IN
        SELECT j.id, j.arrest_latitude, j.arrest_longitude, j.user_id as arrested_user_id
        FROM jail j
        WHERE j.status = 'jailed'
          AND j.release_time > NOW()
          AND j.arrest_latitude IS NOT NULL
          AND j.arrest_longitude IS NOT NULL
          AND j.user_id != p_user_id
    LOOP
        v_arrest_lat := v_arrest.arrest_latitude;
        v_arrest_lon := v_arrest.arrest_longitude;

        v_distance_meters := public.haversine_distance_meters(
            v_user_lat, v_user_lon,
            v_arrest_lat, v_arrest_lon
        );

        -- 5 miles = 8046.72 meters
        IF v_distance_meters <= 8046.72 THEN
            INSERT INTO flagged_device_registrations (
                user_id, session_id, device_info,
                ip_address, user_agent,
                arrest_id, distance_meters,
                arrested_user_id
            ) VALUES (
                p_user_id, p_session_id,
                p_device_info,
                v_final_ip, p_user_agent,
                v_arrest.id, v_distance_meters,
                v_arrest.arrested_user_id
            );
        END IF;
    END LOOP;
END;
$$;

-- Ensure the function grants are in place
GRANT EXECUTE ON FUNCTION public.register_session TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Session registration wired with arrest device geofence' AS result;
