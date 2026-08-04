-- ============================================================
-- Arrest Device Geofence System
-- Automatically flags new device registrations within
-- 5 miles of an active arrest location
-- ============================================================

-- ============================================================
-- 1. Add arrest location columns to jail table
-- ============================================================
ALTER TABLE public.jail
ADD COLUMN IF NOT EXISTS arrest_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS arrest_longitude DECIMAL(11, 8);

COMMENT ON COLUMN public.jail.arrest_latitude IS 'Latitude of the arrest location (from arrested user IP geolocation)';
COMMENT ON COLUMN public.jail.arrest_longitude IS 'Longitude of the arrest location (from arrested user IP geolocation)';

-- ============================================================
-- 2. Create flagged_device_registrations table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.flagged_device_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    device_fingerprint TEXT,
    device_info JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    arrest_id UUID NOT NULL REFERENCES public.jail(id) ON DELETE CASCADE,
    distance_meters DECIMAL(10, 2),
    arrested_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    flagged_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    action_taken TEXT
);

ALTER TABLE public.flagged_device_registrations FORCE ROW LEVEL SECURITY;

CREATE POLICY "Admins and officers can view flagged devices"
ON public.flagged_device_registrations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (is_admin = true OR role = 'admin' OR is_troll_officer = true OR role = 'troll_officer' OR is_lead_officer = true OR role = 'lead_troll_officer')
    )
);

CREATE POLICY "System can insert flagged devices"
ON public.flagged_device_registrations FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins and officers can update flagged devices"
ON public.flagged_device_registrations FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (is_admin = true OR role = 'admin' OR is_troll_officer = true OR role = 'troll_officer' OR is_lead_officer = true OR role = 'lead_troll_officer')
    )
);

CREATE INDEX IF NOT EXISTS idx_flagged_device_user ON public.flagged_device_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_flagged_device_arrest ON public.flagged_device_registrations(arrest_id);
CREATE INDEX IF NOT EXISTS idx_flagged_device_reviewed ON public.flagged_device_registrations(reviewed);
CREATE INDEX IF NOT EXISTS idx_flagged_device_flagged_at ON public.flagged_device_registrations(flagged_at DESC);

