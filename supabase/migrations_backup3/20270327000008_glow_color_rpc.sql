-- Secure RPC for updating Glowing Username Color
CREATE OR REPLACE FUNCTION update_glow_color(
    p_color TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_has_perk BOOLEAN;
BEGIN
    v_user_id := auth.uid();

    -- Check if user has active RGB perk
    SELECT EXISTS (
        SELECT 1 FROM user_perks
        WHERE user_id = v_user_id
          AND perk_id = 'perk_rgb_username'
          AND is_active = true
          AND (expires_at IS NULL OR expires_at > NOW())
    ) INTO v_has_perk;

    IF NOT v_has_perk THEN
        RAISE EXCEPTION 'You do not have an active RGB Username perk.';
    END IF;

    -- Set bypass flag to allow update to restricted column
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    UPDATE user_profiles
    SET glowing_username_color = p_color,
        updated_at = NOW()
    WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
