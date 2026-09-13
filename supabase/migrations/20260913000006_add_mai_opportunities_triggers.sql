-- Migration: Mai Business — Activity Logging Triggers
-- Automatic triggers that write to mai_business_activity_log on
-- INSERT/UPDATE. The actor_id is determined from auth.uid() so that
-- administrative actions are correctly attributed (never blindly set
-- both user_id and actor_id to the same "affected" user).
--
-- For user-facing tables, the affected user_id = auth.uid() and actor_id = auth.uid().
-- For admin/review tables, the trigger logs the system action; the actual
-- reviewer attribution happens inside the SECURITY DEFINER RPCs in migration 05.

BEGIN;

-- =========================================================================
-- Generic activity-log trigger function.
-- Logs INSERT and UPDATE actions on any table passed via tg_arg... .
-- The affected user_id is always auth.uid() (the row owner for user tables,
-- the reviewer for admin tables).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.mai_business_log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID;
    v_user_id  UUID;
    v_action   TEXT;
    v_target   TEXT;
    v_target_id UUID;
BEGIN
    -- Determine the authenticated actor from session
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Determine the affected user_id (the row owner)
    -- Most tables have a user_id column
    IF TG_OP = 'INSERT' THEN
        v_action := 'insert';
        v_user_id := NEW.user_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
        v_user_id := NEW.user_id;
    ELSE
        RETURN NEW;
    END IF;

    v_target := TG_TABLE_NAME;
    v_target_id := NEW.id;

    INSERT INTO public.mai_business_activity_log
        (user_id, actor_id, action, category, target_type, target_id,
         previous_value, new_value, created_at)
    VALUES
        (v_user_id, v_actor_id, v_action, 'system', v_target, v_target_id,
         CASE WHEN TG_OP = 'UPDATE' THEN
              to_jsonb(OLD) - 'created_at' - 'updated_at'
         ELSE NULL END,
         to_jsonb(NEW) - 'created_at' - 'updated_at',
         now());

    RETURN NEW;
END;
$$;

-- =========================================================================
-- Attach triggers to user-facing tables where user_id is the owner.
-- These use the generic trigger — user_id = row owner, actor_id = auth.uid().
-- =========================================================================

-- mai_business_businesses
DROP TRIGGER IF EXISTS trg_mai_business_log_businesses ON public.mai_business_businesses;
CREATE TRIGGER trg_mai_business_log_businesses
    AFTER INSERT OR UPDATE ON public.mai_business_businesses
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_log_activity();

-- mai_business_business_plans
DROP TRIGGER IF EXISTS trg_mai_business_log_business_plans ON public.mai_business_business_plans;
CREATE TRIGGER trg_mai_business_log_business_plans
    AFTER INSERT OR UPDATE ON public.mai_business_business_plans
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_log_activity();

-- mai_business_progress
DROP TRIGGER IF EXISTS trg_mai_business_log_progress ON public.mai_business_progress;
CREATE TRIGGER trg_mai_business_log_progress
    AFTER INSERT OR UPDATE ON public.mai_business_progress
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_log_activity();

-- mai_business_assessment_attempts
DROP TRIGGER IF EXISTS trg_mai_business_log_assessment_attempts ON public.mai_business_assessment_attempts;
CREATE TRIGGER trg_mai_business_log_assessment_attempts
    AFTER INSERT ON public.mai_business_assessment_attempts
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_log_activity();

-- mai_business_funding_applications
DROP TRIGGER IF EXISTS trg_mai_business_log_funding_applications ON public.mai_business_funding_applications;
CREATE TRIGGER trg_mai_business_log_funding_applications
    AFTER INSERT OR UPDATE ON public.mai_business_funding_applications
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_log_activity();

-- mai_business_certificates
DROP TRIGGER IF EXISTS trg_mai_business_log_certificates ON public.mai_business_certificates;
CREATE TRIGGER trg_mai_business_log_certificates
    AFTER INSERT OR UPDATE ON public.mai_business_certificates
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_log_activity();

-- mai_business_documents
DROP TRIGGER IF EXISTS trg_mai_business_log_documents ON public.mai_business_documents;
CREATE TRIGGER trg_mai_business_log_documents
    AFTER INSERT OR UPDATE ON public.mai_business_documents
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_log_activity();

-- mai_business_applications (instructor/admin applications)
DROP TRIGGER IF EXISTS trg_mai_business_log_applications ON public.mai_business_applications;
CREATE TRIGGER trg_mai_business_log_applications
    AFTER INSERT OR UPDATE ON public.mai_business_applications
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_log_activity();

-- mai_business_profiles (enrollment)
DROP TRIGGER IF EXISTS trg_mai_business_log_profiles ON public.mai_business_profiles;
CREATE TRIGGER trg_mai_business_log_profiles
    AFTER INSERT OR UPDATE ON public.mai_business_profiles
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_log_activity();

COMMIT;
