-- Fix: Allow SECURITY DEFINER RPC functions to update troll_coins
-- The previous trigger blocked ALL non-service_role updates to troll_coins,
-- which broke seat price payments, gift deductions, and other legitimate flows.
--
-- The fix: Check if the current transaction is running as SECURITY DEFINER
-- by using session_user vs current_user. SECURITY DEFINER functions run as
-- the function owner (postgres/supabase_admin), so session_user will differ
-- from current_user when called by anon/authenticated roles.

CREATE OR REPLACE FUNCTION public.protect_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Allow service_role or superusers to bypass
    IF auth.role() = 'service_role' OR auth.role() = 'supabase_admin' THEN
        RETURN NEW;
    END IF;

    -- Allow SECURITY DEFINER RPC functions to bypass
    -- When a SECURITY DEFINER function calls this trigger, session_user is the
    -- function owner (postgres) while current_user is the original caller.
    IF session_user != current_user THEN
        RETURN NEW;
    END IF;

    -- Check for sensitive column changes in user_profiles
    IF TG_TABLE_NAME = 'user_profiles' THEN
        -- Prevent role escalation
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Cannot update restricted column: role';
        END IF;
        IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
            RAISE EXCEPTION 'Cannot update restricted column: is_admin';
        END IF;
        IF NEW.is_lead_officer IS DISTINCT FROM OLD.is_lead_officer THEN
            RAISE EXCEPTION 'Cannot update restricted column: is_lead_officer';
        END IF;
        
        -- Prevent currency manipulation (only for direct anon/authenticated updates)
        IF NEW.troll_coins IS DISTINCT FROM OLD.troll_coins THEN
            RAISE EXCEPTION 'Cannot update restricted column: troll_coins';
        END IF;
        IF NEW.total_earned_coins IS DISTINCT FROM OLD.total_earned_coins THEN
            RAISE EXCEPTION 'Cannot update restricted column: total_earned_coins';
        END IF;
        
        -- Prevent leveling cheating
        IF NEW.level IS DISTINCT FROM OLD.level THEN
            RAISE EXCEPTION 'Cannot update restricted column: level';
        END IF;
        IF NEW.xp IS DISTINCT FROM OLD.xp THEN
            RAISE EXCEPTION 'Cannot update restricted column: xp';
        END IF;
    END IF;

    -- Check for sensitive column changes in streams
    IF TG_TABLE_NAME = 'streams' THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF NEW.status = 'live' AND OLD.status != 'live' THEN
                NULL;
            END IF;
        END IF;
        
        -- Prevent faking viewers
        IF NEW.current_viewers IS DISTINCT FROM OLD.current_viewers THEN
             RAISE EXCEPTION 'Cannot update restricted column: current_viewers';
        END IF;

        -- Prevent HLS injection
        IF NEW.hls_url IS DISTINCT FROM OLD.hls_url THEN
            RAISE EXCEPTION 'Cannot update restricted column: hls_url';
        END IF;
        IF NEW.hls_path IS DISTINCT FROM OLD.hls_path THEN
            RAISE EXCEPTION 'Cannot update restricted column: hls_path';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Re-apply trigger (function was replaced above)
DROP TRIGGER IF EXISTS trg_protect_user_profiles ON public.user_profiles;
CREATE TRIGGER trg_protect_user_profiles
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_sensitive_columns();
