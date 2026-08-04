-- Ensure columns exist
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS password_reset_pin_hash text,
ADD COLUMN IF NOT EXISTS password_reset_pin_set_at timestamptz;

-- Function to set PIN
CREATE OR REPLACE FUNCTION public.set_password_reset_pin(
    p_user_id UUID,
    p_pin_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_exists boolean;
BEGIN
    -- Check if user exists
    SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id) INTO v_exists;
    
    IF NOT v_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    UPDATE public.user_profiles
    SET password_reset_pin_hash = p_pin_hash,
        password_reset_pin_set_at = NOW()
    WHERE id = p_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_password_reset_pin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_password_reset_pin(UUID, TEXT) TO service_role;
