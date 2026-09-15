-- MAi School Financial Tables RLS Policies
-- Phase 3: Financial Transparency & Liability Protection

ALTER TABLE student_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_financial_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;

-- Student earnings: students read own, institution staff/instructors read institution, system inserts via RPC
DROP POLICY IF EXISTS "student_read_own_earnings" ON student_earnings;
CREATE POLICY "student_read_own_earnings" ON student_earnings
    FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "institution_read_earnings" ON student_earnings;
CREATE POLICY "institution_read_earnings" ON student_earnings
    FOR SELECT USING (
        institution_id IN (
            SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
        ) OR
        institution_id IN (
            SELECT institution_id FROM instructor_profiles WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "system_insert_earnings" ON student_earnings;
CREATE POLICY "system_insert_earnings" ON student_earnings
    FOR INSERT WITH CHECK (false); -- inserts via SECURITY DEFINER RPCs only

DROP POLICY IF EXISTS "admin_all_earnings" ON student_earnings;
CREATE POLICY "admin_all_earnings" ON student_earnings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Institution financial logs: staff manage, institution reads
DROP POLICY IF EXISTS "staff_manage_financial_logs" ON institution_financial_logs;
CREATE POLICY "staff_manage_financial_logs" ON institution_financial_logs
    FOR ALL USING (
        institution_id IN (
            SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "institution_read_financial_logs" ON institution_financial_logs;
CREATE POLICY "institution_read_financial_logs" ON institution_financial_logs
    FOR SELECT USING (
        institution_id IN (
            SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
        ) OR
        institution_id IN (
            SELECT institution_id FROM instructor_profiles WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "admin_all_financial_logs" ON institution_financial_logs;
CREATE POLICY "admin_all_financial_logs" ON institution_financial_logs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Compliance reports: staff generate/read, institution reads
DROP POLICY IF EXISTS "staff_manage_compliance_reports" ON compliance_reports;
CREATE POLICY "staff_manage_compliance_reports" ON compliance_reports
    FOR ALL USING (
        institution_id IN (
            SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "institution_read_compliance_reports" ON compliance_reports;
CREATE POLICY "institution_read_compliance_reports" ON compliance_reports
    FOR SELECT USING (
        institution_id IN (
            SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
        ) OR
        institution_id IN (
            SELECT institution_id FROM instructor_profiles WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "admin_all_compliance_reports" ON compliance_reports;
CREATE POLICY "admin_all_compliance_reports" ON compliance_reports
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
