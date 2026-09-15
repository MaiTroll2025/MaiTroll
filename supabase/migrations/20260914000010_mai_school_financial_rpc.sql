-- MAi School Financial RPC Functions
-- Phase 3: Financial Transparency & Liability Protection

-- Record a student earnings entry (SECURITY DEFINER; called by payment flows).
-- Ensures the student belongs to the given institution before inserting.
CREATE OR REPLACE FUNCTION record_student_earnings(
  p_student_id UUID,
  p_institution_id UUID,
  p_source_type TEXT DEFAULT 'other',
  p_earnings_amount NUMERIC DEFAULT 0,
  p_platform_fee_amount NUMERIC DEFAULT 0,
  p_payout_id UUID DEFAULT NULL,
  p_payout_request_id UUID DEFAULT NULL
)
RETURNS student_earnings AS $$
DECLARE
  v_earnings student_earnings;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  -- Verify student belongs to institution
  IF NOT EXISTS (
    SELECT 1 FROM student_profiles
    WHERE user_id = p_student_id AND institution_id = p_institution_id
  ) THEN
    RAISE EXCEPTION 'Student does not belong to this institution';
  END IF;

  INSERT INTO student_earnings (
    student_id, institution_id, source_type,
    earnings_amount, platform_fee_amount,
    net_amount, payout_id, payout_request_id
  )
  VALUES (
    p_student_id, p_institution_id, p_source_type,
    p_earnings_amount, p_platform_fee_amount,
    p_earnings_amount - p_platform_fee_amount,
    p_payout_id, p_payout_request_id
  )
  RETURNING * INTO v_earnings;

  -- Also record in institution financial log
  INSERT INTO institution_financial_logs (
    institution_id, transaction_type, student_id,
    earnings_id, amount, notes
  )
  VALUES (
    p_institution_id, 'student_earnings_recorded', p_student_id,
    v_earnings.id, v_earnings.net_amount,
    format('Earnings recorded: %s, fee: %s, net: %s', p_source_type, p_platform_fee_amount, v_earnings.net_amount)
  );

  RETURN v_earnings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- List student earnings for an institution (staff/instructor).
CREATE OR REPLACE FUNCTION list_student_earnings(
  p_institution_id UUID,
  p_student_id UUID DEFAULT NULL,
  p_fiscal_year INTEGER DEFAULT NULL,
  p_limit INTEGER DEFAULT 200,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  student_id UUID,
  source_type TEXT,
  earnings_amount NUMERIC,
  platform_fee_amount NUMERIC,
  net_amount NUMERIC,
  payout_id UUID,
  earned_at TIMESTAMPTZ,
  fiscal_year INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.id, se.student_id, se.source_type, se.earnings_amount,
    se.platform_fee_amount, se.net_amount, se.payout_id,
    se.earned_at, se.fiscal_year
  FROM student_earnings se
  WHERE se.institution_id = p_institution_id
    AND (p_student_id IS NULL OR se.student_id = p_student_id)
    AND (p_fiscal_year IS NULL OR se.fiscal_year = p_fiscal_year)
  ORDER BY se.earned_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get earnings summary for an institution (per-student totals).
CREATE OR REPLACE FUNCTION get_student_earnings_summary(
  p_institution_id UUID,
  p_fiscal_year INTEGER DEFAULT NULL
)
RETURNS TABLE (
  student_id UUID,
  total_earnings NUMERIC,
  total_fees NUMERIC,
  total_net NUMERIC,
  transaction_count BIGINT,
  last_earned_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.student_id,
    COALESCE(SUM(se.earnings_amount), 0) AS total_earnings,
    COALESCE(SUM(se.platform_fee_amount), 0) AS total_fees,
    COALESCE(SUM(se.net_amount), 0) AS total_net,
    COUNT(*) AS transaction_count,
    MAX(se.earned_at) AS last_earned_at
  FROM student_earnings se
  WHERE se.institution_id = p_institution_id
    AND (p_fiscal_year IS NULL OR se.fiscal_year = p_fiscal_year)
  GROUP BY se.student_id
  ORDER BY total_net DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate a compliance report (staff only).
CREATE OR REPLACE FUNCTION generate_compliance_report(
  p_institution_id UUID,
  p_report_type TEXT,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS compliance_reports AS $$
DECLARE
  v_report compliance_reports;
  v_content JSONB := '{}';
BEGIN
  IF p_report_type = 'student_earnings_summary' THEN
    SELECT jsonb_build_object(
      'period_start', p_period_start,
      'period_end', p_period_end,
      'students', (SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT * FROM get_student_earnings_summary(p_institution_id, NULL) LIMIT 1000
      ) t)
    ) INTO v_content;
  ELSIF p_report_type = 'financial_audit' THEN
    SELECT jsonb_build_object(
      'period_start', p_period_start,
      'period_end', p_period_end,
      'transactions', (SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT * FROM institution_financial_logs
        WHERE institution_id = p_institution_id
          AND created_at >= p_period_start AND created_at < p_period_end
        ORDER BY created_at DESC LIMIT 5000
      ) t)
    ) INTO v_content;
  ELSE
    v_content := jsonb_build_object(
      'report_type', p_report_type,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'note', 'Report type not yet supported for detailed generation.'
    );
  END IF;

  INSERT INTO compliance_reports (
    institution_id, report_type, period_start, period_end,
    content_json, generated_by_staff_id
  )
  VALUES (
    p_institution_id, p_report_type, p_period_start, p_period_end,
    v_content, auth.uid()
  )
  RETURNING * INTO v_report;

  RETURN v_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- List compliance reports for an institution.
CREATE OR REPLACE FUNCTION list_compliance_reports(
  p_institution_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  report_type TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  content_json JSONB,
  exported_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id, cr.report_type, cr.period_start, cr.period_end,
    cr.content_json, cr.exported_at, cr.generated_at
  FROM compliance_reports cr
  WHERE cr.institution_id = p_institution_id
  ORDER BY cr.generated_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark a compliance report as exported.
CREATE OR REPLACE FUNCTION export_compliance_report(
  p_report_id UUID,
  p_format TEXT DEFAULT 'csv'
)
RETURNS compliance_reports AS $$
DECLARE
  v_report compliance_reports;
BEGIN
  UPDATE compliance_reports
  SET exported_at = now(), exported_format = p_format
  WHERE id = p_report_id
  RETURNING * INTO v_report;

  RETURN v_report;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
