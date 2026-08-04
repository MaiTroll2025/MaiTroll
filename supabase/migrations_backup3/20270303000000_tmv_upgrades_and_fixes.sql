
-- Migration to add insurance renewal and fix upgrades for new vehicle system

-- 1. Insurance Renewal RPC
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

    -- Check ownership (or admin/staff override? For now enforce ownership)
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
    WHERE vehicle_id = p_vehicle_id
    AND status = 'active'
    ORDER BY expires_at DESC
    LIMIT 1;

    IF v_current_expiry IS NOT NULL AND v_current_expiry > NOW() THEN
        v_new_expiry := v_current_expiry + INTERVAL '30 days';
    ELSE
        v_new_expiry := NOW() + INTERVAL '30 days';
    END IF;

    INSERT INTO vehicle_insurance_policies (vehicle_id, provider, policy_number, expires_at, status)
    VALUES (
        p_vehicle_id,
        'Mai Troll Insurance',
        'POL-' || upper(substring(md5(random()::text), 1, 8)),
        v_new_expiry,
        'active'
    )
    ON CONFLICT (vehicle_id) WHERE status = 'active'
    DO UPDATE SET expires_at = EXCLUDED.expires_at;

    RETURN jsonb_build_object('success', true, 'new_expiry', v_new_expiry);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix Upgrades System
-- Assuming car_upgrades table still exists (catalog).
-- We need a new link table for user_vehicles.

CREATE TABLE IF NOT EXISTS user_vehicle_upgrades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_vehicle_id UUID REFERENCES user_vehicles(id) ON DELETE CASCADE,
    upgrade_id UUID REFERENCES car_upgrades(id) ON DELETE CASCADE,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_vehicle_id, upgrade_id)
);

-- RPC to apply upgrade
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
    IF EXISTS (SELECT 1 FROM user_vehicle_upgrades WHERE user_vehicle_id = p_vehicle_id AND upgrade_id = p_upgrade_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Upgrade already installed');
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
    VALUES (v_user_id, NULL, v_cost, 'Vehicle Upgrade Purchase');

    -- Install upgrade
    INSERT INTO user_vehicle_upgrades (user_vehicle_id, upgrade_id)
    VALUES (p_vehicle_id, p_upgrade_id);

    -- Note: Updating vehicle value or stats could be done here if the schema supports it.
    -- For now, we assume dynamic calculation or ignored.
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT ALL ON TABLE user_vehicle_upgrades TO authenticated;
GRANT ALL ON TABLE user_vehicle_upgrades TO service_role;
