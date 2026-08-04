-- Add unique constraints required by existing academy upserts.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.academy_grades'::regclass
      AND conname = 'academy_grades_student_course_type_unique'
  ) THEN
    ALTER TABLE public.academy_grades
      ADD CONSTRAINT academy_grades_student_course_type_unique
      UNIQUE (student_id, course_id, grade_type);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.academy_notes'::regclass
      AND conname = 'academy_notes_student_course_unique'
  ) THEN
    ALTER TABLE public.academy_notes
      ADD CONSTRAINT academy_notes_student_course_unique
      UNIQUE (student_id, course_id);
  END IF;
END$$;
