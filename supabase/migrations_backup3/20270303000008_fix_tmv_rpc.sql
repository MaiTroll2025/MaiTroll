
-- Fix TMV RPCs to use correct column names (user_vehicle_id instead of vehicle_id)

-- 1. Fix renew_vehicle_insurance
CREATE OR REPLACE FUNCTION renew_vehicle_insurance(p_vehicle_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_cost INTEGER := 2000; -- Fixed cost as per UI
    v_balance INTEGER;
    v_current_expiry TIMESTAMPTZ;
    v_new_expiry TIMESTAMPTZ;
BEGIN
    -- Get user ID from vehicle
    SELECT user_id INTO v_user_id
    FROM user_vehicles
    WHERE id = p_vehicle_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not found');
    END IF;

    -- Check ownership
    IF v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not your vehicle');
    END IF;

    -- Check balance
    SELECT troll_coins INTO v_balance
    FROM user_profiles
    WHERE id = v_user_id;

    IF v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Deduct coins
    UPDATE user_profiles
    SET troll_coins = troll_coins - v_cost
    WHERE id = v_user_id;

    -- Record transaction
    INSERT INTO coin_transactions (from_user_id, to_user_id, amount, reason)
    VALUES (v_user_id, NULL, v_cost, 'Vehicle Insurance Renewal');

    -- Update or Insert Insurance Policy
    SELECT expires_at INTO v_current_expiry
    FROM vehicle_insurance_policies
    WHERE user_vehicle_id = p_vehicle_id
    AND status = 'active'
    ORDER BY expires_at DESC
    LIMIT 1;

    IF v_current_expiry IS NOT NULL AND v_current_expiry > NOW() THEN
        v_new_expiry := v_current_expiry + INTERVAL '30 days';
    ELSE
        v_new_expiry := NOW() + INTERVAL '30 days';
    END IF;

    INSERT INTO vehicle_insurance_policies (user_vehicle_id, provider, premium_amount, expires_at, status)
    VALUES (
        p_vehicle_id,
        'Troll Mutual',
        v_cost,
        v_new_expiry,
        'active'
    )
    ON CONFLICT (user_vehicle_id)
    DO UPDATE SET expires_at = EXCLUDED.expires_at, status = 'active';

    RETURN jsonb_build_object('success', true, 'new_expiry', v_new_expiry);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure user_vehicle_upgrades exists (if not created by previous faulty migration)
CREATE TABLE IF NOT EXISTS public.user_vehicle_upgrades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_vehicle_id UUID REFERENCES public.user_vehicles(id) ON DELETE CASCADE,
    upgrade_id UUID REFERENCES public.car_upgrades(id) ON DELETE CASCADE,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_vehicle_id, upgrade_id)
);

-- 3. Fix apply_vehicle_upgrade (Just to be safe and ensure it uses correct tables)
CREATE OR REPLACE FUNCTION apply_vehicle_upgrade(p_vehicle_id UUID, p_upgrade_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_cost INTEGER;
    v_balance INTEGER;
    v_upgrade_exists BOOLEAN;
    v_already_installed BOOLEAN;
BEGIN
    -- Get vehicle owner
    SELECT user_id INTO v_user_id
    FROM user_vehicles
    WHERE id = p_vehicle_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vehicle not found');
    END IF;

    IF v_user_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not your vehicle');
    END IF;

    -- Get upgrade cost
    SELECT cost INTO v_cost
    FROM car_upgrades
    WHERE id = p_upgrade_id;

    IF v_cost IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Upgrade not found');
    END IF;

    -- Check if already installed
    SELECT EXISTS(
        SELECT 1 FROM user_vehicle_upgrades
        WHERE user_vehicle_id = p_vehicle_id AND upgrade_id = p_upgrade_id
    ) INTO v_already_installed;

    IF v_already_installed THEN
        RETURN jsonb_build_object('success', false, 'message', 'Upgrade already installed');
    END IF;

    -- Check balance
    SELECT troll_coins INTO v_balance
    FROM user_profiles
    WHERE id = v_user_id;

    IF v_balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
    END IF;

    -- Process Transaction
    UPDATE user_profiles
    SET troll_coins = troll_coins - v_cost
    WHERE id = v_user_id;

    INSERT INTO coin_transactions (from_user_id, to_user_id, amount, reason)
    VALUES (v_user_id, NULL, v_cost, 'Vehicle Upgrade: ' || p_upgrade_id);

    INSERT INTO user_vehicle_upgrades (user_vehicle_id, upgrade_id)
    VALUES (p_vehicle_id, p_upgrade_id);

    -- Update vehicle mods JSONB for easy access (optional, but good for caching)
    -- We append the upgrade ID to the mods array or similar structure if we want
    -- For now, the junction table is the source of truth.

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
