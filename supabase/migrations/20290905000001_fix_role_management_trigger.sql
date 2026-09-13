-- Migration: Fix role management trigger blocking admin role changes
-- Purpose: The prevent_profile_privilege_escalation trigger was unconditionally
--          reverting all role changes on user_profiles, making the set_user_role
--          RPC and admin role management completely non-functional.
--
-- Root cause: When the admin-actions edge function calls set_user_role via the
--              supabaseAdmin (service role key) client, auth.role() inside BEFORE
--              UPDATE triggers is not reliably 'service_role'. The trigger then
--              fell through to the fallback branch which silently reverted
--              NEW.role := OLD.role, discarding the change with no error.
--
-- Fix: Also allow authenticated admins (checked via is_admin helper) to change
--      roles, matching the pattern used by protect_sensitive_columns.
--
-- Dependency: Requires public.is_admin(UUID) function to exist

-- Ensure is_admin(UUID) function exists
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = p_user_id
        AND (
            is_admin = true
            OR admin_override_until IS NOT NULL AND admin_override_until > NOW()
        )
    ) OR EXISTS (
        SELECT 1 FROM public.user_role_grants ur
        JOIN public.system_roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id
        AND r.is_admin = true
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        AND ur.revoked_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service_role (edge functions with service role key) and supabase_admin
  IF auth.role() = 'service_role' OR auth.role() = 'supabase_admin' THEN
    RETURN NEW;
  END IF;

  -- Allow authenticated admins to modify roles and restricted fields
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Block non-admin users from changing roles or broadcasting_disabled
  IF TG_TABLE_NAME = 'user_profiles' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;
    IF NEW.broadcasting_disabled IS DISTINCT FROM OLD.broadcasting_disabled THEN
      NEW.broadcasting_disabled := OLD.broadcasting_disabled;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() TO authenticated;
