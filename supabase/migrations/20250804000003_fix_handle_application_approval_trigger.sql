BEGIN;

-- Fix handle_application_approval() trigger function.
--
-- Problems with the original:
-- 1. ON CONFLICT (user_id) fails when agency_members only has
--    UNIQUE(agency_id, user_id) instead of UNIQUE(user_id) (error 42P10).
-- 2. The hytro gaming agency_members table doesn't even have agency_id column,
--    so the INSERT would fail regardless.
-- 3. approve_agency_application_atomic already handles the member upsert itself
--    (UPDATE then INSERT fallback), so the trigger's member INSERT is redundant.
--
-- Fix: Remove the member INSERT from the trigger entirely. The trigger should
-- only handle audit logging. Member management is done by the atomic RPC.
CREATE OR REPLACE FUNCTION public.handle_application_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        PERFORM public.log_agency_action(
            NEW.reviewed_by, NEW.user_id, 'application_approved',
            'agency_applications', NEW.id,
            jsonb_build_object('status', 'pending'),
            jsonb_build_object('status', 'approved', 'role', 'creator')
        );
    ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        PERFORM public.log_agency_action(
            NEW.reviewed_by, NEW.user_id, 'application_rejected',
            'agency_applications', NEW.id,
            jsonb_build_object('status', 'pending'),
            jsonb_build_object('status', 'rejected', 'reason', COALESCE(NEW.rejection_reason, 'No reason provided'))
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
