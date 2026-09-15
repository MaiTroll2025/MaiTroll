-- MAi School Instructor Features RLS
-- Phase 6: Follow instructor, contact instructor, messaging

ALTER TABLE instructor_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_messages ENABLE ROW LEVEL SECURITY;

-- Instructor followers: students manage own follows, instructors read theirs
DROP POLICY IF EXISTS "student_manage_follows" ON instructor_followers;
CREATE POLICY "student_manage_follows" ON instructor_followers
    FOR ALL USING (auth.uid() = follower_user_id);

DROP POLICY IF EXISTS "instructor_read_followers" ON instructor_followers;
CREATE POLICY "instructor_read_followers" ON instructor_followers
    FOR SELECT USING (auth.uid() = instructor_user_id);

DROP POLICY IF EXISTS "admin_all_followers" ON instructor_followers;
CREATE POLICY "admin_all_followers" ON instructor_followers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Instructor messages: students insert to their instructor, instructors read theirs
DROP POLICY IF EXISTS "student_send_message" ON instructor_messages;
CREATE POLICY "student_send_message" ON instructor_messages
    FOR INSERT WITH CHECK (auth.uid() = student_user_id);

DROP POLICY IF EXISTS "instructor_read_messages" ON instructor_messages;
CREATE POLICY "instructor_read_messages" ON instructor_messages
    FOR SELECT USING (auth.uid() = instructor_user_id);

DROP POLICY IF EXISTS "instructor_mark_read" ON instructor_messages;
CREATE POLICY "instructor_mark_read" ON instructor_messages
    FOR UPDATE USING (auth.uid() = instructor_user_id);

DROP POLICY IF EXISTS "admin_all_messages" ON instructor_messages;
CREATE POLICY "admin_all_messages" ON instructor_messages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
    );
