-- ============================================================
-- Rate Limiting: Report Submission
-- Prevents spam reporting that could harass users or overwhelm moderation
--
-- Fixes applied:
--   1. Uses NEW.reporter_id instead of auth.uid() (handles service_role inserts)
--   2. Staff/admin exemption (moderators testing workflows won't hit limits)
--   3. Duplicate report protection (prevents harassment reporting same user)
--   4. Idempotent trigger recreation (DROP TRIGGER IF EXISTS)
--   5. SECURITY DEFINER + search_path = public
--   6. Indexes matching query pattern
-- ============================================================

-- ============================================================
-- moderation_reports rate limiting
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_report_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Staff/admin exemption: moderators testing workflows bypass rate limits
  IF EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = NEW.reporter_id
    AND (is_admin = true OR is_troll_officer = true OR role IN ('admin', 'secretary'))
  ) THEN
    RETURN NEW;
  END IF;

  -- Duplicate report protection: prevent harassment reporting same user within 24h
  IF EXISTS (
    SELECT 1 FROM moderation_reports
    WHERE reporter_id = NEW.reporter_id
    AND reported_user_id = NEW.reported_user_id
    AND created_at > now() - interval '24 hours'
  ) THEN
    RAISE EXCEPTION 'You already reported this user recently. Please wait 24 hours before reporting again.'
    USING ERRCODE = 'P0001';
  END IF;

  -- Rate limit: max 10 reports per hour per user
  -- Uses NEW.reporter_id (not auth.uid()) to handle service_role/admin inserts
  SELECT COUNT(*) INTO recent_count
  FROM moderation_reports
  WHERE reporter_id = NEW.reporter_id
  AND created_at > now() - interval '1 hour';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 10 reports per hour. Please wait before submitting another report.'
    USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Idempotent trigger recreation
DROP TRIGGER IF EXISTS trg_report_rate_limit ON moderation_reports;

CREATE TRIGGER trg_report_rate_limit
  BEFORE INSERT ON moderation_reports
  FOR EACH ROW
  EXECUTE FUNCTION enforce_report_rate_limit();

-- ============================================================
-- utromail_reports rate limiting
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_utromail_report_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Staff/admin exemption
  IF EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = NEW.reporter_id
    AND (is_admin = true OR is_troll_officer = true OR role IN ('admin', 'secretary'))
  ) THEN
    RETURN NEW;
  END IF;

  -- Duplicate report protection (uses reported_id column for utromail_reports)
  IF EXISTS (
    SELECT 1 FROM utromail_reports
    WHERE reporter_id = NEW.reporter_id
    AND reported_id = NEW.reported_id
    AND created_at > now() - interval '24 hours'
  ) THEN
    RAISE EXCEPTION 'You already reported this message recently. Please wait 24 hours before reporting again.'
    USING ERRCODE = 'P0001';
  END IF;

  -- Rate limit: max 10 reports per hour per user
  SELECT COUNT(*) INTO recent_count
  FROM utromail_reports
  WHERE reporter_id = NEW.reporter_id
  AND created_at > now() - interval '1 hour';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 10 reports per hour. Please wait before submitting another report.'
    USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Idempotent trigger recreation
DROP TRIGGER IF EXISTS trg_utromail_report_rate_limit ON utromail_reports;

CREATE TRIGGER trg_utromail_report_rate_limit
  BEFORE INSERT ON utromail_reports
  FOR EACH ROW
  EXECUTE FUNCTION enforce_utromail_report_rate_limit();

-- ============================================================
-- Indexes for rate limit query performance
-- Supports: WHERE reporter_id = ? AND created_at > now() - interval '1 hour'
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_moderation_reports_reporter_created
  ON moderation_reports(reporter_id, created_at);

CREATE INDEX IF NOT EXISTS idx_utromail_reports_reporter_created
  ON utromail_reports(reporter_id, created_at);

-- Index for duplicate report protection
-- Supports: WHERE reporter_id = ? AND reported_user_id = ? AND created_at > now() - interval '24 hours'
CREATE INDEX IF NOT EXISTS idx_moderation_reports_reporter_reported
  ON moderation_reports(reporter_id, reported_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_utromail_reports_reporter_reported
  ON utromail_reports(reporter_id, reported_id, created_at);
