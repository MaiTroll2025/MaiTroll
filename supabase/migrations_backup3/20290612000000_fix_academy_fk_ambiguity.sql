-- ============================================================
-- FIX: Academy FK Ambiguity for Supabase Joins
-- Drops and recreates tables with explicit FK names
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. FIX academy_teachers — drop and recreate with named FKs
-- ============================================================
DROP TABLE IF EXISTS public.academy_teacher_ratings CASCADE;
DROP TABLE IF EXISTS public.academy_teacher_references CASCADE;
DROP TABLE IF EXISTS public.academy_courses CASCADE;
DROP TABLE IF EXISTS public.academy_teachers CASCADE;
DROP TABLE IF EXISTS public.academy_teacher_applications CASCADE;

CREATE TABLE public.academy_teacher_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  qualifications text,
  experience text,
  teaching_subjects text[] DEFAULT '{}',
  motivation text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'denied', 'suspended')),
  reviewed_by uuid REFERENCES public.user_profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.academy_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  teacher_id text NOT NULL UNIQUE,
  bio text,
  specialties text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  is_approved boolean DEFAULT false,
  approved_by uuid REFERENCES public.user_profiles(id),
  approved_at timestamptz,
  total_students integer DEFAULT 0,
  total_graduates integer DEFAULT 0,
  total_certificates_issued integer DEFAULT 0,
  average_rating numeric(3,2) DEFAULT 0.00,
  total_ratings integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.academy_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.academy_teachers(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.academy_categories(id),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  short_description text,
  thumbnail_url text,
  difficulty_level text DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  max_students integer DEFAULT 20,
  enrollment_fee integer DEFAULT 1000,
  currency_type text DEFAULT 'troll_coins' CHECK (currency_type IN ('troll_coins', 'free')),
  registration_open_date timestamptz,
  registration_close_date timestamptz,
  start_date timestamptz,
  end_date timestamptz,
  meeting_days text[] DEFAULT '{}',
  meeting_time text,
  timezone text DEFAULT 'America/New_York',
  enrollment_type text DEFAULT 'open' CHECK (enrollment_type IN ('open', 'approval_required')),
  minimum_attendance_pct integer DEFAULT 80,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'archived', 'cancelled')),
  total_sessions integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.academy_teacher_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.academy_teachers(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(teacher_id, student_id, course_id)
);

CREATE TABLE public.academy_teacher_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.academy_teachers(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  reference_type text NOT NULL CHECK (reference_type IN ('recommendation', 'employment_reference', 'skill_endorsement')),
  category text CHECK (category IN ('attendance', 'participation', 'professionalism', 'technical_skill', 'leadership', 'communication')),
  content text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. FIX academy_admissions_applications — named FKs
-- ============================================================
DROP TABLE IF EXISTS public.academy_admissions_applications CASCADE;

CREATE TABLE public.academy_admissions_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  first_choice_course_id uuid REFERENCES public.academy_courses(id),
  second_choice_course_id uuid REFERENCES public.academy_courses(id),
  third_choice_course_id uuid REFERENCES public.academy_courses(id),
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'under_review', 'accepted', 'waitlisted', 'denied', 'withdrawn')),
  assigned_course_id uuid REFERENCES public.academy_courses(id),
  assigned_classroom_id uuid REFERENCES public.academy_classrooms(id),
  reviewed_by uuid REFERENCES public.user_profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  acceptance_letter_sent boolean DEFAULT false,
  denial_letter_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 3. FIX academy_certificates — has teacher_id FK that may conflict
-- ============================================================
DROP TABLE IF EXISTS public.academy_certificates CASCADE;

CREATE TABLE public.academy_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number text NOT NULL UNIQUE,
  verification_id text NOT NULL UNIQUE,
  student_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.academy_teachers(id),
  enrollment_id uuid REFERENCES public.academy_enrollments(id),
  final_grade text,
  final_percentage numeric(5,2),
  status text DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  issued_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.user_profiles(id),
  revoke_reason text,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 4. FIX academy_enrollments — remove direct academy_teachers join
