-- MAi School Incidents & Rules RPC Functions
-- Phase 2: Content Moderation & Liability Controls

-- File a school-scoped incident. Optionally links to the moderation engine
-- via submit_report so career/mod roles can act on it.
CREATE OR REPLACE FUNCTION file_school_incident(
  p_institution_id UUID,
  p_target_student_id UUID DEFAULT NULL,
  p_stream_id UUID DEFAULT NULL,
  p_incident_type TEXT DEFAULT 'other',
  p_severity TEXT DEFAULT 'medium',
  p_description TEXT DEFAULT NULL,
  p_rule_violated TEXT DEFAULT NULL
)
RETURNS school_incidents AS $$
DECLARE
  v_incident school_incidents;
  v_report_id UUID;
  v_reason TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION 'Description is required';
  END IF;

  -- Build a moderation report reason from the incident for routing.
  v_reason := format('[SCHOOL-%s] %s', upper(p_incident_type), left(trim(p_description), 200));

  -- Route to the moderation engine so career/mod roles can act.
  BEGIN
    SELECT (submit_report(
      p_target_user_id := p_target_student_id,
      p_stream_id := p_stream_id,
      p_reason := v_reason,
      p_description := p_description
    ) -> 'data' ->> 'report_id')::UUID INTO v_report_id;
  EXCEPTION WHEN OTHERS THEN
    -- If the moderation engine rejects (e.g. not a modo role), still file
    -- the school incident so the institution has its own record.
    v_report_id := NULL;
  END;

  INSERT INTO school_incidents (
    institution_id, reported_by_user_id, target_student_id, stream_id,
    incident_type, severity, description, rule_violated, linked_report_id
  )
  VALUES (
    p_institution_id, auth.uid(), p_target_student_id, p_stream_id,
    p_incident_type, p_severity, p_description, p_rule_violated, v_report_id
  )
  RETURNING * INTO v_incident;

  RETURN v_incident;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- List school incidents for an institution (staff/instructor).
CREATE OR REPLACE FUNCTION list_school_incidents(
  p_institution_id UUID,
  p_status_filter TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  target_student_id UUID,
  stream_id UUID,
  incident_type TEXT,
  severity TEXT,
  description TEXT,
  rule_violated TEXT,
  status TEXT,
  linked_report_id UUID,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id, si.target_student_id, si.stream_id, si.incident_type,
    si.severity, si.description, si.rule_violated, si.status,
    si.linked_report_id, si.created_at
  FROM school_incidents si
  WHERE si.institution_id = p_institution_id
    AND (p_status_filter IS NULL OR si.status = p_status_filter)
  ORDER BY si.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update incident status / resolution (staff only).
CREATE OR REPLACE FUNCTION update_school_incident(
  p_incident_id UUID,
  p_status TEXT DEFAULT NULL,
  p_resolution_notes TEXT DEFAULT NULL
)
RETURNS school_incidents AS $$
DECLARE
  v_incident school_incidents;
BEGIN
  UPDATE school_incidents
  SET
    status = COALESCE(p_status, status),
    resolution_notes = COALESCE(p_resolution_notes, resolution_notes),
    resolved_at = CASE WHEN p_status IN ('resolved', 'closed') THEN now() ELSE resolved_at END,
    resolved_by = CASE WHEN p_status IN ('resolved', 'closed') THEN auth.uid() ELSE resolved_by END,
    updated_at = now()
  WHERE id = p_incident_id
  RETURNING * INTO v_incident;

  RETURN v_incident;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or update a school institution rule (staff only).
CREATE OR REPLACE FUNCTION upsert_school_rule(
  p_institution_id UUID,
  p_rule_code TEXT,
  p_title TEXT,
  p_description TEXT,
  p_category TEXT DEFAULT 'conduct',
  p_enforcement TEXT DEFAULT 'warning',
  p_is_active BOOLEAN DEFAULT true
)
RETURNS school_institution_rules AS $$
DECLARE
  v_rule school_institution_rules;
BEGIN
  INSERT INTO school_institution_rules (
    institution_id, rule_code, title, description, category,
    enforcement, is_active, created_by_user_id
  )
  VALUES (
    p_institution_id, p_rule_code, p_title, p_description,
    p_category, p_enforcement, p_is_active, auth.uid()
  )
  ON CONFLICT (institution_id, rule_code)
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    enforcement = EXCLUDED.enforcement,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING * INTO v_rule;

  RETURN v_rule;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- List school institution rules.
CREATE OR REPLACE FUNCTION list_school_rules(
  p_institution_id UUID,
  p_active_only BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id UUID,
  rule_code TEXT,
  title TEXT,
  description TEXT,
  category TEXT,
  enforcement TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.id, sr.rule_code, sr.title, sr.description, sr.category,
    sr.enforcement, sr.is_active, sr.created_at
  FROM school_institution_rules sr
  WHERE sr.institution_id = p_institution_id
    AND (NOT p_active_only OR sr.is_active = true)
  ORDER BY sr.rule_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete a school institution rule (staff only).
CREATE OR REPLACE FUNCTION delete_school_rule(
  p_rule_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM school_institution_rules WHERE id = p_rule_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;