-- Secure RPC for Toggling Perks
CREATE OR REPLACE FUNCTION toggle_user_perk(
    p_perk_id UUID,
    p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_perk_def_id TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Verify Ownership
    SELECT perk_id, expires_at INTO v_perk_def_id, v_expires_at
    FROM user_perks
    WHERE id = p_perk_id AND user_id = v_user_id;

    IF v_perk_def_id IS NULL THEN
        RAISE EXCEPTION 'Perk not found or access denied';
    END IF;

    -- 2. Set Bypass Flag (needed if we update user_profiles)
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- 3. Update perk status
    UPDATE user_perks
    SET is_active = p_is_active
    WHERE id = p_perk_id;

    -- 4. Handle Special Side Effects (RGB Username)
    IF v_perk_def_id = 'perk_rgb_username' THEN
        IF p_is_active THEN
             -- Reactivating: Restore expiration from the perk record
             UPDATE user_profiles
             SET rgb_username_expires_at = v_expires_at
             WHERE id = v_user_id;
        ELSE
             -- Deactivating: Clear expiration from profile (but keep it in perk record)
             UPDATE user_profiles
             SET rgb_username_expires_at = NULL
             WHERE id = v_user_id;
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;
