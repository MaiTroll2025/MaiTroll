-- ============================================================================
-- FAST PAY PROGRAM - Database Migration
-- ============================================================================
-- Adds Fast Pay tier tracking, eligibility requirements, and payout speed
-- configuration to the cashout system.
--
-- Tier Structure:
--   Level 1-499:   Standard Payout  • Paid every Friday
--   Level 500-999:  Fast Pay         • Request Every 24 Hrs • Processed within 24h
--   Level 1000+:    Instant Pay      • Instant • Every 60 Minutes • Priority
--
-- NOTE: User level is derived from xp_ledger (via user_profiles.total_xp) and
--       stored in user_stats by the grant_xp → calculate_level_details pipeline.
--       The frontend store syncs user_stats.level → profile.level on fetch.
--       At the DB level we read from user_stats (source of truth for level).
-- ============================================================================

-- ============================================================================
-- 1. Add Fast Pay columns to user_profiles
-- ============================================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS fast_pay_tier text NOT NULL DEFAULT 'standard'
    CHECK (fast_pay_tier IN ('standard', 'fast_pay', 'instant'));

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS fast_pay_eligible boolean NOT NULL DEFAULT false;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS fast_pay_identity_verified boolean NOT NULL DEFAULT false;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS fast_pay_no_violations boolean NOT NULL DEFAULT true;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS fast_pay_good_standing boolean NOT NULL DEFAULT true;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS fast_pay_no_fraud_history boolean NOT NULL DEFAULT true;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS fast_pay_cashouts_this_week int NOT NULL DEFAULT 0;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS fast_pay_last_cashout_at timestamptz;

