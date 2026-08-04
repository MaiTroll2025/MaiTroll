-- Fix infinite recursion in RLS policies that reference employee_assignments
-- The root cause: policies on tables like employee_assignments use self-joins
-- (e.g., EXISTS(SELECT 1 FROM employee_assignments ea_hr WHERE ...)).
-- This causes the policy to query the same table it's protecting, triggering
-- the same policy recursively ad infinitum.
--
-- Solution: Replace all employee_assignments self-join subqueries with
-- calls to the SECURITY DEFINER function is_department_hr_manager(),
-- which bypasses RLS and thus breaks the recursion cycle.

-- ============================================================================
-- PART 1: FIX employee_assignments POLICIES (these were the direct cause)
-- ============================================================================

-- Drop the self-referencing policies on employee_assignments
DROP POLICY IF EXISTS "Department HR Managers view department assignments" ON public.employee_assignments;
DROP POLICY IF EXISTS "Department HR Managers manage department assignments" ON public.employee_assignments;

-- Recreate using is_department_hr_manager() function
CREATE POLICY "Department HR Managers view department assignments"
    ON public.employee_assignments FOR SELECT
    USING (
        public.is_department_hr_manager(auth.uid(), employee_assignments.department)
    );

CREATE POLICY "Department HR Managers manage department assignments"
    ON public.employee_assignments FOR ALL
    USING (
        public.is_department_hr_manager(auth.uid(), employee_assignments.department)
    )
    WITH CHECK (
        public.is_department_hr_manager(auth.uid(), employee_assignments.department)
    );

-- ============================================================================
-- PART 2: FIX job_applications POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Department HR Managers view department applications" ON public.job_applications;
DROP POLICY IF EXISTS "Department HR Managers manage department applications" ON public.job_applications;

CREATE POLICY "Department HR Managers view department applications"
    ON public.job_applications FOR SELECT
    USING (
        public.is_department_hr_manager(auth.uid(), job_applications.department)
    );

CREATE POLICY "Department HR Managers manage department applications"
    ON public.job_applications FOR ALL
    USING (
        public.is_department_hr_manager(auth.uid(), job_applications.department)
    )
    WITH CHECK (
        public.is_department_hr_manager(auth.uid(), job_applications.department)
    );

-- ============================================================================
-- PART 3: FIX hr_interview_sessions POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Department HR Managers view department interview sessions" ON public.hr_interview_sessions;
DROP POLICY IF EXISTS "Department HR Managers manage department interview sessions" ON public.hr_interview_sessions;

CREATE POLICY "Department HR Managers view department interview sessions"
    ON public.hr_interview_sessions FOR SELECT
    USING (
        public.is_department_hr_manager(auth.uid(), hr_interview_sessions.department)
    );

CREATE POLICY "Department HR Managers manage department interview sessions"
    ON public.hr_interview_sessions FOR ALL
    USING (
        public.is_department_hr_manager(auth.uid(), hr_interview_sessions.department)
    )
    WITH CHECK (
        public.is_department_hr_manager(auth.uid(), hr_interview_sessions.department)
    );

-- ============================================================================
-- PART 4: FIX employee_attendance POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Department HR Managers view department attendance" ON public.employee_attendance;
DROP POLICY IF EXISTS "Department HR Managers manage department attendance" ON public.employee_attendance;

CREATE POLICY "Department HR Managers view department attendance"
    ON public.employee_attendance FOR SELECT
    USING (
        public.is_department_hr_manager(auth.uid(), employee_attendance.department)
    );

CREATE POLICY "Department HR Managers manage department attendance"
    ON public.employee_attendance FOR ALL
    USING (
        public.is_department_hr_manager(auth.uid(), employee_attendance.department)
    )
    WITH CHECK (
        public.is_department_hr_manager(auth.uid(), employee_attendance.department)
    );

-- ============================================================================
-- PART 5: FIX employee_shifts POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Department HR Managers view department shifts" ON public.employee_shifts;
DROP POLICY IF EXISTS "Department HR Managers manage department shifts" ON public.employee_shifts;

