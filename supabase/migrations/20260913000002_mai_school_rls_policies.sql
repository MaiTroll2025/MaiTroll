-- MAi School RLS Policies - Critical for security

-- Enable RLS on all tables
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_pool_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_social_posts ENABLE ROW LEVEL SECURITY;

-- STUDENT PROFILES RLS
-- Students can read their own profile
CREATE POLICY "student_read_own_profile" ON student_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Students at same institution can read verified student profiles (public in school network)
CREATE POLICY "student_read_institution_peers" ON student_profiles
  FOR SELECT USING (
    verification_status = 'verified' AND
    institution_id IN (
      SELECT institution_id FROM student_profiles WHERE user_id = auth.uid()
    )
  );

-- Instructors can read students in their institution
CREATE POLICY "instructor_read_students" ON student_profiles
  FOR SELECT USING (
    verification_status = 'verified' AND
    institution_id IN (
      SELECT institution_id FROM instructor_profiles WHERE user_id = auth.uid()
    )
  );

-- Institution admins can read all students in their institution
CREATE POLICY "institution_staff_read_students" ON student_profiles
  FOR SELECT USING (
    institution_id IN (
      SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
    )
  );

-- Admin can do anything
CREATE POLICY "admin_all_student_profiles" ON student_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Students can update their own profile (limited fields)
CREATE POLICY "student_update_own_profile" ON student_profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND verification_status IN ('pending', 'unverified'));

-- INSTRUCTOR PROFILES RLS
-- Instructors can read their own profile
CREATE POLICY "instructor_read_own_profile" ON instructor_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Instructors at same institution can read verified instructor profiles
CREATE POLICY "instructor_read_institution_peers" ON instructor_profiles
  FOR SELECT USING (
    verification_status = 'verified' AND
    institution_id IN (
      SELECT institution_id FROM instructor_profiles WHERE user_id = auth.uid()
    )
  );

-- Institution admins can read all instructors
CREATE POLICY "institution_staff_read_instructors" ON instructor_profiles
  FOR SELECT USING (
    institution_id IN (
      SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
    )
  );

-- Admin can do anything
CREATE POLICY "admin_all_instructor_profiles" ON instructor_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- INSTITUTIONS RLS - Institutions are public but managed by admin
CREATE POLICY "anyone_read_institutions" ON institutions
  FOR SELECT USING (true);

-- Only admin can insert/update/delete institutions
CREATE POLICY "admin_manage_institutions" ON institutions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- INSTITUTION MEMBERS RLS
-- Members can read their institution's member list
CREATE POLICY "member_read_own_institution" ON institution_members
  FOR SELECT USING (
    institution_id IN (
      SELECT institution_id FROM institution_members WHERE user_id = auth.uid()
    )
  );

-- Institution staff can manage members
CREATE POLICY "staff_manage_members" ON institution_members
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
    )
  );

-- Admin can do anything
CREATE POLICY "admin_all_institution_members" ON institution_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- INSTITUTION STAFF RLS
-- Staff can read staff list within their institution
CREATE POLICY "staff_read_own_institution_staff" ON institution_staff
  FOR SELECT USING (
    institution_id IN (
      SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
    )
  );

-- Only staff can insert/update/delete (managed by admin)
CREATE POLICY "staff_manage_staff" ON institution_staff
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM institution_staff WHERE user_id = auth.uid() AND role IN ('admin', 'director')
    )
  );

-- Admin can do anything
CREATE POLICY "admin_all_institution_staff" ON institution_staff
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- STUDENT CONNECTIONS RLS - CRITICAL: Completely separate from public MAiTROLL
-- Students can read their own connections
CREATE POLICY "student_read_own_connections" ON student_connections
  FOR SELECT USING (
    auth.uid() = follower_student_id OR auth.uid() = following_student_id
  );

-- Students can create connections (follow)
CREATE POLICY "student_create_connection" ON student_connections
  FOR INSERT WITH CHECK (
    auth.uid() = follower_student_id AND
    -- Can only follow verified students at any institution
    EXISTS (
      SELECT 1 FROM student_profiles 
      WHERE user_id = following_student_id AND verification_status = 'verified'
    )
  );

-- Students can delete their own follow relationships
CREATE POLICY "student_delete_own_connection" ON student_connections
  FOR DELETE USING (auth.uid() = follower_student_id);

-- Admin can manage all connections
CREATE POLICY "admin_all_student_connections" ON student_connections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- STUDENT TEAMS RLS
-- Team members can read their team
CREATE POLICY "team_member_read" ON student_teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM student_team_members WHERE team_id = student_teams.id AND student_id = auth.uid()
    )
  );

-- Institution members can read teams in their institution
CREATE POLICY "institution_member_read_teams" ON student_teams
  FOR SELECT USING (
    institution_id IN (
      SELECT institution_id FROM institution_members WHERE user_id = auth.uid()
    )
  );

