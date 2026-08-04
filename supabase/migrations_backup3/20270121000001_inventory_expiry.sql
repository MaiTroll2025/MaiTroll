-- Migration: Inventory Expiration Logic
-- 1. Function to clean up expired purchases and sync active items
-- 2. Optional cron job to run it hourly

-- Create the cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_user_purchases()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- 1. Delete expired purchases
  WITH deleted AS (
    DELETE FROM public.user_purchases
    WHERE expires_at IS NOT NULL 
      AND expires_at < NOW()
    RETURNING *
  )
  SELECT count(*) INTO deleted_count FROM deleted;

  -- 2. Remove items from user_active_items if the user no longer owns a valid copy
  -- (i.e., all copies are expired or deleted)
  DELETE FROM public.user_active_items uai
  WHERE NOT EXISTS (
      SELECT 1 FROM public.user_purchases up
      WHERE up.user_id = uai.user_id 
      AND up.item_id = uai.item_id
      AND (up.expires_at IS NULL OR up.expires_at > NOW())
  );
  
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_user_purchases() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_user_purchases() TO service_role;

-- Try to schedule it if pg_cron is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Schedule to run every hour
    -- Check if already scheduled to avoid duplicates
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup_expired_purchases') THEN
        PERFORM cron.schedule('cleanup_expired_purchases', '0 * * * *', 'SELECT public.cleanup_expired_user_purchases()');
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if pg_cron is not set up or permission denied
  RAISE NOTICE 'Could not schedule cron job: %', SQLERRM;
END $$;