-- ============================================================
-- Note: academy_enrollments does NOT have a direct FK to academy_teachers
-- Teacher info comes through academy_courses. The service was trying to join
-- academy_enrollments -> academy_teachers which doesn't exist.
-- No schema change needed here — the fix is in the service layer.

-- ============================================================
-- 5. Recreate indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_academy_teachers_user_id ON public.academy_teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_teachers_teacher_id ON public.academy_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_academy_teachers_is_approved ON public.academy_teachers(is_approved);
CREATE INDEX IF NOT EXISTS idx_academy_teacher_apps_user_id ON public.academy_teacher_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_academy_teacher_apps_status ON public.academy_teacher_applications(status);
CREATE INDEX IF NOT EXISTS idx_academy_courses_teacher_id ON public.academy_courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_academy_courses_category_id ON public.academy_courses(category_id);
CREATE INDEX IF NOT EXISTS idx_academy_courses_status ON public.academy_courses(status);
CREATE INDEX IF NOT EXISTS idx_academy_courses_slug ON public.academy_courses(slug);
CREATE INDEX IF NOT EXISTS idx_academy_teacher_ratings_teacher_id ON public.academy_teacher_ratings(teacher_id);
CREATE INDEX IF NOT EXISTS idx_academy_teacher_refs_teacher ON public.academy_teacher_references(teacher_id);
CREATE INDEX IF NOT EXISTS idx_academy_teacher_refs_student ON public.academy_teacher_references(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_certificates_student_id ON public.academy_certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_certificates_course_id ON public.academy_certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_academy_certificates_number ON public.academy_certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_academy_certificates_verification ON public.academy_certificates(verification_id);
CREATE INDEX IF NOT EXISTS idx_academy_admissions_student_id ON public.academy_admissions_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_admissions_status ON public.academy_admissions_applications(status);

-- ============================================================
-- 6. Recreate triggers for updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_academy_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_teacher_applications;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_teacher_applications FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_teachers;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_teachers FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_courses;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_courses FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_teacher_ratings;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_teacher_ratings FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_teacher_references;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_teacher_references FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_certificates;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_certificates FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();
DROP TRIGGER IF EXISTS trg_academy_updated_at ON public.academy_admissions_applications;
CREATE TRIGGER trg_academy_updated_at BEFORE UPDATE ON public.academy_admissions_applications FOR EACH ROW EXECUTE FUNCTION public.update_academy_updated_at();

-- ============================================================
-- 7. Recreate teacher rating trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_teacher_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE public.academy_teachers
  SET
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM public.academy_teacher_ratings
      WHERE teacher_id = COALESCE(NEW.teacher_id, OLD.teacher_id)
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM public.academy_teacher_ratings
      WHERE teacher_id = COALESCE(NEW.teacher_id, OLD.teacher_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.teacher_id, OLD.teacher_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_teacher_rating ON public.academy_teacher_ratings;
CREATE TRIGGER trg_update_teacher_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.academy_teacher_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_teacher_rating();

-- ============================================================
-- 8. Recreate RLS policies for recreated tables
-- ============================================================
ALTER TABLE public.academy_teacher_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_teacher_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_teacher_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_admissions_applications ENABLE ROW LEVEL SECURITY;

-- academy_teacher_applications
DROP POLICY IF EXISTS "Users can view own applications" ON public.academy_teacher_applications;
CREATE POLICY "Users can view own applications" ON public.academy_teacher_applications FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can create applications" ON public.academy_teacher_applications;
CREATE POLICY "Users can create applications" ON public.academy_teacher_applications FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can manage applications" ON public.academy_teacher_applications;
CREATE POLICY "Admins can manage applications" ON public.academy_teacher_applications FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin')))
);

-- academy_teachers
DROP POLICY IF EXISTS "Teachers are viewable by everyone" ON public.academy_teachers;
CREATE POLICY "Teachers are viewable by everyone" ON public.academy_teachers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Teachers can update own profile" ON public.academy_teachers;
CREATE POLICY "Teachers can update own profile" ON public.academy_teachers FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can manage teachers" ON public.academy_teachers;
CREATE POLICY "Admins can manage teachers" ON public.academy_teachers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin')))
);