-- ============================================================================
-- 2. Create fast_pay_config table for admin-configurable settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS fast_pay_config (
  id int PRIMARY KEY DEFAULT 1,
  standard_min_level int NOT NULL DEFAULT 1,
  standard_max_level int NOT NULL DEFAULT 499,
  standard_payout_day text NOT NULL DEFAULT 'Friday',
  fast_pay_min_level int NOT NULL DEFAULT 500,
  fast_pay_max_level int NOT NULL DEFAULT 999,
  fast_pay_max_cashouts_per_week int NOT NULL DEFAULT 3,
  fast_pay_processing_hours int NOT NULL DEFAULT 24,
  instant_min_level int NOT NULL DEFAULT 1000,
  instant_max_cashouts_per_week int NOT NULL DEFAULT 5,
  fee_percent numeric(4,2) NOT NULL DEFAULT 2.90,
  min_account_age_days int NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Insert default config
INSERT INTO fast_pay_config (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. Create fast_pay_audit_log for tracking tier changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS fast_pay_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  old_tier text,
  new_tier text NOT NULL,
  reason text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_fast_pay_audit_user_id ON fast_pay_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_fast_pay_audit_created_at ON fast_pay_audit_log(created_at DESC);

-- ============================================================================
-- 4. Function: Calculate and update Fast Pay tier
--    Reads level from user_stats (source of truth for XP/level)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_fast_pay_tier(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level int;
  v_old_tier text;
  v_new_tier text;
  v_account_age_days int;
  v_is_eligible boolean;
  v_profile_exists boolean;
BEGIN
  -- Get user level from user_stats (source of truth for XP/level)
  -- Falls back to user_profiles.level if no user_stats row exists
  SELECT COALESCE(us.level, up.level, 1) INTO v_level
  FROM user_profiles up
  LEFT JOIN user_stats us ON us.user_id = up.id
  WHERE up.id = p_user_id;

  IF v_level IS NULL THEN
    RETURN 'standard';
  END IF;

  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = p_user_id) INTO v_profile_exists;
  IF NOT v_profile_exists THEN
    RETURN 'standard';
  END IF;

  -- Get current tier
  SELECT fast_pay_tier INTO v_old_tier
  FROM user_profiles
  WHERE id = p_user_id;

  -- Determine new tier based on level (thresholds match fast_pay_config)
  IF v_level >= 1000 THEN
    v_new_tier := 'instant';
  ELSIF v_level >= 500 THEN
    v_new_tier := 'fast_pay';
  ELSE
    v_new_tier := 'standard';
  END IF;

  -- Check eligibility requirements
  SELECT
    COALESCE(fast_pay_identity_verified, false)
    AND COALESCE(fast_pay_no_violations, true)
    AND COALESCE(fast_pay_good_standing, true)
    AND COALESCE(fast_pay_no_fraud_history, true)
    AND (EXTRACT(DAY FROM now() - created_at) >= 30)
  INTO v_is_eligible
  FROM user_profiles
  WHERE id = p_user_id;

  -- For standard tier, eligibility doesn't matter
  IF v_new_tier = 'standard' THEN
    v_is_eligible := false;
  END IF;

  -- Update profile
  UPDATE user_profiles
  SET
    fast_pay_tier = v_new_tier,
    fast_pay_eligible = v_is_eligible
  WHERE id = p_user_id;

  -- Log tier change if different
  IF v_old_tier IS DISTINCT FROM v_new_tier THEN
    INSERT INTO fast_pay_audit_log (user_id, old_tier, new_tier, reason, changed_by)
    VALUES (p_user_id, v_old_tier, v_new_tier, 'Level-based tier update', p_user_id);
  END IF;

  RETURN v_new_tier;
END;
$$;

-- ============================================================================
-- 5. Function: Get Fast Pay eligibility details for a user
--    Reads level from user_stats (source of truth)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_fast_pay_eligibility(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile user_profiles;
  v_config fast_pay_config;
  v_level int;
  v_account_age_days int;
  v_result json;
BEGIN
  -- Get profile
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_profile IS NULL THEN
    RETURN json_build_object(
      'tier', 'standard',
      'eligible', false,
      'requirements', json_build_object(
        'verifiedIdentity', false,
        'noActiveViolations', false,
        'accountOlderThan30Days', false,
        'goodStanding', false,
        'noFraudChargeback', false
      ),
      'unmetRequirements', ARRAY['User not found']
    );
  END IF;

  -- Get level from user_stats (source of truth), fallback to profile
  SELECT COALESCE(us.level, v_profile.level, 1) INTO v_level
  FROM user_stats us
  WHERE us.user_id = p_user_id;

  IF v_level IS NULL THEN
    v_level := COALESCE(v_profile.level, 1);
  END IF;

  -- Get config
  SELECT * INTO v_config FROM fast_pay_config WHERE id = 1;

  -- Calculate account age
  v_account_age_days := EXTRACT(DAY FROM now() - v_profile.created_at);

  -- Build result
  v_result := json_build_object(
    'tier', v_profile.fast_pay_tier,
    'eligible', v_profile.fast_pay_eligible,
    'level', v_level,
    'requirements', json_build_object(
      'verifiedIdentity', COALESCE(v_profile.fast_pay_identity_verified, false),
      'noActiveViolations', COALESCE(v_profile.fast_pay_no_violations, true),
      'accountOlderThan30Days', v_account_age_days >= v_config.min_account_age_days,
      'goodStanding', COALESCE(v_profile.fast_pay_good_standing, true),
      'noFraudChargeback', COALESCE(v_profile.fast_pay_no_fraud_history, true)
    ),
    'unmetRequirements', (
      SELECT array_agg(req)
      FROM unnest(ARRAY[
        CASE WHEN NOT COALESCE(v_profile.fast_pay_identity_verified, false) THEN 'Verify your identity' END,
        CASE WHEN NOT COALESCE(v_profile.fast_pay_no_violations, true) THEN 'Resolve active violations' END,
        CASE WHEN v_account_age_days < v_config.min_account_age_days THEN 'Account must be ' || v_config.min_account_age_days || ' days old' END,
        CASE WHEN NOT COALESCE(v_profile.fast_pay_good_standing, true) THEN 'Maintain good community standing' END,
        CASE WHEN NOT COALESCE(v_profile.fast_pay_no_fraud_history, true) THEN 'Resolve fraud/chargeback issues' END
      ]) AS req
      WHERE req IS NOT NULL
    ),
    'feePercent', v_config.fee_percent,
    'maxCashoutsPerWeek', CASE
      WHEN v_profile.fast_pay_tier = 'instant' THEN v_config.instant_max_cashouts_per_week
      WHEN v_profile.fast_pay_tier = 'fast_pay' THEN v_config.fast_pay_max_cashouts_per_week
      ELSE 1
    END,
    'cashoutsThisWeek', COALESCE(v_profile.fast_pay_cashouts_this_week, 0),
    'processingTime', CASE
      WHEN v_profile.fast_pay_tier = 'instant' THEN 'Instant'
      WHEN v_profile.fast_pay_tier = 'fast_pay' THEN 'Within 5 Minutes'
      ELSE 'Every Friday'
    END
  );

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 6. Function: Reset weekly cashout counters (run via cron every Monday)
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_fast_pay_weekly_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_profiles
  SET fast_pay_cashouts_this_week = 0
  WHERE fast_pay_cashouts_this_week > 0;
END;
$$;

-- ============================================================================
-- 7. Function: Increment cashout counter on payout request
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_fast_pay_cashout_counter(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
  v_current_count int;
  v_max_allowed int;
  v_config fast_pay_config;
BEGIN
  -- Get config
  SELECT * INTO v_config FROM fast_pay_config WHERE id = 1;

  -- Get user tier and current count
  SELECT fast_pay_tier, COALESCE(fast_pay_cashouts_this_week, 0)
  INTO v_tier, v_current_count
  FROM user_profiles
  WHERE id = p_user_id;

  -- Standard tier always allowed (Friday gating handled elsewhere)
  IF v_tier = 'standard' THEN
    UPDATE user_profiles
    SET
      fast_pay_cashouts_this_week = COALESCE(fast_pay_cashouts_this_week, 0) + 1,
      fast_pay_last_cashout_at = now()
    WHERE id = p_user_id;
    RETURN true;
  END IF;

  -- Determine max allowed
  v_max_allowed := CASE
    WHEN v_tier = 'instant' THEN v_config.instant_max_cashouts_per_week
    WHEN v_tier = 'fast_pay' THEN v_config.fast_pay_max_cashouts_per_week
    ELSE 1
  END;

  -- Check limit
  IF v_current_count >= v_max_allowed THEN
    RETURN false;
  END IF;

  -- Increment counter
  UPDATE user_profiles
  SET
    fast_pay_cashouts_this_week = COALESCE(fast_pay_cashouts_this_week, 0) + 1,
    fast_pay_last_cashout_at = now()
  WHERE id = p_user_id;

  RETURN true;
END;
$$;

-- ============================================================================
-- 8. Triggers: Auto-update Fast Pay tier when level changes
--
--    IMPORTANT: Level lives in user_stats (source of truth), NOT user_profiles.
--    The frontend store syncs user_stats → user_profiles on fetch, but for
--    DB-level reactivity we need a trigger on user_stats.
-- ============================================================================

-- Trigger function for user_stats changes
CREATE OR REPLACE FUNCTION trigger_update_fast_pay_tier_from_stats()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only update if level actually changed
  IF OLD.level IS DISTINCT FROM NEW.level THEN
    PERFORM update_fast_pay_tier(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_fast_pay_tier_from_stats ON user_stats;
CREATE TRIGGER trg_update_fast_pay_tier_from_stats
  AFTER UPDATE OF level ON user_stats
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_fast_pay_tier_from_stats();

-- Safety-net trigger on user_profiles (in case level is updated directly)
CREATE OR REPLACE FUNCTION trigger_update_fast_pay_tier_from_profile()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.level IS DISTINCT FROM NEW.level THEN
    PERFORM update_fast_pay_tier(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_fast_pay_tier_from_profile ON user_profiles;
CREATE TRIGGER trg_update_fast_pay_tier_from_profile
  AFTER UPDATE OF level ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_fast_pay_tier_from_profile();

-- ============================================================================
-- 9. RLS Policies for fast_pay_config (admin only)
-- ============================================================================

ALTER TABLE fast_pay_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read fast_pay_config" ON fast_pay_config;
CREATE POLICY "Admins can read fast_pay_config" ON fast_pay_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'secretary')
    )
  );

DROP POLICY IF EXISTS "Admins can update fast_pay_config" ON fast_pay_config;
CREATE POLICY "Admins can update fast_pay_config" ON fast_pay_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin')
    )
  );

-- ============================================================================
-- 10. RLS Policies for fast_pay_audit_log
-- ============================================================================

ALTER TABLE fast_pay_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own audit log" ON fast_pay_audit_log;
CREATE POLICY "Users can read own audit log" ON fast_pay_audit_log
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all audit logs" ON fast_pay_audit_log;
CREATE POLICY "Admins can read all audit logs" ON fast_pay_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin', 'secretary')
    )
  );

DROP POLICY IF EXISTS "System can insert audit logs" ON fast_pay_audit_log;
CREATE POLICY "System can insert audit logs" ON fast_pay_audit_log
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 11. Initialize existing users with correct Fast Pay tier
--    (reads from user_stats for accurate level)
-- ============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM user_profiles LOOP
    PERFORM update_fast_pay_tier(r.id);
  END LOOP;
END;
$$;
