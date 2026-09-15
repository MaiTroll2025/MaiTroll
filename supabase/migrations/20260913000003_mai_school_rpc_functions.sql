-- MAi School RPC Functions
-- Server-side business logic for critical operations

-- Create or verify a student profile
CREATE OR REPLACE FUNCTION create_or_verify_student_profile(
  p_user_id UUID,
  p_institution_id UUID,
  p_program_field TEXT DEFAULT NULL
)
RETURNS student_profiles AS $$
DECLARE
  v_profile student_profiles;
BEGIN
  -- Verify institution exists
  IF NOT EXISTS (SELECT 1 FROM institutions WHERE id = p_institution_id) THEN
    RAISE EXCEPTION 'Institution not found';
  END IF;

  -- Prevent student from joining unauthorized institution
  -- (Institution staff would verify before calling this)
  
  -- Create or update student profile
  INSERT INTO student_profiles (user_id, institution_id, program_field, verification_status)
  VALUES (p_user_id, p_institution_id, p_program_field, 'pending')
  ON CONFLICT (user_id) DO UPDATE
  SET program_field = COALESCE(p_program_field, student_profiles.program_field),
      updated_at = now()
  RETURNING * INTO v_profile;

  -- Add to institution members
  INSERT INTO institution_members (institution_id, user_id, member_type)
  VALUES (p_institution_id, p_user_id, 'student')
  ON CONFLICT DO NOTHING;

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or verify instructor profile
CREATE OR REPLACE FUNCTION create_or_verify_instructor_profile(
  p_user_id UUID,
  p_institution_id UUID,
  p_department TEXT DEFAULT NULL
)
RETURNS instructor_profiles AS $$
DECLARE
  v_profile instructor_profiles;
BEGIN
  -- Verify institution exists
  IF NOT EXISTS (SELECT 1 FROM institutions WHERE id = p_institution_id) THEN
    RAISE EXCEPTION 'Institution not found';
  END IF;

  -- Create or update instructor profile
  INSERT INTO instructor_profiles (user_id, institution_id, department, verification_status)
  VALUES (p_user_id, p_institution_id, p_department, 'pending')
  ON CONFLICT (user_id) DO UPDATE
  SET department = COALESCE(p_department, instructor_profiles.department),
      updated_at = now()
  RETURNING * INTO v_profile;

  -- Add to institution members
  INSERT INTO institution_members (institution_id, user_id, member_type)
  VALUES (p_institution_id, p_user_id, 'instructor')
  ON CONFLICT DO NOTHING;

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Follow another student
CREATE OR REPLACE FUNCTION follow_student(
  p_following_student_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_follower_id UUID;
BEGIN
  v_follower_id := auth.uid();
  
  IF v_follower_id = p_following_student_id THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;

  -- Verify both are verified students
  IF NOT EXISTS (
    SELECT 1 FROM student_profiles 
    WHERE user_id = v_follower_id AND verification_status = 'verified'
  ) THEN
    RAISE EXCEPTION 'You must be a verified student';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM student_profiles 
    WHERE user_id = p_following_student_id AND verification_status = 'verified'
  ) THEN
    RAISE EXCEPTION 'Cannot follow unverified student';
  END IF;

  -- Create connection
  INSERT INTO student_connections (follower_student_id, following_student_id)
  VALUES (v_follower_id, p_following_student_id)
  ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unfollow another student