CREATE POLICY "Department HR Managers view department shifts"
    ON public.employee_shifts FOR SELECT
    USING (
        public.is_department_hr_manager(auth.uid(), employee_shifts.department)
    );

CREATE POLICY "Department HR Managers manage department shifts"
    ON public.employee_shifts FOR ALL
    USING (
        public.is_department_hr_manager(auth.uid(), employee_shifts.department)
    )
    WITH CHECK (
        public.is_department_hr_manager(auth.uid(), employee_shifts.department)
    );

-- ============================================================================
-- PART 6: FIX employee_performance_reviews POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Department HR Managers view department performance reviews" ON public.employee_performance_reviews;
DROP POLICY IF EXISTS "Department HR Managers manage department performance reviews" ON public.employee_performance_reviews;

CREATE POLICY "Department HR Managers view department performance reviews"
    ON public.employee_performance_reviews FOR SELECT
    USING (
        public.is_department_hr_manager(auth.uid(), employee_performance_reviews.department)
    );

CREATE POLICY "Department HR Managers manage department performance reviews"
    ON public.employee_performance_reviews FOR ALL
    USING (
        public.is_department_hr_manager(auth.uid(), employee_performance_reviews.department)
    )
    WITH CHECK (
        public.is_department_hr_manager(auth.uid(), employee_performance_reviews.department)
    );

-- ============================================================================
-- PART 7: FIX employee_payroll POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Department HR Managers view department payroll" ON public.employee_payroll;
DROP POLICY IF EXISTS "Department HR Managers manage department payroll" ON public.employee_payroll;

CREATE POLICY "Department HR Managers view department payroll"
    ON public.employee_payroll FOR SELECT
    USING (
        public.is_department_hr_manager(auth.uid(), employee_payroll.department)
    );

CREATE POLICY "Department HR Managers manage department payroll"
    ON public.employee_payroll FOR ALL
    USING (
        public.is_department_hr_manager(auth.uid(), employee_payroll.department)
    )
    WITH CHECK (
        public.is_department_hr_manager(auth.uid(), employee_payroll.department)
    );

-- ============================================================================
-- PART 8: FIX employee_training_completion POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Department HR Managers view department training completion" ON public.employee_training_completion;
DROP POLICY IF EXISTS "Department HR Managers manage department training completion" ON public.employee_training_completion;

CREATE POLICY "Department HR Managers view department training completion"
    ON public.employee_training_completion FOR SELECT
    USING (
        public.is_department_hr_manager(auth.uid(), employee_training_completion.department)
    );

CREATE POLICY "Department HR Managers manage department training completion"
    ON public.employee_training_completion FOR ALL
    USING (
        public.is_department_hr_manager(auth.uid(), employee_training_completion.department)
    )
    WITH CHECK (
        public.is_department_hr_manager(auth.uid(), employee_training_completion.department)
    );

-- ============================================================================
-- PART 9: FIX employee_disciplinary_records POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Department HR Managers view department disciplinary records" ON public.employee_disciplinary_records;
DROP POLICY IF EXISTS "Department HR Managers manage department disciplinary records" ON public.employee_disciplinary_records;

CREATE POLICY "Department HR Managers view department disciplinary records"
    ON public.employee_disciplinary_records FOR SELECT
    USING (
        public.is_department_hr_manager(auth.uid(), employee_disciplinary_records.department)
    );

CREATE POLICY "Department HR Managers manage department disciplinary records"
    ON public.employee_disciplinary_records FOR ALL
    USING (
        public.is_department_hr_manager(auth.uid(), employee_disciplinary_records.department)
    )
    WITH CHECK (
        public.is_department_hr_manager(auth.uid(), employee_disciplinary_records.department)
    );

-- ============================================================================
-- Ensure is_department_hr_manager function is SECURITY DEFINER (should already exist)
-- This is a safe no-op if the function already exists
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_department_hr_manager(user_uuid UUID, dept_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.employee_assignments
        WHERE user_id = user_uuid
        AND department = dept_name
        AND role_level = 'hr_manager'
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also ensure is_global_admin exists (it does in the earlier migration)
CREATE OR REPLACE FUNCTION public.is_global_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = user_uuid
        AND (role IN ('admin', 'hr_admin') OR is_admin = true)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