-- Students can create teams in their institution
CREATE POLICY "student_create_team" ON student_teams
  FOR INSERT WITH CHECK (
    auth.uid() = created_by_student_id AND
    institution_id IN (
      SELECT institution_id FROM student_profiles WHERE user_id = auth.uid() AND verification_status = 'verified'
    )
  );

-- Team leaders can update their team
CREATE POLICY "team_leader_update" ON student_teams
  FOR UPDATE USING (
    created_by_student_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM student_team_members 
      WHERE team_id = student_teams.id AND student_id = auth.uid() AND role = 'leader'
    )
  );

-- Admin can manage all teams
CREATE POLICY "admin_all_student_teams" ON student_teams
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- STUDENT TEAM MEMBERS RLS
-- Team members can read team membership
CREATE POLICY "team_member_read_members" ON student_team_members
  FOR SELECT USING (
    team_id IN (
      SELECT id FROM student_teams WHERE created_by_student_id = auth.uid() OR
      EXISTS (SELECT 1 FROM student_team_members stm WHERE stm.team_id = student_teams.id AND stm.student_id = auth.uid())
    )
  );

-- Team leaders can manage members
CREATE POLICY "team_leader_manage_members" ON student_team_members
  FOR ALL USING (
    team_id IN (
      SELECT id FROM student_teams WHERE created_by_student_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM student_team_members stm 
      WHERE stm.team_id = student_team_members.team_id AND stm.student_id = auth.uid() AND stm.role = 'leader'
    )
  );

-- Admin can manage all team members
CREATE POLICY "admin_all_team_members" ON student_team_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- SCHOOL POOL CONTRIBUTIONS RLS
-- Students can read their own contributions
CREATE POLICY "student_read_own_contributions" ON school_pool_contributions
  FOR SELECT USING (auth.uid() = student_id);

-- Students can read institution pool totals
CREATE POLICY "student_read_institution_pool" ON school_pool_contributions
  FOR SELECT USING (
    institution_id IN (
      SELECT institution_id FROM student_profiles WHERE user_id = auth.uid()
    )
  );

-- Institution staff can read all contributions in their institution
CREATE POLICY "staff_read_institution_pool" ON school_pool_contributions
  FOR SELECT USING (
    institution_id IN (
      SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
    )
  );

-- Contributions are inserted by system (RPC)
CREATE POLICY "system_insert_contributions" ON school_pool_contributions
  FOR INSERT WITH CHECK (true);

-- Admin can read all contributions
CREATE POLICY "admin_all_contributions" ON school_pool_contributions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- INSTITUTION PROGRAMS RLS
-- Anyone can read programs (marketing)
CREATE POLICY "anyone_read_programs" ON institution_programs
  FOR SELECT USING (true);

-- Only institution staff can manage programs
CREATE POLICY "staff_manage_programs" ON institution_programs
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
    )
  );

-- Admin can manage all programs
CREATE POLICY "admin_all_programs" ON institution_programs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- INSTITUTION ANNOUNCEMENTS RLS
-- Anyone can read announcements in their institution
CREATE POLICY "student_read_institution_announcements" ON institution_announcements
  FOR SELECT USING (
    institution_id IN (
      SELECT institution_id FROM student_profiles WHERE user_id = auth.uid()
    ) OR
    institution_id IN (
      SELECT institution_id FROM instructor_profiles WHERE user_id = auth.uid()
    )
  );

-- Instructors can read announcements
CREATE POLICY "instructor_read_announcements" ON institution_announcements
  FOR SELECT USING (
    institution_id IN (
      SELECT institution_id FROM instructor_profiles WHERE user_id = auth.uid()
    )
  );

-- Institution staff can manage announcements
CREATE POLICY "staff_manage_announcements" ON institution_announcements
  FOR ALL USING (
    institution_id IN (
      SELECT institution_id FROM institution_staff WHERE user_id = auth.uid()
    )
  );

-- Admin can manage all announcements
CREATE POLICY "admin_all_announcements" ON institution_announcements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- STUDENT SOCIAL POSTS RLS
-- Students can read posts from students they follow or in their institution
CREATE POLICY "student_read_posts" ON student_social_posts
  FOR SELECT USING (
    -- Read own posts
    student_id = auth.uid() OR
    -- Read posts from followed students
    student_id IN (
      SELECT following_student_id FROM student_connections WHERE follower_student_id = auth.uid()
    ) OR
    -- Read posts from students in same institution
    institution_id IN (
      SELECT institution_id FROM student_profiles WHERE user_id = auth.uid()
    )
  );

-- Students can create posts
CREATE POLICY "student_create_posts" ON student_social_posts
  FOR INSERT WITH CHECK (
    auth.uid() = student_id AND
    institution_id IN (
      SELECT institution_id FROM student_profiles WHERE user_id = auth.uid() AND verification_status = 'verified'
    )
  );

-- Students can update/delete their own posts
CREATE POLICY "student_manage_own_posts" ON student_social_posts
  FOR UPDATE USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "student_delete_own_posts" ON student_social_posts
  FOR DELETE USING (auth.uid() = student_id);

-- Admin can manage all posts
CREATE POLICY "admin_all_posts" ON student_social_posts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );
