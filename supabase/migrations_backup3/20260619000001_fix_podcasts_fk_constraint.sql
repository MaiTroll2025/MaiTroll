-- Fix podcasts table foreign key relationship
-- Add missing FK constraint for host_user_id to enable Supabase joins

-- First check if the column exists, if not add it
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS host_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- If the column already exists but without FK, we need to drop and re-add the constraint
DO $$
BEGIN
  -- Check if constraint already exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'podcasts_host_user_id_fkey'
  ) THEN
    ALTER TABLE podcasts DROP CONSTRAINT podcasts_host_user_id_fkey;
  END IF;
  
  -- Add the FK constraint
  ALTER TABLE podcasts 
    ADD CONSTRAINT podcasts_host_user_id_fkey 
    FOREIGN KEY (host_user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
END $$;

-- Ensure RLS policies are properly set
ALTER TABLE podcasts ENABLE ROW LEVEL SECURITY;

-- Drop and recreate the policy to ensure it works
DROP POLICY IF EXISTS "public can read podcasts" ON podcasts;
CREATE POLICY "public can read podcasts" ON podcasts FOR SELECT USING (TRUE);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';