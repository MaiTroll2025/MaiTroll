-- Update admin account with driver license and badge
DO $$
DECLARE
    v_admin_id UUID := '8dff9f37-21b5-4b8e-adc2-b9286874be1a';
    v_badge_id UUID;
BEGIN
    -- Check if user exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_admin_id) THEN
        RAISE NOTICE 'Admin user % not found, skipping license update', v_admin_id;
        RETURN;
    END IF;

    -- 1. Update Profile License Status
    UPDATE public.user_profiles
    SET drivers_license_status = 'active',
        drivers_license_expiry = now() + interval '365 days'
    WHERE id = v_admin_id;

    -- 2. Award Badge
    SELECT id INTO v_badge_id FROM public.badge_catalog WHERE slug = 'driver-license';
    
    IF v_badge_id IS NOT NULL THEN
        INSERT INTO public.user_badges (user_id, badge_id)
        VALUES (v_admin_id, v_badge_id)
        ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
END $$;
