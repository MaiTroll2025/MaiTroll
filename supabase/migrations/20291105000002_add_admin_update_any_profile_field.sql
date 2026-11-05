-- Add missing admin_update_any_profile_field RPC function
-- Fixes: "Could not find the function public.admin_update_any_profile_field(...) in the schema cache"

CREATE OR REPLACE FUNCTION public.admin_update_any_profile_field(
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
    FROM public.user_profiles
    WHERE id = p_admin_id;

    IF v_admin_role NOT IN ('admin', 'lead_troll_officer') AND v_is_admin IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Unauthorized: Only Admins can perform this action';
    END IF;

    -- 2. Set Bypass Flag
    PERFORM set_config('app.bypass_coin_protection', 'true', true);

    -- 3. Safety check: Ensure p_updates is an object
    IF jsonb_typeof(p_updates) != 'object' THEN
        RAISE EXCEPTION 'Updates must be a JSON object';
    END IF;

    -- 4. Perform Update
    UPDATE public.user_profiles
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
    WHERE id = p_user_id;

    -- 5. Log Action
    INSERT INTO public.admin_audit_logs (admin_id, target_id, action, details, created_at)
    VALUES (p_admin_id, p_user_id, 'update_profile_field', jsonb_build_object('updates', p_updates, 'reason', p_reason), NOW());

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. Grant execute permission so PostgREST / service role can invoke it
GRANT EXECUTE ON FUNCTION public.admin_update_any_profile_field(UUID, JSONB, UUID, TEXT) TO anon, authenticated, service_role;

-- 7. Add missing profile pricing columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS message_price INTEGER DEFAULT 0;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS call_price INTEGER DEFAULT 0;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS profile_view_price INTEGER DEFAULT 0;

-- 8. Refresh schema cache (PostgREST auto-refreshes on DDL changes)