-- academy_courses
DROP POLICY IF EXISTS "Published courses are viewable by everyone" ON public.academy_courses;
CREATE POLICY "Published courses are viewable by everyone" ON public.academy_courses FOR SELECT USING (
  status = 'published' OR
  EXISTS (SELECT 1 FROM public.academy_teachers WHERE id = academy_courses.teacher_id AND user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin')))
);
DROP POLICY IF EXISTS "Teachers can manage own courses" ON public.academy_courses;
CREATE POLICY "Teachers can manage own courses" ON public.academy_courses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.academy_teachers WHERE id = academy_courses.teacher_id AND user_id = auth.uid())
);
DROP POLICY IF EXISTS "Admins can manage all courses" ON public.academy_courses;
CREATE POLICY "Admins can manage all courses" ON public.academy_courses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin')))
);

-- academy_teacher_ratings
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON public.academy_teacher_ratings;
CREATE POLICY "Ratings are viewable by everyone" ON public.academy_teacher_ratings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Students can create own ratings" ON public.academy_teacher_ratings;
CREATE POLICY "Students can create own ratings" ON public.academy_teacher_ratings FOR INSERT WITH CHECK (student_id = auth.uid());
DROP POLICY IF EXISTS "Students can update own ratings" ON public.academy_teacher_ratings;
CREATE POLICY "Students can update own ratings" ON public.academy_teacher_ratings FOR UPDATE USING (student_id = auth.uid());

-- academy_teacher_references
DROP POLICY IF EXISTS "References are viewable by everyone" ON public.academy_teacher_references;
CREATE POLICY "References are viewable by everyone" ON public.academy_teacher_references FOR SELECT USING (is_public = true);
DROP POLICY IF EXISTS "Teachers can manage own references" ON public.academy_teacher_references;
CREATE POLICY "Teachers can manage own references" ON public.academy_teacher_references FOR ALL USING (
  EXISTS (SELECT 1 FROM public.academy_teachers WHERE id = academy_teacher_references.teacher_id AND user_id = auth.uid())
);
DROP POLICY IF EXISTS "Admins can manage all references" ON public.academy_teacher_references;
CREATE POLICY "Admins can manage all references" ON public.academy_teacher_references FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin')))
);

-- academy_certificates
DROP POLICY IF EXISTS "Certificates are viewable by everyone" ON public.academy_certificates;
CREATE POLICY "Certificates are viewable by everyone" ON public.academy_certificates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage certificates" ON public.academy_certificates;
CREATE POLICY "Admins can manage certificates" ON public.academy_certificates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin')))
);

-- academy_admissions_applications
DROP POLICY IF EXISTS "Students can view own applications" ON public.academy_admissions_applications;
CREATE POLICY "Students can view own applications" ON public.academy_admissions_applications FOR SELECT USING (student_id = auth.uid());
DROP POLICY IF EXISTS "Students can create applications" ON public.academy_admissions_applications;
CREATE POLICY "Students can create applications" ON public.academy_admissions_applications FOR INSERT WITH CHECK (student_id = auth.uid());
DROP POLICY IF EXISTS "Admins can manage applications" ON public.academy_admissions_applications;
CREATE POLICY "Admins can manage applications" ON public.academy_admissions_applications FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin','superadmin')))
);

-- ============================================================
-- 9. Grants
-- ============================================================
GRANT ALL ON public.academy_teacher_applications TO authenticated;
GRANT ALL ON public.academy_teachers TO authenticated;
GRANT ALL ON public.academy_courses TO authenticated;
GRANT ALL ON public.academy_teacher_ratings TO authenticated;
GRANT ALL ON public.academy_teacher_references TO authenticated;
GRANT ALL ON public.academy_certificates TO authenticated;
GRANT ALL ON public.academy_admissions_applications TO authenticated;
GRANT SELECT ON public.academy_teachers TO anon;
GRANT SELECT ON public.academy_courses TO anon;
GRANT SELECT ON public.academy_certificates TO anon;
