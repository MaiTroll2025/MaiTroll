-- MAi School Incidents & Rules RLS Policies
-- Phase 2: Content Moderation & Liability Controls

ALTER TABLE school_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_institution_rules ENABLE ROW LEVEL SECURITY;

-- School incidents: reporters create, staff/institution manage, instructors read own institution
DROP POLICY IF EXISTS "instructor_report_incident" ON school_incidents;
CREATE POLICY "instructor_report_incident" ON school_incidents
    FOR INSERT WITH CHECK (
        auth.uid() = reported_by_user_id AND
        institution_id IN (
            SELECT institution_id FROM instructor_profiles WHERE user_id = auth.uid()
        ) OR
        institution_id IN (
            SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "institution_read_incidents" ON school_incidents;
CREATE POLICY "institution_read_incidents" ON school_incidents
    FOR SELECT USING (
        institution_id IN (
            SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
        ) OR
        institution_id IN (
            SELECT institution_id FROM instructor_profiles WHERE user_id = auth.uid()
        ) OR
        reported_by_user_id = auth.uid()
    );

DROP POLICY IF EXISTS "staff_manage_incidents" ON school_incidents;
CREATE POLICY "staff_manage_incidents" ON school_incidents
    FOR UPDATE USING (
        institution_id IN (
            SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "admin_all_incidents" ON school_incidents;
CREATE POLICY "admin_all_incidents" ON school_incidents
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Institution rules: staff manage, everyone in institution reads
DROP POLICY IF EXISTS "staff_manage_rules" ON school_institution_rules;
CREATE POLICY "staff_manage_rules" ON school_institution_rules
    FOR ALL USING (
        institution_id IN (
            SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "institution_read_rules" ON school_institution_rules;
CREATE POLICY "institution_read_rules" ON school_institution_rules
    FOR SELECT USING (
        institution_id IN (
            SELECT institution_id FROM institution_members WHERE user_id = auth.uid()
        ) OR
        institution_id IN (
            SELECT institution_id FROM instructor_profiles WHERE user_id = auth.uid()
        ) OR
        institution_id IN (
            SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "admin_all_rules" ON school_institution_rules;
CREATE POLICY "admin_all_rules" ON school_institution_rules
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
