-- Mai Class System Migration
-- Creates mai_classes and mai_class_enrollments tables with constraints
-- Depends on: organizations table (must be created first)

-- Step 1: Create tables (if they don't exist)
CREATE TABLE IF NOT EXISTS mai_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  max_students_per_org INT DEFAULT 20,
  class_schedule TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mai_class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES mai_classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'enrolled',
  enrollment_date TIMESTAMP DEFAULT now(),
  withdrawn_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(class_id, student_id)
);

-- Step 2: Create indexes (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_mai_class_enrollments_org_class ON mai_class_enrollments(organization_id, class_id, status);
CREATE INDEX IF NOT EXISTS idx_mai_class_enrollments_student ON mai_class_enrollments(student_id, status);

-- Step 3: Create/Replace function (safe to run multiple times)
CREATE OR REPLACE FUNCTION enforce_mai_class_student_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INT;
  max_allowed INT;
BEGIN
  IF NEW.status = 'enrolled' THEN
    SELECT COALESCE(max_students_per_org, 20) INTO max_allowed
    FROM mai_classes
    WHERE id = NEW.class_id;

    SELECT COUNT(*) INTO current_count
    FROM mai_class_enrollments
    WHERE class_id = NEW.class_id
      AND organization_id = NEW.organization_id
      AND status = 'enrolled'
      AND id != COALESCE(NEW.id, 'null'::uuid);

    IF current_count >= max_allowed THEN
      RAISE EXCEPTION 'Organization % cannot have more than % students in this class. Current: %',
        NEW.organization_id, max_allowed, current_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Drop existing trigger if it exists, then create it
DROP TRIGGER IF EXISTS trg_enforce_mai_class_student_limit ON mai_class_enrollments;
CREATE TRIGGER trg_enforce_mai_class_student_limit
BEFORE INSERT OR UPDATE ON mai_class_enrollments
FOR EACH ROW
EXECUTE FUNCTION enforce_mai_class_student_limit();

-- Step 5: Enable RLS (safe to run multiple times)
ALTER TABLE mai_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mai_class_enrollments ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies (now that tables exist), then create them
DROP POLICY IF EXISTS "mai_classes_enrolled_read" ON mai_classes;
DROP POLICY IF EXISTS "mai_classes_admin_all" ON mai_classes;
DROP POLICY IF EXISTS "mai_classes_instructor_update" ON mai_classes;
DROP POLICY IF EXISTS "mai_class_enrollments_read_own" ON mai_class_enrollments;
DROP POLICY IF EXISTS "mai_class_enrollments_admin_all" ON mai_class_enrollments;

-- Policy: Admins can manage classes
CREATE POLICY "mai_classes_admin_all" ON mai_classes
FOR ALL USING (
  auth.uid() IN (
    SELECT id FROM user_profiles
    WHERE role = 'admin' OR is_admin = true
  )
);

-- Policy: Instructors can update their own classes
CREATE POLICY "mai_classes_instructor_update" ON mai_classes
FOR UPDATE USING (
  instructor_id = auth.uid()
);

-- Policy: Enrolled students and admins can view class details
CREATE POLICY "mai_classes_enrolled_read" ON mai_classes
FOR SELECT USING (
  auth.uid() IN (
    SELECT id FROM user_profiles
    WHERE role = 'admin' OR is_admin = true
  )
  OR
  (status = 'active' AND EXISTS (
    SELECT 1 FROM mai_class_enrollments mce
    WHERE mce.class_id = mai_classes.id
      AND mce.student_id = auth.uid()
      AND mce.status = 'enrolled'
  ))
);

-- Policy: Students can read their own enrollments
CREATE POLICY "mai_class_enrollments_read_own" ON mai_class_enrollments
FOR SELECT USING (
  student_id = auth.uid()
  OR auth.uid() IN (
    SELECT id FROM user_profiles
    WHERE role = 'admin' OR is_admin = true
  )
);

-- Policy: Admins can manage all enrollments
CREATE POLICY "mai_class_enrollments_admin_all" ON mai_class_enrollments
FOR ALL USING (
  auth.uid() IN (
    SELECT id FROM user_profiles
    WHERE role = 'admin' OR is_admin = true
  )
);

-- Step 7: Create helper function
CREATE OR REPLACE FUNCTION get_available_mai_class_slots(
  p_class_id UUID,
  p_org_id UUID
)
RETURNS INT AS $$
DECLARE
  max_allowed INT;
  current_count INT;
  available_slots INT;
BEGIN
  SELECT COALESCE(max_students_per_org, 20) INTO max_allowed
  FROM mai_classes
  WHERE id = p_class_id;

  SELECT COUNT(*) INTO current_count
  FROM mai_class_enrollments
  WHERE class_id = p_class_id
    AND organization_id = p_org_id
    AND status = 'enrolled';

  available_slots := max_allowed - current_count;
  RETURN GREATEST(available_slots, 0);
END;
$$ LANGUAGE plpgsql;

-- Step 8: Grant permissions
GRANT SELECT ON mai_classes TO authenticated;
GRANT SELECT ON mai_class_enrollments TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_mai_class_slots TO authenticated;
