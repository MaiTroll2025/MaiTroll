-- Fix infinite recursion in employee_assignments RLS policies
-- The policies were querying employee_assignments within their USING/WITH CHECK clauses,
-- causing circular evaluation. Replace with SECURITY DEFINER function calls.

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Department HR Managers view department assignments" ON public.employee_assignments;
DROP POLICY IF EXISTS "Department HR Managers manage department assignments" ON public.employee_assignments;

-- Recreate view policy using is_department_hr_manager() function (SECURITY DEFINER, bypasses RLS)
CREATE POLICY "Department HR Managers view department assignments"
    ON public.employee_assignments FOR SELECT
    USING (
        public.is_department_hr_manager(auth.uid(), employee_assignments.department)
    );

-- Recreate manage policy using is_department_hr_manager() function
CREATE POLICY "Department HR Managers manage department assignments"
    ON public.employee_assignments FOR ALL
    USING (
        public.is_department_hr_manager(auth.uid(), employee_assignments.department)
    )
    WITH CHECK (
        public.is_department_hr_manager(auth.uid(), employee_assignments.department)
    );

-- Ensure function exists (it was created in 20260602000000_add_department_hr_managers.sql)
-- This is idempotent - no-op if function already exists
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
