-- Secure RPC for Admin Updates to User Profiles (Universal Bypass)
CREATE OR REPLACE FUNCTION admin_update_any_profile_field(
    p_user_id UUID,
    p_updates JSONB,
    p_admin_id UUID,
    p_reason TEXT DEFAULT 'Admin Update'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key TEXT;
    v_val TEXT;
    v_query TEXT;
    v_admin_role TEXT;
    v_is_admin BOOLEAN;
BEGIN
    -- 1. Verify Admin Permissions
    SELECT role, is_admin INTO v_admin_role, v_is_admin
    FROM user_profiles
    WHERE id = p_admin_id;

    IF v_admin_role NOT IN ('admin', 'lead_troll_officer') AND v_is_admin IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Unauthorized: Only Admins can perform this action';
    END IF;

    -- 2. Set Bypass Flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- 3. Construct Update Query Dynamically
    -- Note: We trust the admin input here. In a stricter system, we'd validate keys.
    -- Using jsonb_populate_record is tricky for partial updates without overwriting everything else or needing a type.
    -- Instead, we'll iterate keys.
    
    -- Safety check: Ensure p_updates is an object
    IF jsonb_typeof(p_updates) != 'object' THEN
        RAISE EXCEPTION 'Updates must be a JSON object';
    END IF;

    -- Perform Update
    UPDATE user_profiles
    SET 
        role = COALESCE((p_updates->>'role')::text, role),
        is_admin = COALESCE((p_updates->>'is_admin')::boolean, is_admin),
        is_lead_officer = COALESCE((p_updates->>'is_lead_officer')::boolean, is_lead_officer),
        is_troll_officer = COALESCE((p_updates->>'is_troll_officer')::boolean, is_troll_officer),
        troll_coins = COALESCE((p_updates->>'troll_coins')::bigint, troll_coins),
        level = COALESCE((p_updates->>'level')::int, level),
        xp = COALESCE((p_updates->>'xp')::int, xp),
        bypass_broadcast_restriction = COALESCE((p_updates->>'bypass_broadcast_restriction')::boolean, bypass_broadcast_restriction),
        rgb_username_expires_at = COALESCE((p_updates->>'rgb_username_expires_at')::timestamptz, rgb_username_expires_at),
        glowing_username_color = COALESCE((p_updates->>'glowing_username_color')::text, glowing_username_color),
        username_style = COALESCE((p_updates->>'username_style')::text, username_style),
        badge = COALESCE((p_updates->>'badge')::text, badge),
        updated_at = NOW()
        -- Add other fields as needed, or use a more dynamic approach if Postgres version allows
    WHERE id = p_user_id;

    -- Log Action
    INSERT INTO admin_audit_logs (admin_id, target_id, action, details, created_at)
    VALUES (p_admin_id, p_user_id, 'update_profile_field', jsonb_build_object('updates', p_updates, 'reason', p_reason), NOW());

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Secure RPC for Buying Perks (Atomic Operation)
CREATE OR REPLACE FUNCTION shop_buy_perk(
    p_user_id UUID,
    p_perk_id TEXT,
    p_cost BIGINT,
    p_duration_minutes INT,
    p_metadata JSONB DEFAULT '{}'::jsonB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_balance BIGINT;
    v_expires_at TIMESTAMPTZ;
    v_perk_name TEXT;
BEGIN
    -- 1. Check Balance
    SELECT troll_coins INTO v_user_balance
    FROM user_profiles
    WHERE id = p_user_id;

    IF v_user_balance < p_cost THEN
        RAISE EXCEPTION 'Insufficient funds';
    END IF;

    -- 2. Set Bypass Flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- 3. Deduct Coins
    UPDATE user_profiles
    SET troll_coins = troll_coins - p_cost
    WHERE id = p_user_id;

    -- 4. Calculate Expiry
    v_expires_at := NOW() + (p_metadata->>'duration_minutes')::INT * INTERVAL '1 minute';
    -- Fallback if not in metadata
    IF v_expires_at IS NULL THEN
        v_expires_at := NOW() + p_duration_minutes * INTERVAL '1 minute';
    END IF;

    v_perk_name := p_metadata->>'perk_name';
    IF v_perk_name IS NULL THEN
         SELECT name INTO v_perk_name FROM perks WHERE id = p_perk_id;
    END IF;

    -- 5. Insert into user_perks
    INSERT INTO user_perks (user_id, perk_id, expires_at, is_active, metadata)
    VALUES (
        p_user_id, 
        p_perk_id, 
        v_expires_at, 
        true, 
        p_metadata || jsonb_build_object('final_cost', p_cost, 'purchased_at', NOW())
    );

    -- 6. Log Transaction
    INSERT INTO coin_transactions (user_id, amount, type, description, metadata)
    VALUES (
        p_user_id, 
        -p_cost, 
        'perk_purchase', 
        'Purchased perk: ' || COALESCE(v_perk_name, p_perk_id), 
        p_metadata || jsonb_build_object('perk_id', p_perk_id)
    );

    -- 7. Handle Special Perks (Side Effects)
    IF p_perk_id = 'perk_rgb_username' THEN
        UPDATE user_profiles
        SET rgb_username_expires_at = v_expires_at
        WHERE id = p_user_id;
    END IF;
    
    -- Add other special perks here if they modify user_profiles

    RETURN jsonb_build_object('success', true, 'new_balance', v_user_balance - p_cost, 'expires_at', v_expires_at);
END;
$$;
