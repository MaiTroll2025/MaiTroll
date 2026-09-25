-- Migration: Auto-delete notifications older than 7 days
-- Creates a scheduled job to clean up old notifications and jail_notifications

-- 1. Create function to delete old notifications
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_count integer;
BEGIN
    -- Delete notifications older than 7 days
    DELETE FROM public.notifications
    WHERE created_at < now() - interval '7 days';

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- Delete jail_notifications older than 7 days
    DELETE FROM public.jail_notifications
    WHERE created_at < now() - interval '7 days';

    GET DIAGNOSTICS v_deleted_count = v_deleted_count + ROW_COUNT;

    -- Log the cleanup (optional - can be removed if logging table doesn't exist)
    -- INSERT INTO public.system_cleanup_logs (job_name, deleted_count, run_at)
    -- VALUES ('cleanup_old_notifications', v_deleted_count, now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications() TO service_role;

-- 2. Create pg_cron job to run daily at 3 AM UTC
-- This requires the pg_cron extension to be enabled
-- Uncomment and run manually after enabling pg_cron:
-- SELECT cron.schedule('cleanup-old-notifications', '0 3 * * *', 'SELECT public.cleanup_old_notifications();');

-- 3. Alternative: Create a function that can be called via Supabase Edge Function/cron
-- This can be scheduled using Supabase Dashboard -> Database -> Cron Jobs

COMMENT ON FUNCTION public.cleanup_old_notifications() IS 
'Deletes notifications and jail_notifications older than 7 days. Run daily via pg_cron or Supabase scheduled functions.';