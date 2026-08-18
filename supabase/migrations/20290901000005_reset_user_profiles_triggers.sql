-- ============================================================================
-- Migration: Reset user_profiles triggers to remove any legacy references
-- Date: 2026-09-01
-- Purpose: Drop all triggers on user_profiles and recreate only the safe,
--          baseline triggers. This eliminates any trigger that might still
--          reference the removed reserved_troll_coins / cashout columns.
-- ============================================================================

-- ===== DROP ALL EXISTING TRIGGERS ON user_profiles =====
DROP TRIGGER IF EXISTS assign_og_on_register ON public.user_profiles;
DROP TRIGGER IF EXISTS prevent_hr_field_changes_trigger ON public.user_profiles;
DROP TRIGGER IF EXISTS tr_grant_og_badge ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_assign_og_user ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_log_user_moderation ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_set_default_troll_coins ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_set_og_status ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_sync_troll_role ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_sync_trollstown_coins ON public.user_profiles;
DROP TRIGGER IF EXISTS trigger_auto_grant_admin_officer ON public.user_profiles;
DROP TRIGGER IF EXISTS trigger_auto_remove_verification ON public.user_profiles;
DROP TRIGGER IF EXISTS trigger_auto_upgrade_influencer ON public.user_profiles;
DROP TRIGGER IF EXISTS trigger_sync_troll_role ON public.user_profiles;
DROP TRIGGER IF EXISTS trigger_update_officer_tier_badge ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_check_referral_qualification ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_protect_user_profiles ON public.user_profiles;
DROP TRIGGER IF EXISTS tr_protect_profile_fields ON public.user_profiles;
DROP TRIGGER IF EXISTS tr_protect_owner_admin ON public.user_profiles;

-- ===== RECREATE SAFE TRIGGERS =====

-- 1. Default troll coins for new users
CREATE OR REPLACE FUNCTION public.set_default_troll_coins()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.troll_coins IS NULL OR NEW.troll_coins < 500 THEN
    NEW.troll_coins := 500;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_default_troll_coins
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_troll_coins();

-- 2. Grant OG badge based on join date
CREATE OR REPLACE FUNCTION public.set_og_badge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_at < '2026-01-01'::timestamp THEN
    NEW.is_og_user := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assign_og_on_register
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_og_badge();

-- 3. Assign OG user status
CREATE OR REPLACE FUNCTION public.assign_og_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_at <= TIMESTAMPTZ '2025-12-31 23:59:59+00' THEN
    NEW.is_og_user := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assign_og_user
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_og_user();

-- 4. Set OG status for new users
CREATE OR REPLACE FUNCTION public.set_og_status_for_new_users()
RETURNS TRIGGER AS $$
BEGIN
  IF is_og_period_active() THEN
    NEW.is_og_user = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_og_status
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_og_status_for_new_users();

-- 5. Sync troll role
CREATE OR REPLACE FUNCTION public.sync_troll_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS NOT NULL THEN
    NEW.troll_role := NEW.role;
  ELSIF NEW.troll_role IS NOT NULL THEN
    NEW.role := NEW.troll_role;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_troll_role
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_troll_role();

CREATE TRIGGER trigger_sync_troll_role
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_troll_role();

-- 6. Auto-grant admin/officer status
CREATE OR REPLACE FUNCTION public.auto_grant_admin_officer_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'admin' OR NEW.is_admin = TRUE THEN
    NEW.is_troll_officer := TRUE;
    NEW.is_officer_active := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_grant_admin_officer
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_grant_admin_officer_status();

-- 7. Protect sensitive columns
CREATE OR REPLACE FUNCTION public.protect_sensitive_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'service_role' OR auth.role() = 'supabase_admin' THEN
    RETURN NEW;
  END IF;
  IF session_user != current_user THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'user_profiles' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot update restricted column: role';
    END IF;
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Cannot update restricted column: is_admin';
    END IF;
    IF NEW.is_lead_officer IS DISTINCT FROM OLD.is_lead_officer THEN
      RAISE EXCEPTION 'Cannot update restricted column: is_lead_officer';
    END IF;
    IF NEW.troll_coins IS DISTINCT FROM OLD.troll_coins THEN
      RAISE EXCEPTION 'Cannot update restricted column: troll_coins';
    END IF;
    IF NEW.total_earned_coins IS DISTINCT FROM OLD.total_earned_coins THEN
      RAISE EXCEPTION 'Cannot update restricted column: total_earned_coins';
    END IF;
    IF NEW.level IS DISTINCT FROM OLD.level THEN
      RAISE EXCEPTION 'Cannot update restricted column: level';
    END IF;
    IF NEW.xp IS DISTINCT FROM OLD.xp THEN
      RAISE EXCEPTION 'Cannot update restricted column: xp';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_protect_user_profiles
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_columns();

