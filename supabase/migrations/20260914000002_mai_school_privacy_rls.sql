-- MAi School Privacy Tables RLS Policies
-- Date: 2026-09-14
-- Phase 1: FERPA & Student Privacy

ALTER TABLE institution_privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_privacy_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_audit_log ENABLE ROW LEVEL SECURITY;

-- Institution privacy settings: staff/admin manage, everyone in institution reads
DROP POLICY IF EXISTS "staff_manage_privacy_settings" ON institution_privacy_settings;
CREATE POLICY "staff_manage_privacy_settings" ON institution_privacy_settings
    FOR ALL USING (
        institution_id IN (
            SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "institution_read_privacy_settings" ON institution_privacy_settings;
CREATE POLICY "institution_read_privacy_settings" ON institution_privacy_settings
    FOR SELECT USING (
        institution_id IN (
            SELECT institution_id FROM institution_members WHERE user_id = auth.uid()
        ) OR
        institution_id IN (
            SELECT institution_id FROM instructor_profiles WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "admin_all_privacy_settings" ON institution_privacy_settings;
CREATE POLICY "admin_all_privacy_settings" ON institution_privacy_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Instructor privacy agreements: own record, institution peers (signed status only), staff manage
DROP POLICY IF EXISTS "instructor_read_own_agreement" ON instructor_privacy_agreements;
CREATE POLICY "instructor_read_own_agreement" ON instructor_privacy_agreements
    FOR SELECT USING (auth.uid() = instructor_user_id);

DROP POLICY IF EXISTS "instructor_read_institution_agreements" ON instructor_privacy_agreements;
CREATE POLICY "instructor_read_institution_agreements" ON instructor_privacy_agreements
    FOR SELECT USING (
        institution_id IN (
            SELECT institution_id FROM instructor_profiles WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "staff_manage_privacy_agreements" ON instructor_privacy_agreements;
CREATE POLICY "staff_manage_privacy_agreements" ON instructor_privacy_agreements
    FOR ALL USING (
        institution_id IN (
            SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "admin_all_privacy_agreements" ON instructor_privacy_agreements;
CREATE POLICY "admin_all_privacy_agreements" ON instructor_privacy_agreements
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Data access audit log: staff/admin read for their institution, system inserts via RPC only
DROP POLICY IF EXISTS "staff_read_audit_log" ON data_access_audit_log;
CREATE POLICY "staff_read_audit_log" ON data_access_audit_log
    FOR SELECT USING (
        institution_id IN (
            SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "admin_read_audit_log" ON data_access_audit_log;
CREATE POLICY "admin_read_audit_log" ON data_access_audit_log
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Audit log is append-only from the client perspective: inserts are performed by
-- SECURITY DEFINER RPCs, so no direct client INSERT is permitted.
DROP POLICY IF EXISTS "no_direct_audit_insert" ON data_access_audit_log;
CREATE POLICY "no_direct_audit_insert" ON data_access_audit_log
    FOR INSERT WITH CHECK (false);