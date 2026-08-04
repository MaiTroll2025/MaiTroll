CREATE OR REPLACE FUNCTION is_officer_active(p_officer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_active boolean;
BEGIN
    SELECT is_officer_active INTO v_is_active
    FROM user_profiles
    WHERE id = p_officer_id;

    RETURN v_is_active;
END;
$$;