-- MAi School Educational Ecosystem - Core Tables
-- Separate educational system from public MAiTROLL

-- 1. Student Profiles - Track student status and verification
CREATE TABLE IF NOT EXISTS student_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL,
  program_field TEXT,
  verification_status TEXT CHECK (verification_status IN ('unverified', 'verified', 'pending', 'rejected')) DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE,
  enrollment_year INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Instructor Profiles - Track instructor status and assignments
CREATE TABLE IF NOT EXISTS instructor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL,
  department TEXT,
  verification_status TEXT CHECK (verification_status IN ('unverified', 'verified', 'pending', 'rejected')) DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Institution Management
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('university', 'college', 'trade_school', 'other')) NOT NULL,
  domain TEXT UNIQUE,
  is_verified BOOLEAN DEFAULT false,
  verified_by_admin UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Institution Members - Track affiliation
CREATE TABLE IF NOT EXISTS institution_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_type TEXT CHECK (member_type IN ('student', 'instructor', 'staff', 'admin')) NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(institution_id, user_id)
);

-- 5. Institution Staff - Track administrative roles within institution
CREATE TABLE IF NOT EXISTS institution_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('admin', 'director', 'staff', 'coordinator')) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(institution_id, user_id)
);

-- 6. Student Social Graph - COMPLETELY SEPARATE from public MAiTROLL
CREATE TABLE IF NOT EXISTS student_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT no_self_follow CHECK (follower_student_id != following_student_id),
  UNIQUE(follower_student_id, following_student_id)
);

-- 7. Student Teams - Infrastructure for future team-based functionality
CREATE TABLE IF NOT EXISTS student_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  created_by_student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  team_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. Student Team Members
CREATE TABLE IF NOT EXISTS student_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES student_teams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('leader', 'member')) DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(team_id, student_id)
);

-- 9. School Pool Contributions - Track institutional fundraising
CREATE TABLE IF NOT EXISTS school_pool_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT positive_amount CHECK (amount >= 0)
);

-- 10. Institution Programs - Future-ready program management
CREATE TABLE IF NOT EXISTS institution_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  program_type TEXT CHECK (program_type IN ('course', 'degree', 'bootcamp', 'certification', 'other')) DEFAULT 'course',
  description TEXT,
  duration_weeks INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 11. Institution Announcements
CREATE TABLE IF NOT EXISTS institution_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  announcement_type TEXT CHECK (announcement_type IN ('general', 'program', 'event', 'opportunity', 'important')) DEFAULT 'general',
  published_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 12. Student Social Posts - Educational network posts
CREATE TABLE IF NOT EXISTS student_social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  topic TEXT CHECK (topic IN ('general', 'study', 'business', 'entrepreneurship', 'tech', 'careers', 'campus', 'teams')) DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_student_profiles_user_id ON student_profiles(user_id);
CREATE INDEX idx_student_profiles_institution_id ON student_profiles(institution_id);
CREATE INDEX idx_instructor_profiles_user_id ON instructor_profiles(user_id);
CREATE INDEX idx_instructor_profiles_institution_id ON instructor_profiles(institution_id);
CREATE INDEX idx_institution_members_user_id ON institution_members(user_id);
CREATE INDEX idx_institution_members_institution_id ON institution_members(institution_id);
CREATE INDEX idx_institution_staff_user_id ON institution_staff(user_id);
CREATE INDEX idx_institution_staff_institution_id ON institution_staff(institution_id);
CREATE INDEX idx_student_connections_follower ON student_connections(follower_student_id);
CREATE INDEX idx_student_connections_following ON student_connections(following_student_id);
CREATE INDEX idx_student_teams_institution_id ON student_teams(institution_id);
CREATE INDEX idx_student_team_members_team_id ON student_team_members(team_id);
CREATE INDEX idx_student_team_members_student_id ON student_team_members(student_id);
CREATE INDEX idx_school_pool_contributions_student_id ON school_pool_contributions(student_id);
CREATE INDEX idx_school_pool_contributions_institution_id ON school_pool_contributions(institution_id);
CREATE INDEX idx_institution_programs_institution_id ON institution_programs(institution_id);
CREATE INDEX idx_institution_announcements_institution_id ON institution_announcements(institution_id);
CREATE INDEX idx_student_social_posts_student_id ON student_social_posts(student_id);
CREATE INDEX idx_student_social_posts_institution_id ON student_social_posts(institution_id);
CREATE INDEX idx_student_social_posts_topic ON student_social_posts(topic);

-- Add comments for documentation
COMMENT ON TABLE student_profiles IS 'Tracks verified student status. Separate from public MAiTROLL users.';
COMMENT ON TABLE instructor_profiles IS 'Tracks verified instructor status. Separate from public MAiTROLL users.';
COMMENT ON TABLE student_connections IS 'Educational social graph - COMPLETELY SEPARATE from public MAiTROLL followers.';
COMMENT ON TABLE student_teams IS 'Student team infrastructure for future team battles and competitions.';
COMMENT ON TABLE school_pool_contributions IS 'Tracks student contributions to institutional school pool fund.';
COMMENT ON COLUMN student_profiles.verification_status IS 'Must be verified before accessing student features.';
COMMENT ON COLUMN instructor_profiles.verification_status IS 'Must be verified before accessing instructor features.';
COMMENT ON COLUMN student_connections.follower_student_id IS 'CRITICAL: Only students can follow other students in this network.';
