-- MAi School Instructor Features Tables
-- Phase 6: Follow instructor, contact instructor, instructor-to-student messaging

CREATE TABLE IF NOT EXISTS instructor_followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    follower_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(instructor_user_id, follower_user_id)
);

CREATE TABLE IF NOT EXISTS instructor_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instructor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instructor_followers_instructor ON instructor_followers(instructor_user_id);
CREATE INDEX IF NOT EXISTS idx_instructor_followers_follower ON instructor_followers(follower_user_id);
CREATE INDEX IF NOT EXISTS idx_instructor_messages_instructor ON instructor_messages(instructor_user_id);
CREATE INDEX IF NOT EXISTS idx_instructor_messages_student ON instructor_messages(student_user_id);

-- MAi School Instructor Features
-- Phase 6: Follow instructor, contact instructor, instructor-to-student messaging

-- Follow an instructor (student follows their instructor)
CREATE OR REPLACE FUNCTION follow_instructor(
  p_instructor_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_student_inst UUID;
  v_instructor_inst UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;

  -- Get student's institution
  SELECT institution_id INTO v_student_inst
  FROM student_profiles WHERE user_id = auth.uid();

  -- Get instructor's institution
  SELECT institution_id INTO v_instructor_inst
  FROM instructor_profiles WHERE user_id = p_instructor_user_id;

  IF v_student_inst IS NULL OR v_instructor_inst IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not a student or instructor');
  END IF;

  IF v_student_inst <> v_instructor_inst THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only follow instructors in your institution');
  END IF;

  -- Check if already following
  IF EXISTS (
    SELECT 1 FROM instructor_followers
    WHERE instructor_user_id = p_instructor_user_id AND follower_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already following');
  END IF;

  INSERT INTO instructor_followers (instructor_user_id, follower_user_id)
  VALUES (p_instructor_user_id, auth.uid());

  RETURN jsonb_build_object('success', true, 'following', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unfollow an instructor
CREATE OR REPLACE FUNCTION unfollow_instructor(
  p_instructor_user_id UUID
)
RETURNS JSONB AS $$
BEGIN
  DELETE FROM instructor_followers
  WHERE instructor_user_id = p_instructor_user_id AND follower_user_id = auth.uid();
  RETURN jsonb_build_object('success', true, 'following', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if a student is following an instructor
CREATE OR REPLACE FUNCTION is_following_instructor(
  p_instructor_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM instructor_followers
    WHERE instructor_user_id = p_instructor_user_id AND follower_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get instructor follower count
CREATE OR REPLACE FUNCTION get_instructor_followers_count(
  p_instructor_user_id UUID
)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM instructor_followers
    WHERE instructor_user_id = p_instructor_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Send a direct message from student to instructor (within institution)
CREATE OR REPLACE FUNCTION send_instructor_message(
  p_instructor_user_id UUID,
  p_message TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_student_inst UUID;
  v_instructor_inst UUID;
  v_msg_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;

  IF length(trim(p_message)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message cannot be empty');
  END IF;

  SELECT institution_id INTO v_student_inst
  FROM student_profiles WHERE user_id = auth.uid();

  SELECT institution_id INTO v_instructor_inst
  FROM instructor_profiles WHERE user_id = p_instructor_user_id;

  IF v_student_inst IS NULL OR v_instructor_inst IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not a student or instructor');
  END IF;

  IF v_student_inst <> v_instructor_inst THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only message instructors in your institution');
  END IF;

  INSERT INTO instructor_messages (instructor_user_id, student_user_id, message)
  VALUES (p_instructor_user_id, auth.uid(), p_message)
  RETURNING id INTO v_msg_id;

  RETURN jsonb_build_object('success', true, 'message_id', v_msg_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get messages between student and instructor
CREATE OR REPLACE FUNCTION get_instructor_messages(
  p_instructor_user_id UUID
)
RETURNS TABLE (
  id UUID,
  student_user_id UUID,
  message TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT im.id, im.student_user_id, im.message, im.created_at
  FROM instructor_messages im
  WHERE im.instructor_user_id = p_instructor_user_id
    AND im.student_user_id = auth.uid()
  ORDER BY im.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

