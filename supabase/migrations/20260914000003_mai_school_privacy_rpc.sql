-- MAi School Privacy RPC Functions
-- Phase 1: FERPA & Student Privacy

-- Get institution privacy settings (creates default row if missing)
CREATE OR REPLACE FUNCTION get_institution_privacy_settings(
  p_institution_id UUID
)
RETURNS institution_privacy_settings AS $$
DECLARE
  v_settings institution_privacy_settings;
BEGIN
  SELECT * INTO v_settings
  FROM institution_privacy_settings
  WHERE institution_id = p_institution_id;

  IF v_settings IS NULL THEN
    INSERT INTO institution_privacy_settings (institution_id)
    VALUES (p_institution_id)
    RETURNING * INTO v_settings;
  END IF;

  RETURN v_settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update institution privacy settings (staff only)
CREATE OR REPLACE FUNCTION update_institution_privacy_settings(
  p_institution_id UUID,
  p_ferpa_mode_enabled BOOLEAN DEFAULT NULL,
  p_restricted_mode BOOLEAN DEFAULT NULL,
  p_require_parental_consent BOOLEAN DEFAULT NULL,
  p_minor_age_threshold INTEGER DEFAULT NULL,
  p_allow_student_opt_out BOOLEAN DEFAULT NULL,
  p_audit_data_access BOOLEAN DEFAULT NULL,
  p_require_annual_privacy_agreement BOOLEAN DEFAULT NULL,
  p_privacy_agreement_version TEXT DEFAULT NULL,
  p_compliance_notes TEXT DEFAULT NULL
)
RETURNS institution_privacy_settings AS $$
DECLARE
  v_settings institution_privacy_settings;
BEGIN
  PERFORM get_institution_privacy_settings(p_institution_id);

  UPDATE institution_privacy_settings
  SET
    ferpa_mode_enabled = COALESCE(p_ferpa_mode_enabled, ferpa_mode_enabled),
    restricted_mode = COALESCE(p_restricted_mode, restricted_mode),
    require_parental_consent = COALESCE(p_require_parental_consent, require_parental_consent),
    minor_age_threshold = COALESCE(p_minor_age_threshold, minor_age_threshold),
    allow_student_opt_out = COALESCE(p_allow_student_opt_out, allow_student_opt_out),
    audit_data_access = COALESCE(p_audit_data_access, audit_data_access),
    require_annual_privacy_agreement = COALESCE(p_require_annual_privacy_agreement, require_annual_privacy_agreement),
    privacy_agreement_version = COALESCE(p_privacy_agreement_version, privacy_agreement_version),
    compliance_notes = COALESCE(p_compliance_notes, compliance_notes),
    updated_at = now()
  WHERE institution_id = p_institution_id
  RETURNING * INTO v_settings;

  RETURN v_settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sign an instructor privacy agreement
CREATE OR REPLACE FUNCTION sign_instructor_privacy_agreement(
  p_institution_id UUID,
  p_agreement_version TEXT DEFAULT NULL
)
RETURNS instructor_privacy_agreements AS $$
DECLARE
  v_agreement instructor_privacy_agreements;
  v_version TEXT;
BEGIN
  IF p_agreement_version IS NULL THEN
    SELECT privacy_agreement_version INTO v_version
    FROM institution_privacy_settings
    WHERE institution_id = p_institution_id;
    v_version := COALESCE(v_version, '1.0');
  ELSE
    v_version := p_agreement_version;
  END IF;

  INSERT INTO instructor_privacy_agreements (
    institution_id, instructor_user_id, agreement_version, status, signed_at
  )
  VALUES (
    p_institution_id, auth.uid(), v_version, 'signed', now()
  )
  ON CONFLICT (institution_id, instructor_user_id, agreement_version)
  DO UPDATE SET status = 'signed', signed_at = now(), updated_at = now()
  RETURNING * INTO v_agreement;

  RETURN v_agreement;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get instructor's privacy agreement status
CREATE OR REPLACE FUNCTION get_instructor_privacy_agreement_status(
  p_institution_id UUID
)
RETURNS TABLE (
  agreement_version TEXT,
  status TEXT,
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ipa.agreement_version,
    ipa.status,
    ipa.signed_at,
    ipa.expires_at
  FROM instructor_privacy_agreements ipa
  WHERE ipa.institution_id = p_institution_id
    AND ipa.instructor_user_id = auth.uid()
  ORDER BY ipa.signed_at DESC NULLS LAST
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log a data access event (append-only audit trail)
CREATE OR REPLACE FUNCTION log_data_access(
  p_viewed_user_id UUID,
  p_institution_id UUID,
  p_action TEXT,
  p_description TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS data_access_audit_log AS $$
DECLARE
  v_log data_access_audit_log;
BEGIN
  INSERT INTO data_access_audit_log (
    viewer_user_id, viewed_user_id, institution_id,
    action, description, source, ip_address, user_agent
  )
  VALUES (
    auth.uid(), p_viewed_user_id, p_institution_id,
    p_action, p_description, p_source, p_ip_address, p_user_agent
  )
  RETURNING * INTO v_log;

  RETURN v_log;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get data access audit log for an institution (staff/admin only)
CREATE OR REPLACE FUNCTION get_data_access_audit_log(
  p_institution_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  viewer_user_id UUID,
  viewed_user_id UUID,
  action TEXT,
  description TEXT,
  source TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dal.id, dal.viewer_user_id, dal.viewed_user_id,
    dal.action, dal.description, dal.source, dal.created_at
  FROM data_access_audit_log dal
  WHERE dal.institution_id = p_institution_id
  ORDER BY dal.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check whether an instructor has a signed privacy agreement for the current version
CREATE OR REPLACE FUNCTION instructor_has_signed_privacy_agreement(
  p_institution_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_version TEXT;
  v_signed BOOLEAN;
BEGIN
  SELECT privacy_agreement_version INTO v_current_version
  FROM institution_privacy_settings
  WHERE institution_id = p_institution_id;

  v_current_version := COALESCE(v_current_version, '1.0');

  SELECT EXISTS (
    SELECT 1 FROM instructor_privacy_agreements
    WHERE institution_id = p_institution_id
      AND instructor_user_id = auth.uid()
      AND agreement_version = v_current_version
      AND status = 'signed'
  ) INTO v_signed;

  RETURN COALESCE(v_signed, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
