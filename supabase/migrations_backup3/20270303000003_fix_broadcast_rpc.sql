
-- Fix get_broadcast_vehicle_status to respect active_vehicle
-- This ensures the chat badge matches the 3D avatar and TMV selection

CREATE OR REPLACE FUNCTION get_broadcast_vehicle_status(
    p_target_user_id UUID
)
RETURNS TABLE (
    vehicle_name TEXT,
    plate_number TEXT,
    plate_type TEXT,
    reg_status TEXT,
    ins_status TEXT,
    license_status TEXT,
    is_impounded BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_active_vehicle_id UUID;
BEGIN
    -- 1. Try to get explicitly active vehicle
    SELECT active_vehicle INTO v_active_vehicle_id
    FROM public.user_profiles
    WHERE id = p_target_user_id;

    -- 2. If no active vehicle set, fallback to most recent purchase
    IF v_active_vehicle_id IS NULL THEN
        SELECT id INTO v_active_vehicle_id
        FROM public.user_vehicles
        WHERE user_id = p_target_user_id
        ORDER BY purchased_at DESC
        LIMIT 1;
    END IF;

    -- 3. Return details for that vehicle (if exists)
    RETURN QUERY
    SELECT 
        vc.name as vehicle_name,
        vr.plate_number,
        vr.plate_type,
        CASE 
            WHEN vr.expires_at < NOW() THEN 'expired'
            ELSE vr.status 
        END as reg_status,
        COALESCE(vi.status, 'uninsured') as ins_status,
        COALESCE(udl.status, 'none') as license_status,
        uv.is_impounded
    FROM public.user_vehicles uv
    JOIN public.vehicles_catalog vc ON uv.catalog_id = vc.id
    LEFT JOIN public.vehicle_registrations vr ON uv.id = vr.user_vehicle_id
    LEFT JOIN public.vehicle_insurance_policies vi ON uv.id = vi.user_vehicle_id AND vi.status = 'active' AND vi.expires_at > NOW()
    LEFT JOIN public.user_driver_licenses udl ON uv.user_id = udl.user_id
    WHERE uv.id = v_active_vehicle_id;
END;
$$;