CREATE OR REPLACE FUNCTION unfollow_student(
  p_following_student_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_follower_id UUID;
BEGIN
  v_follower_id := auth.uid();
  
  DELETE FROM student_connections
  WHERE follower_student_id = v_follower_id 
    AND following_student_id = p_following_student_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create student team
CREATE OR REPLACE FUNCTION create_student_team(
  p_team_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS student_teams AS $$
DECLARE
  v_team student_teams;
  v_institution_id UUID;
BEGIN
  -- Get user's institution
  SELECT institution_id INTO v_institution_id
  FROM student_profiles
  WHERE user_id = auth.uid() AND verification_status = 'verified';

  IF v_institution_id IS NULL THEN
    RAISE EXCEPTION 'Must be a verified student to create teams';
  END IF;

  -- Create team
  INSERT INTO student_teams (institution_id, created_by_student_id, team_name, description)
  VALUES (v_institution_id, auth.uid(), p_team_name, p_description)
  RETURNING * INTO v_team;

  -- Add creator as team leader
  INSERT INTO student_team_members (team_id, student_id, role)
  VALUES (v_team.id, auth.uid(), 'leader');

  RETURN v_team;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add student to team
CREATE OR REPLACE FUNCTION add_student_to_team(
  p_team_id UUID,
  p_student_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_caller_id UUID;
  v_team_institution_id UUID;
  v_student_institution_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Verify caller is team leader
  IF NOT EXISTS (
    SELECT 1 FROM student_team_members
    WHERE team_id = p_team_id AND student_id = v_caller_id AND role = 'leader'
  ) THEN
    RAISE EXCEPTION 'Only team leaders can add members';
  END IF;

  -- Get team institution
  SELECT institution_id INTO v_team_institution_id
  FROM student_teams WHERE id = p_team_id;

  -- Get student's institution
  SELECT institution_id INTO v_student_institution_id
  FROM student_profiles WHERE user_id = p_student_id AND verification_status = 'verified';

  -- Students must be in same institution
  IF v_team_institution_id != v_student_institution_id THEN
    RAISE EXCEPTION 'Student must be in same institution';
  END IF;

  -- Add to team
  INSERT INTO student_team_members (team_id, student_id, role)
  VALUES (p_team_id, p_student_id, 'member')
  ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove student from team
CREATE OR REPLACE FUNCTION remove_student_from_team(
  p_team_id UUID,
  p_student_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Verify caller is team leader
  IF NOT EXISTS (
    SELECT 1 FROM student_team_members
    WHERE team_id = p_team_id AND student_id = v_caller_id AND role = 'leader'
  ) THEN
    RAISE EXCEPTION 'Only team leaders can remove members';
  END IF;

  -- Cannot remove self if only leader
  IF p_student_id = v_caller_id THEN
    IF (SELECT COUNT(*) FROM student_team_members WHERE team_id = p_team_id AND role = 'leader') = 1 THEN
      RAISE EXCEPTION 'Cannot remove last team leader';
    END IF;
  END IF;

  -- Remove from team
  DELETE FROM student_team_members
  WHERE team_id = p_team_id AND student_id = p_student_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record school pool contribution
CREATE OR REPLACE FUNCTION record_school_pool_contribution(
  p_student_id UUID,
  p_institution_id UUID,
  p_amount INTEGER,
  p_source TEXT,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS school_pool_contributions AS $$
DECLARE
  v_contribution school_pool_contributions;
BEGIN
  -- Verify amounts
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Insert contribution
  INSERT INTO school_pool_contributions (
    student_id,
    institution_id,
    amount,
    source,
    reference_id
  )
  VALUES (p_student_id, p_institution_id, p_amount, p_source, p_reference_id)
  RETURNING * INTO v_contribution;

  RETURN v_contribution;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get student's following count (for profile display)
CREATE OR REPLACE FUNCTION get_student_following_count(
  p_student_id UUID
)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT COUNT(*) FROM student_connections WHERE follower_student_id = p_student_id),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get student's followers count (for profile display)
CREATE OR REPLACE FUNCTION get_student_followers_count(
  p_student_id UUID
)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT COUNT(*) FROM student_connections WHERE following_student_id = p_student_id),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get institutional school pool total
CREATE OR REPLACE FUNCTION get_school_pool_total(
  p_institution_id UUID
)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(amount) FROM school_pool_contributions WHERE institution_id = p_institution_id),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get student's school pool contribution
CREATE OR REPLACE FUNCTION get_student_pool_contribution(
  p_student_id UUID,
  p_institution_id UUID
)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(amount) FROM school_pool_contributions WHERE student_id = p_student_id AND institution_id = p_institution_id),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
