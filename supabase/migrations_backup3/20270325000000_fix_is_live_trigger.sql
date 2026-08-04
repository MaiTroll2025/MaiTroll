-- Fix the protect_sensitive_columns trigger to allow ending streams
-- This updates the function to allow is_live to transition from true to false

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
        
        -- Prevent currency manipulation
        IF NEW.troll_coins IS DISTINCT FROM OLD.troll_coins THEN
            -- Check for secure bypass flag
            IF current_setting('app.bypass_coin_protection', true) IS DISTINCT FROM 'true' THEN
                RAISE EXCEPTION 'Cannot update restricted column: troll_coins';
            END IF;
        END IF;

        IF NEW.total_earned_coins IS DISTINCT FROM OLD.total_earned_coins THEN
            IF current_setting('app.bypass_coin_protection', true) IS DISTINCT FROM 'true' THEN
                RAISE EXCEPTION 'Cannot update restricted column: total_earned_coins';
            END IF;
        END IF;
        
        -- Prevent leveling cheating
        IF NEW.level IS DISTINCT FROM OLD.level THEN
            RAISE EXCEPTION 'Cannot update restricted column: level';
        END IF;
        IF NEW.xp IS DISTINCT FROM OLD.xp THEN
             IF current_setting('app.bypass_coin_protection', true) IS DISTINCT FROM 'true' THEN
                RAISE EXCEPTION 'Cannot update restricted column: xp';
            END IF;
        END IF;
    END IF;

    -- Check for sensitive column changes in streams
    IF TG_TABLE_NAME = 'streams' THEN
        -- Prevent faking live status
        IF NEW.is_live IS DISTINCT FROM OLD.is_live THEN
            -- Allow ending stream (true -> false), but prevent starting manually (false -> true)
            IF NEW.is_live = true THEN
                RAISE EXCEPTION 'Cannot update restricted column: is_live. Use the broadcast setup flow.';
            END IF;
        END IF;
        
        IF NEW.status IS DISTINCT FROM OLD.status THEN
             IF NEW.status = 'live' AND OLD.status != 'live' THEN
                 RAISE EXCEPTION 'Cannot manually set status to live';
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
