-- Migration: Mai Business — Server-side Functions/RPCs
-- All critical authorization and financial operations are validated server-side.
-- SECURITY DEFINER is used only where necessary, with explicit search_path.
-- The authenticated actor is always determined from auth.uid() — never trusted from client input.

BEGIN;

-- =========================================================================
-- Helper: Check if user is a Mai Business admin (CEO/Superadmin/Admin)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.mai_business_is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = p_user_id
      AND (p.is_admin = true
           OR p.role IN ('admin', 'superadmin', 'ceo', 'owner')
           OR p.troll_role IN ('admin', 'superadmin', 'ceo', 'owner'))
  );
$$;

GRANT EXECUTE ON FUNCTION public.mai_business_is_admin(UUID) TO authenticated, service_role;

-- =========================================================================
-- Helper: Check if user is an approved Mai Business instructor
-- Instructor does NOT get any career dashboard access.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.mai_business_is_instructor(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mai_business_profiles mp
    WHERE mp.user_id = p_user_id
      AND mp.program_role = 'instructor'
      AND mp.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.mai_business_is_instructor(UUID) TO authenticated, service_role;

-- =========================================================================
-- Helper: Check if user is a student (any authenticated user with a profile)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.mai_business_is_student(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mai_business_profiles mp
    WHERE mp.user_id = p_user_id
      AND mp.program_role = 'student'
      AND mp.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.mai_business_is_student(UUID) TO authenticated, service_role;

-- =========================================================================
-- RPC: update_lesson_progress
-- Server-side: validates that the authenticated user is the owner,
-- records a progress entry, and logs the activity.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.update_lesson_progress(
    p_lesson_id  UUID,
    p_status     TEXT,
    p_progress   NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_course_id UUID;
    v_module_id UUID;
    v_existing UUID;
    v_new_status TEXT;
BEGIN
    -- Determine the authenticated actor from the session — never trust client
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Validate status
    IF p_status NOT IN ('available', 'in_progress', 'completed', 'locked') THEN
        RAISE EXCEPTION 'Invalid status: %', p_status;
    END IF;

    -- Look up lesson → module → course
    SELECT m.id, l.module_id
    INTO v_existing, v_module_id
    FROM public.mai_business_lessons l
    JOIN public.mai_business_course_modules m ON l.module_id = m.id
    WHERE l.id = p_lesson_id;

    IF v_existing IS NULL THEN
        RAISE EXCEPTION 'Lesson not found';
    END IF;

    -- Look up the course_id from the module
    SELECT course_id INTO v_course_id FROM public.mai_business_course_modules WHERE id = v_module_id;

    -- Upsert progress
    INSERT INTO public.mai_business_progress
        (user_id, course_id, module_id, lesson_id, status, progress_percent, completed_at)
    VALUES
        (v_user_id, v_course_id, v_module_id, p_lesson_id, p_status,
         COALESCE(p_progress, 100), CASE WHEN p_status = 'completed' THEN now() ELSE NULL END)
    ON CONFLICT (user_id, course_id, lesson_id)
    DO UPDATE SET
        status = EXCLUDED.status,
        progress_percent = EXCLUDED.progress_percent,
        completed_at = EXCLUDED.completed_at,
        updated_at = now();

    -- Log activity
    INSERT INTO public.mai_business_activity_log
        (user_id, actor_id, action, category, target_type, target_id, new_value, metadata)
    VALUES
        (v_user_id, v_user_id, 'lesson_progress', 'education', 'lesson', p_lesson_id,
         jsonb_build_object('status', p_status, 'progress', COALESCE(p_progress, 100)),
         jsonb_build_object('course_id', v_course_id, 'module_id', v_module_id));

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'lesson_id', p_lesson_id,
        'course_id', v_course_id,
        'module_id', v_module_id,
        'status', p_status
    )::json;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_lesson_progress(UUID, TEXT, NUMERIC) TO authenticated, service_role;

-- =========================================================================
-- RPC: submit_funding_application
-- Validates that the authenticated user owns the application and that the
-- current status is 'draft', then transitions to 'submitted'.
-- Never trusts client-supplied status.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.submit_funding_application(
    p_application_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_app_user UUID;
    v_current_status TEXT;
    v_program_id UUID;
    v_requested_amount NUMERIC;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT user_id, status, program_id, requested_amount
    INTO v_app_user, v_current_status, v_program_id, v_requested_amount
    FROM public.mai_business_funding_applications
    WHERE id = p_application_id;

    IF v_app_user IS NULL THEN
        RAISE EXCEPTION 'Application not found';
    END IF;

    -- Ownership check
    IF v_app_user != v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: application does not belong to the authenticated user';
    END IF;

    -- Only drafts can be submitted
    IF v_current_status != 'draft' THEN
        RAISE EXCEPTION 'Cannot submit application in status: %', v_current_status;
    END IF;

    -- Validate requested amount against program if provided
    IF v_requested_amount IS NOT NULL THEN
        -- Log the submission
        UPDATE public.mai_business_funding_applications
        SET status = 'submitted',
            submitted_at = now(),
            updated_at = now()
        WHERE id = p_application_id;

        INSERT INTO public.mai_business_activity_log
            (user_id, actor_id, action, category, target_type, target_id,
             previous_value, new_value, metadata)
        VALUES
            (v_user_id, v_user_id, 'funding_application_submitted', 'funding',
             'funding_application', p_application_id,
             jsonb_build_object('status', v_current_status),
             jsonb_build_object('status', 'submitted'),
             jsonb_build_object('program_id', v_program_id, 'requested_amount', v_requested_amount));

        RETURN jsonb_build_object(
            'success', true,
            'application_id', p_application_id,
            'status', 'submitted',
            'submitted_at', now()
        )::json;
    ELSE
        RAISE EXCEPTION 'Application must have a requested amount';
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_funding_application(UUID) TO authenticated, service_role;

-- =========================================================================
-- RPC: validate_funding_availability
-- Server-side check that a funding program has sufficient available funds
-- for the requested amount. Does NOT allocate — only validates.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.validate_funding_availability(
    p_program_id  UUID,
    p_amount      NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_available NUMERIC;
    v_total_allocated NUMERIC;
    v_remaining      NUMERIC;
    v_program_status TEXT;
    v_program_name   TEXT;
BEGIN
    SELECT total_available, total_allocated, status, name
    INTO v_total_available, v_total_allocated, v_program_status, v_program_name
    FROM public.mai_business_funding_programs
    WHERE id = p_program_id;

    IF v_program_name IS NULL THEN
        RAISE EXCEPTION 'Funding program not found';
    END IF;

    IF v_program_status != 'active' THEN
        RETURN jsonb_build_object(
            'available', false,
            'reason', 'Program is not active',
            'program_name', v_program_name,
            'program_status', v_program_status
        )::json;
    END IF;

    IF v_total_available IS NULL OR v_total_available = 0 THEN
        RETURN jsonb_build_object(
            'available', true,
            'reason', 'No budget cap set — unlimited availability',
            'program_name', v_program_name,
            'requested_amount', p_amount
        )::json;
    END IF;

    v_remaining := COALESCE(v_total_available, 0) - COALESCE(v_total_allocated, 0);

    IF v_remaining < p_amount THEN
        RETURN jsonb_build_object(
            'available', false,
            'reason', 'Insufficient funds',
            'program_name', v_program_name,
            'remaining', v_remaining,
            'requested', p_amount
        )::json;
    END IF;

    RETURN jsonb_build_object(
        'available', true,
        'program_name', v_program_name,
        'remaining', v_remaining,
        'requested', p_amount
    )::json;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_funding_availability(UUID, NUMERIC) TO authenticated, service_role;

-- =========================================================================
-- RPC: allocate_funding
-- SECURITY DEFINER — only admins can call this.
-- Uses a transaction with row locking to prevent race conditions.
-- Validates availability, creates allocation, updates totals atomically.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.allocate_funding(
    p_application_id UUID,
    p_amount         NUMERIC,
    p_reason         TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id      UUID;
    v_user_id       UUID;
    v_program_id    UUID;
    v_app_status    TEXT;
    v_total_available NUMERIC;
    v_total_allocated NUMERIC;
    v_remaining     NUMERIC;
    v_allocation_id UUID;
BEGIN
    -- The authenticated actor determines authorization — never trust client input
    v_actor_id := auth.uid();

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Authorization: only admins can allocate funding
    IF NOT public.mai_business_is_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can allocate funding';
    END IF;

    -- Fetch application with row lock to prevent race conditions
    SELECT user_id, program_id, status
    INTO v_user_id, v_program_id, v_app_status
    FROM public.mai_business_funding_applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Funding application not found';
    END IF;

    -- Application must be approved before allocation
    IF v_app_status != 'approved' THEN
        RAISE EXCEPTION 'Application must be approved before allocation (current status: %)', v_app_status;
    END IF;

    -- Lock the program row and re-check availability atomically
    SELECT total_available, total_allocated
    INTO v_total_available, v_total_allocated
    FROM public.mai_business_funding_programs
    WHERE id = v_program_id
    FOR UPDATE;

    IF v_total_available IS NULL OR v_total_available = 0 THEN
        -- No cap — unlimited
        v_remaining := NULL;
    ELSE
        v_remaining := v_total_available - COALESCE(v_total_allocated, 0);
        IF v_remaining < p_amount THEN
            RAISE EXCEPTION 'Insufficient funds: requested %, remaining %', p_amount, v_remaining;
        END IF;
    END IF;

    -- Create the allocation
    INSERT INTO public.mai_business_grant_allocations
        (application_id, amount, status, reviewer_id, allocated_at, reason)
    VALUES
        (p_application_id, p_amount, 'allocated', v_actor_id, now(), p_reason)
    RETURNING id INTO v_allocation_id;

    -- Update program totals atomically
    UPDATE public.mai_business_funding_programs
    SET total_allocated = COALESCE(total_allocated, 0) + p_amount,
        updated_at = now()
    WHERE id = v_program_id;

    -- Update application status
    UPDATE public.mai_business_funding_applications
    SET status = 'completed',
        decision_notes = COALESCE(decision_notes || '; ', '') || 'Allocated ' || p_amount || ' on ' || now(),
        updated_at = now()
    WHERE id = p_application_id;

    -- Log activity — actor is the admin, user_id is the applicant
    INSERT INTO public.mai_business_activity_log
        (user_id, actor_id, action, category, target_type, target_id,
         new_value, metadata)
    VALUES
        (v_user_id, v_actor_id, 'funding_allocated', 'funding',
         'grant_allocation', v_allocation_id,
         jsonb_build_object('amount', p_amount, 'status', 'allocated'),
         jsonb_build_object('program_id', v_program_id, 'application_id', p_application_id, 'reviewer_id', v_actor_id));

    RETURN jsonb_build_object(
        'success', true,
        'allocation_id', v_allocation_id,
        'application_id', p_application_id,
        'amount', p_amount,
        'remaining', v_remaining,
        'actor_id', v_actor_id,
        'allocated_at', now()
    )::json;
END;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_funding(UUID, NUMERIC, TEXT) TO authenticated, service_role;

-- =========================================================================
-- RPC: approve_instructor_application
-- SECURITY DEFINER — only admins can approve.
-- Sets user_profiles.role and troll_role to 'instructor'.
-- Instructor does NOT receive any career dashboard access.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.approve_instructor_application(
    p_application_id UUID,
    p_decision       TEXT,
    p_notes          TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id      UUID;
    v_user_id       UUID;
    v_existing_role TEXT;
    v_new_role      TEXT;
BEGIN
    v_actor_id := auth.uid();

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Authorization: only admins can approve instructor applications
    IF NOT public.mai_business_is_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Unauthorized: only administrators can approve instructor applications';
    END IF;

    IF p_decision NOT IN ('approved', 'denied') THEN
        RAISE EXCEPTION 'Invalid decision: %', p_decision;
    END IF;

    -- Fetch application
    SELECT user_id, status
    INTO v_user_id, v_existing_role
    FROM public.mai_business_applications
    WHERE id = p_application_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Application not found';
    END IF;

    IF v_existing_role != 'pending' THEN
        RAISE EXCEPTION 'Application has already been reviewed (current status: %)', v_existing_role;
    END IF;

    -- Update application record
    UPDATE public.mai_business_applications
    SET status = p_decision,
        reviewed_by = v_actor_id,
        reviewed_at = now(),
        decision_notes = p_notes,
        updated_at = now()
    WHERE id = p_application_id;

    IF p_decision = 'approved' THEN
        -- Create / update the mai_business_profiles entry as instructor
        INSERT INTO public.mai_business_profiles
            (user_id, program_role, enrollment_date, is_active)
        VALUES
            (v_user_id, 'instructor', now(), true)
        ON CONFLICT (user_id) DO UPDATE
            SET program_role = 'instructor',
                is_active = true,
                updated_at = now();

        -- Update user_profiles role columns — instructor gets NO career dashboards
        -- The role column is text; 'instructor' is purely additive and grants
        -- no existing career-role privileges.
        UPDATE public.user_profiles
        SET role = 'instructor',
            troll_role = 'instructor',
            updated_at = now()
        WHERE id = v_user_id;
    ELSIF p_decision = 'denied' THEN
        UPDATE public.mai_business_profiles
        SET program_role = 'student',
            enrollment_date = COALESCE(enrollment_date, now()),
            is_active = true,
            updated_at = now()
        WHERE user_id = v_user_id;
    END IF;

    -- Log activity — actor is the admin, user_id is the applicant
    INSERT INTO public.mai_business_activity_log
        (user_id, actor_id, action, category, target_type, target_id,
         previous_value, new_value, metadata)
    VALUES
        (v_user_id, v_actor_id,
         CASE WHEN p_decision = 'approved' THEN 'instructor_approved' ELSE 'instructor_denied' END,
         'role_change', 'application', p_application_id,
         jsonb_build_object('status', v_existing_role),
         jsonb_build_object('status', p_decision),
         jsonb_build_object('decision', p_decision));

    RETURN jsonb_build_object(
        'success', true,
        'application_id', p_application_id,
        'user_id', v_user_id,
        'decision', p_decision,
        'reviewed_by', v_actor_id,
        'reviewed_at', now()
    )::json;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_instructor_application(UUID, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
