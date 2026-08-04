-- Fix the trigger that's causing the "record 'new' has no field 'updated_at'" error
-- This error happens when a trigger tries to update 'updated_at' on a table that doesn't have it.
-- The specific table identified is 'broadcaster_applications'.

-- 1. Ensure the column exists
ALTER TABLE public.broadcaster_applications 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Define/Update the trigger function to be safe
CREATE OR REPLACE FUNCTION update_broadcaster_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if column exists (double check inside trigger for safety)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'broadcaster_applications' 
      AND column_name = 'updated_at'
  ) THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Drop and Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS broadcaster_applications_updated_at ON public.broadcaster_applications;

CREATE TRIGGER broadcaster_applications_updated_at
BEFORE UPDATE ON public.broadcaster_applications
FOR EACH ROW
EXECUTE FUNCTION update_broadcaster_applications_updated_at();
