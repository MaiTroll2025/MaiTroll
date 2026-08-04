-- Add expires_at column to user_inventory if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_inventory' AND column_name = 'expires_at') THEN
        ALTER TABLE public.user_inventory ADD COLUMN expires_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add expires_at column to user_perks if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_perks' AND column_name = 'expires_at') THEN
        ALTER TABLE public.user_perks ADD COLUMN expires_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add expires_at column to user_insurances if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_insurances' AND column_name = 'expires_at') THEN
        ALTER TABLE public.user_insurances ADD COLUMN expires_at TIMESTAMPTZ;
    END IF;
END $$;

-- Update the cleanup function just in case it wasn't applied correctly
CREATE OR REPLACE FUNCTION public.cleanup_expired_user_purchases()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cutoff_time timestamptz;
BEGIN
  -- Set cutoff time to 10 seconds ago
  cutoff_time := NOW() - INTERVAL '10 seconds';

  -- 1. Delete expired from user_inventory
  DELETE FROM public.user_inventory
  WHERE expires_at IS NOT NULL 
    AND expires_at < cutoff_time;

  -- 2. Delete expired from user_perks
  DELETE FROM public.user_perks
  WHERE expires_at IS NOT NULL 
    AND expires_at < cutoff_time;

  -- 3. Delete expired from user_insurances
  DELETE FROM public.user_insurances
  WHERE expires_at IS NOT NULL 
    AND expires_at < cutoff_time;

  -- 4. Also clean up user_purchases if it exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_purchases') THEN
      DELETE FROM public.user_purchases
      WHERE expires_at IS NOT NULL 
        AND expires_at < cutoff_time;
  END IF;

  -- 5. Remove items from user_active_items if the user no longer owns a valid copy
  DELETE FROM public.user_active_items uai
  WHERE NOT EXISTS (
      SELECT 1 FROM public.user_inventory ui
      WHERE ui.user_id = uai.user_id 
      AND ui.item_id = uai.item_id
      AND (ui.expires_at IS NULL OR ui.expires_at > cutoff_time)
  );
  
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_user_purchases() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_user_purchases() TO service_role;