-- ============================================================
-- 3. Helper function: Haversine distance in meters
-- ============================================================
CREATE OR REPLACE FUNCTION public.haversine_distance_meters(
    p_lat1 DECIMAL, p_lon1 DECIMAL,
    p_lat2 DECIMAL, p_lon2 DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    v_earth_radius DECIMAL := 6371000;
    v_dlat DECIMAL;
    v_dlon DECIMAL;
    v_a DECIMAL;
    v_c DECIMAL;
    v_d DECIMAL;
BEGIN
    v_dlat := radians(p_lat2 - p_lat1);
    v_dlon := radians(p_lon2 - p_lon1);
    v_a := sin(v_dlat / 2) ^ 2
         + cos(radians(p_lat1)) * cos(radians(p_lat2))
         * sin(v_dlon / 2) ^ 2;
    v_c := 2 * atan2(sqrt(v_a), sqrt(1 - v_a));
    v_d := v_earth_radius * v_c;
    RETURN round(v_d::numeric, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.haversine_distance_meters IS 'Calculates the Haversine distance between two lat/lon points in meters';

-- ============================================================
-- 4. RPC: check_device_near_arrest_location
-- Checks if a user's IP location is within 5 miles of any active arrest
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_device_near_arrest_location(
    p_user_id UUID,
    p_session_id UUID DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_device_info JSONB DEFAULT '{}'::jsonb,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE(
    flagged BOOLEAN,
    nearby_arrest_count INTEGER,
    closest_distance_meters DECIMAL
) AS $$
DECLARE
    v_user_lat DECIMAL(10, 8);
    v_user_lon DECIMAL(11, 8);
    v_user_ip INET;
    v_user_agent_text TEXT;
    v_device_info_json JSONB;
    v_arrest_lat DECIMAL(10, 8);
    v_arrest_lon DECIMAL(11, 8);
    v_distance_meters DECIMAL(10, 2);
    v_closest_distance DECIMAL(10, 2) := NULL;
    v_nearby_count INTEGER := 0;
    v_flagged BOOLEAN := FALSE;
    v_arrest RECORD;
    v_user_ip_tracking_id UUID;
BEGIN
    -- Get the user's most recent IP geolocation
    SELECT latitude, longitude, ip_address, user_agent
    INTO v_user_lat, v_user_lon, v_user_ip, v_user_agent_text
    FROM public.user_ip_tracking
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- If no location data, not flagged
    IF v_user_lat IS NULL OR v_user_lon IS NULL THEN
        flagged := FALSE;
        nearby_arrest_count := 0;
        closest_distance_meters := NULL;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Use provided values or fall back to looked-up values
    v_user_ip := COALESCE(p_ip_address, v_user_ip);
    v_user_agent_text := COALESCE(p_user_agent, v_user_agent_text);
    v_device_info_json := p_device_info;

    -- Check against all active arrests (status = 'jailed' and not yet released)
    FOR v_arrest IN
        SELECT j.id, j.arrest_latitude, j.arrest_longitude, j.user_id as arrested_user_id
        FROM public.jail j
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

        -- Track closest distance
        IF v_closest_distance IS NULL OR v_distance_meters < v_closest_distance THEN
            v_closest_distance := v_distance_meters;
        END IF;

        -- 5 miles = 8046.72 meters
        IF v_distance_meters <= 8046.72 THEN
            v_nearby_count := v_nearby_count + 1;
            v_flagged := TRUE;

            -- Insert flagged device record
            INSERT INTO public.flagged_device_registrations (
                user_id, session_id, device_fingerprint, device_info,
                ip_address, user_agent, arrest_id, distance_meters,
                arrested_user_id
            ) VALUES (
                p_user_id, p_session_id, p_device_fingerprint, v_device_info_json,
                v_user_ip, v_user_agent_text, v_arrest.id, v_distance_meters,
                v_arrest.arrested_user_id
            );
        END IF;
    END LOOP;

    flagged := v_flagged;
    nearby_arrest_count := v_nearby_count;
    closest_distance_meters := v_closest_distance;

    RETURN NEXT;
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.check_device_near_arrest_location IS 'Checks if a device registration is within 5 miles of any active arrest location and flags it if so';

-- ============================================================
-- 5. RPC: backfill_arrest_location
-- Looks up the arrested user IP geolocation from user_ip_tracking
-- and backfills the arrest_latitude/arrest_longitude on the jail record
-- ============================================================
CREATE OR REPLACE FUNCTION public.backfill_arrest_location(
    p_jail_id UUID,
    p_arrested_user_id UUID
)
RETURNS TABLE(success BOOLEAN, latitude DECIMAL, longitude DECIMAL) AS $$
DECLARE
    v_lat DECIMAL(10, 8);
    v_lon DECIMAL(11, 8);
BEGIN
    SELECT latitude, longitude
    INTO v_lat, v_lon
    FROM public.user_ip_tracking
    WHERE user_id = p_arrested_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_lat IS NOT NULL AND v_lon IS NOT NULL THEN
        UPDATE public.jail
        SET arrest_latitude = v_lat,
            arrest_longitude = v_lon
        WHERE id = p_jail_id;

        success := TRUE;
        latitude := v_lat;
        longitude := v_lon;
    ELSE
        success := FALSE;
        latitude := NULL;
        longitude := NULL;
    END IF;

    RETURN NEXT;
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.backfill_arrest_location IS 'Backfills arrest location from the arrested user most recent IP geolocation record';

-- ============================================================
-- 6. Grant permissions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.haversine_distance_meters TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_device_near_arrest_location TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_arrest_location TO authenticated;

-- ============================================================
-- 7. Refresh PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';

SELECT 'Arrest device geofence system created' AS result;