-- 8. Log user moderation
CREATE OR REPLACE FUNCTION public.log_user_moderation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_banned IS DISTINCT FROM NEW.is_banned THEN
    INSERT INTO public.moderation_actions (
      user_id,
      action_type,
      reason,
      metadata,
      created_at
    ) VALUES (
      NEW.id,
      CASE WHEN NEW.is_banned THEN 'ban' ELSE 'unban' END,
      'Automatic ban state change',
      jsonb_build_object(
        'old_is_banned', OLD.is_banned,
        'new_is_banned', NEW.is_banned,
        'trigger', 'log_user_moderation'
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_user_moderation
  AFTER UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_user_moderation();

-- 9. Update officer tier badge
CREATE OR REPLACE FUNCTION public.update_officer_tier_badge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.officer_level IS NOT NULL THEN
    NEW.officer_tier_badge := CASE
      WHEN NEW.officer_level = 1 THEN 'blue'
      WHEN NEW.officer_level = 2 THEN 'orange'
      WHEN NEW.officer_level = 3 THEN 'red'
      WHEN NEW.officer_level = 4 THEN 'purple'
      WHEN NEW.officer_level = 5 THEN 'gold'
      ELSE 'blue'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_officer_tier_badge
  BEFORE INSERT OR UPDATE OF officer_level ON public.user_profiles
  FOR EACH ROW
  WHEN ((NEW.is_troll_officer = true) OR (NEW.role = 'troll_officer'::text))
  EXECUTE FUNCTION public.update_officer_tier_badge();

-- 10. Auto-remove verification on ban
CREATE OR REPLACE FUNCTION public.auto_remove_verification_on_ban()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_banned = true AND OLD.is_banned IS DISTINCT FROM NEW.is_banned THEN
    NEW.is_verified := false;
    NEW.verified_until := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_remove_verification
  AFTER UPDATE OF is_banned, ban_expires_at ON public.user_profiles
  FOR EACH ROW
  WHEN ((NEW.is_banned = true) AND (NEW.ban_expires_at IS NULL))
  EXECUTE FUNCTION public.auto_remove_verification_on_ban();

-- 11. Auto-upgrade influencer tier
CREATE OR REPLACE FUNCTION public.auto_upgrade_influencer_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_verified = true AND OLD.is_verified IS DISTINCT FROM NEW.is_verified THEN
    NEW.verified_creator := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_upgrade_influencer
  AFTER UPDATE OF is_verified ON public.user_profiles
  FOR EACH ROW
  WHEN (NEW.is_verified = true)
  EXECUTE FUNCTION public.auto_upgrade_influencer_tier();

-- 12. Sync trollstown coins (only when troll_coins changes)
CREATE OR REPLACE FUNCTION public.sync_trollstown_coins_from_profiles()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.trollstown_properties
  SET troll_coins = NEW.troll_coins
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_trollstown_coins
  AFTER UPDATE OF troll_coins ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_trollstown_coins_from_profiles();

-- 13. Prevent profile privilege escalation
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;
  IF NEW.broadcasting_disabled IS DISTINCT FROM OLD.broadcasting_disabled THEN
    NEW.broadcasting_disabled := OLD.broadcasting_disabled;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_hr_field_changes_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 14. Protect owner/admin changes
CREATE OR REPLACE FUNCTION public.protect_owner_admin_changes()
RETURNS TRIGGER AS $$
DECLARE
  owner_email TEXT := 'Mai Troll2025@gmail.com';
  target_is_owner BOOLEAN;
  actor_is_owner BOOLEAN;
BEGIN
  target_is_owner := (OLD.email IS NOT NULL AND LOWER(OLD.email) = owner_email);
  IF target_is_owner THEN
    actor_is_owner := (auth.uid() = OLD.id);
    IF NOT actor_is_owner THEN
      IF NEW.role != 'admin' THEN
        RAISE EXCEPTION 'CRITICAL: You cannot remove Admin privileges from the Owner account.';
      END IF;
      IF NEW.is_admin = false THEN
        RAISE EXCEPTION 'CRITICAL: You cannot remove Admin privileges from the Owner account.';
      END IF;
      IF NEW.email IS NULL OR LOWER(NEW.email) != owner_email THEN
        RAISE EXCEPTION 'CRITICAL: You cannot change the Owner email address.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_protect_owner_admin
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_owner_admin_changes();

-- 15. Grant OG badge
CREATE OR REPLACE FUNCTION public.grant_og_badge()
RETURNS TRIGGER AS $$
BEGIN
  IF CURRENT_DATE < '2026-01-01' THEN
    NEW.og_badge = true;
  ELSE
    IF NEW.created_at < '2026-01-01' THEN
      NEW.og_badge = true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_grant_og_badge
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_og_badge();

-- ===== GRANT PERMISSIONS =====
GRANT ALL ON FUNCTION public.set_default_troll_coins() TO authenticated;
GRANT ALL ON FUNCTION public.set_og_badge() TO authenticated;
GRANT ALL ON FUNCTION public.assign_og_user() TO authenticated;
GRANT ALL ON FUNCTION public.set_og_status_for_new_users() TO authenticated;
GRANT ALL ON FUNCTION public.sync_troll_role() TO authenticated;
GRANT ALL ON FUNCTION public.auto_grant_admin_officer_status() TO authenticated;
GRANT ALL ON FUNCTION public.protect_sensitive_columns() TO authenticated;
GRANT ALL ON FUNCTION public.log_user_moderation() TO authenticated;
GRANT ALL ON FUNCTION public.update_officer_tier_badge() TO authenticated;
GRANT ALL ON FUNCTION public.auto_remove_verification_on_ban() TO authenticated;
GRANT ALL ON FUNCTION public.auto_upgrade_influencer_tier() TO authenticated;
GRANT ALL ON FUNCTION public.sync_trollstown_coins_from_profiles() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_profile_privilege_escalation() TO authenticated;
GRANT ALL ON FUNCTION public.protect_owner_admin_changes() TO authenticated;
GRANT ALL ON FUNCTION public.grant_og_badge() TO authenticated;
