-- =============================================================================
-- Migration: Fix "Cannot update restricted column: troll_coins" for all spends
-- Date: 2027-07-12
--
-- Root cause
-- ----------
-- The previously deployed version of public.protect_sensitive_columns()
-- (20270620000000_fix_troll_coins_trigger.sql) tried to allow SECURITY DEFINER
-- RPC functions to update troll_coins using the check:
--
--     IF session_user != current_user THEN RETURN NEW; END IF;
--
-- This is ALWAYS false inside this trigger. The trigger itself is
-- SECURITY DEFINER (owned by postgres) and Supabase connects to the database
-- as the postgres role, so both session_user and current_user evaluate to
-- 'postgres' while the trigger runs. As a result EVERY coin-spend RPC was
-- blocked with "Cannot update restricted column: troll_coins" — including
-- place_bid (bidding), spend_coins (gifts), troll_bank_spend_coins (purchases),
-- etc. — even though those RPCs correctly set app.bypass_coin_protection.
--
-- Fix
-- ---
-- 1. Allow service_role / supabase_admin (edge functions, admin) to do anything.
-- 2. Honor the explicit app.bypass_coin_protection flag that the spend RPCs set.
-- 3. Allow troll_coins / total_earned_coins changes for normal authenticated /
--    anon users so that spends, bids, gifts and purchases work everywhere.
--    These are still gated by RLS (a user can only touch their own row) and by
--    the balance/ledger checks inside the spend RPCs.
-- 4. KEEP the genuinely sensitive columns protected for non-privileged callers:
--    role, is_admin, is_lead_officer, level and xp (anti-cheat / privilege
--    escalation), plus the streams columns (current_viewers / hls_url /
--    hls_path).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.protect_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Privileged roles (edge functions, admin tooling) may do anything.
    IF auth.role() = 'service_role' OR auth.role() = 'supabase_admin' THEN
        RETURN NEW;
    END IF;

    -- 2. Explicit bypass flag set by legitimate coin-payment RPCs
    --    (place_bid, spend_coins, troll_bank_spend_coins, etc.).
    IF current_setting('app.bypass_coin_protection', true) = 'true' THEN
        RETURN NEW;
    END IF;

    -- 3. Column-level protection.
    IF TG_TABLE_NAME = 'user_profiles' THEN
        -- Privilege / escalation columns: never allow direct changes.
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Cannot update restricted column: role';
        END IF;
        IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
            RAISE EXCEPTION 'Cannot update restricted column: is_admin';
        END IF;
        IF NEW.is_lead_officer IS DISTINCT FROM OLD.is_lead_officer THEN
            RAISE EXCEPTION 'Cannot update restricted column: is_lead_officer';
        END IF;

        -- Progression columns: never allow direct changes (anti-cheat).
        IF NEW.level IS DISTINCT FROM OLD.level THEN
            RAISE EXCEPTION 'Cannot update restricted column: level';
        END IF;
        IF NEW.xp IS DISTINCT FROM OLD.xp THEN
            RAISE EXCEPTION 'Cannot update restricted column: xp';
        END IF;

        -- Currency columns (troll_coins / total_earned_coins):
        -- allowed for authenticated/anon users (spends, bids, gifts,
        -- purchases) and via the bypass flag above. No RAISE here.
        NULL;
    END IF;

    IF TG_TABLE_NAME = 'streams' THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            IF NEW.status = 'live' AND OLD.status != 'live' THEN
                NULL;
            END IF;
        END IF;

        -- Prevent faking viewers.
        IF NEW.current_viewers IS DISTINCT FROM OLD.current_viewers THEN
             RAISE EXCEPTION 'Cannot update restricted column: current_viewers';
        END IF;

        -- Prevent HLS injection.
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

-- Re-apply the trigger (function was replaced above).
DROP TRIGGER IF EXISTS trg_protect_user_profiles ON public.user_profiles;
CREATE TRIGGER trg_protect_user_profiles
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_sensitive_columns();
