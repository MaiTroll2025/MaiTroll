-- Migration: Mai Business — Performance Indexes
-- Created based on actual query patterns identified in the spec.
-- Avoids redundant indexes on columns that already have them.

BEGIN;

-- =========================================================================
-- Profiles
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_pports_user_id
    ON public.mai_business_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_pports_program_role
    ON public.mai_business_profiles(program_role);
CREATE INDEX IF NOT EXISTS idx_mai_pports_is_active
    ON public.mai_business_profiles(is_active);

-- =========================================================================
-- Applications (instructor/admin)
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_apps_user_id
    ON public.mai_business_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_apps_status
    ON public.mai_business_applications(status);
CREATE INDEX IF NOT EXISTS idx_mai_apps_type
    ON public.mai_business_applications(type);
CREATE INDEX IF NOT EXISTS idx_mai_apps_user_type
    ON public.mai_business_applications(user_id, type);

-- =========================================================================
-- Businesses
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_bus_user_id
    ON public.mai_business_businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_bus_stage
    ON public.mai_business_businesses(business_stage);

-- =========================================================================
-- Progress
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_prog_user_id
    ON public.mai_business_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_prog_course_id
    ON public.mai_business_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_mai_progress_lesson_id
    ON public.mai_business_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_mai_prog_module_id
    ON public.mai_business_progress(module_id);
CREATE INDEX IF NOT EXISTS idx_mai_prog_status
    ON public.mai_business_progress(status);
CREATE INDEX IF NOT EXISTS idx_mai_progress_user_course
    ON public.mai_business_progress(user_id, course_id);

-- =========================================================================
-- Assessment attempts
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_att_user_id
    ON public.mai_business_assessment_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_att_assessment_id
    ON public.mai_business_assessment_attempts(assessment_id);

-- =========================================================================
-- Assessments
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_asmt_module_id
    ON public.mai_business_assessments(module_id);
CREATE INDEX IF NOT EXISTS idx_mai_asmt_is_final
    ON public.mai_business_assessments(is_final_exam);

-- =========================================================================
-- Business plans
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_bp_user_id
    ON public.mai_business_business_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_bp_status
    ON public.mai_business_business_plans(status);
CREATE INDEX IF NOT EXISTS idx_mai_bp_version
    ON public.mai_business_business_plans(user_id, version DESC);

-- =========================================================================
-- Funding programs
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_fp_status
    ON public.mai_business_funding_programs(status);
CREATE INDEX IF NOT EXISTS idx_mai_fp_funding_type
    ON public.mai_business_funding_programs(funding_type);
CREATE INDEX IF NOT EXISTS idx_mai_fp_organization
    ON public.mai_business_funding_programs(organization);

-- =========================================================================
-- Funding applications
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_fa_user_id
    ON public.mai_business_funding_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_fa_program_id
    ON public.mai_business_funding_applications(program_id);
CREATE INDEX IF NOT EXISTS idx_mai_fa_status
    ON public.mai_business_funding_applications(status);
CREATE INDEX IF NOT EXISTS idx_mai_funding_apps_user_program
    ON public.mai_business_funding_applications(user_id, program_id);

-- =========================================================================
-- Grant allocations
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_ga_application_id
    ON public.mai_business_grant_allocations(application_id);
CREATE INDEX IF NOT EXISTS idx_mai_ga_reviewer_id
    ON public.mai_business_grant_allocations(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_mai_ga_status
    ON public.mai_business_grant_allocations(status);
CREATE INDEX IF NOT EXISTS idx_mai_ga_allocated_at
    ON public.mai_business_grant_allocations(allocated_at DESC);

-- =========================================================================
-- Documents
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_docs_user_id
    ON public.mai_business_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_docs_type
    ON public.mai_business_documents(type);
CREATE INDEX IF NOT EXISTS idx_mai_docs_status
    ON public.mai_business_documents(status);
CREATE INDEX IF NOT EXISTS idx_mai_docs_related
    ON public.mai_business_documents(related_type, related_id);

-- =========================================================================
-- Resources
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_res_category
    ON public.mai_business_resources(category);
CREATE INDEX IF NOT EXISTS idx_mai_res_status
    ON public.mai_business_resources(status);
CREATE INDEX IF NOT EXISTS idx_mai_res_name
    ON public.mai_business_resources(name);

-- =========================================================================
-- Activity log
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_act_user_id
    ON public.mai_business_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_act_actor_id
    ON public.mai_business_activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_mai_act_category
    ON public.mai_business_activity_log(category);
CREATE INDEX IF NOT EXISTS idx_mai_act_action
    ON public.mai_business_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_mai_act_target
    ON public.mai_business_activity_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_mai_act_created_at
    ON public.mai_business_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mai_activity_user_created
    ON public.mai_business_activity_log(user_id, created_at DESC);

-- =========================================================================
-- Certificates
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_certs_user_id
    ON public.mai_business_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_certs_course_id
    ON public.mai_business_certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_mai_certs_status
    ON public.mai_business_certificates(status);
CREATE INDEX IF NOT EXISTS idx_mai_certs_identifier
    ON public.mai_business_certificates(identifier);

-- =========================================================================
-- Course modules + lessons (hierarchical lookups)
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_mod_course
    ON public.mai_business_course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_mai_mod_week
    ON public.mai_business_course_modules(course_id, week_number);
CREATE INDEX IF NOT EXISTS idx_mai_lesson_module
    ON public.mai_business_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_mai_lesson_order
    ON public.mai_business_lessons(module_id, order_index);

COMMIT;
