-- Add free_troll_coins column to user_profiles if it doesn't exist
-- This column is referenced in the auth Edge Function and seems to be intended for tracking free/earned coins separately from paid coins.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles' 
    AND column_name = 'free_troll_coins'
  ) THEN
    ALTER TABLE public.user_profiles
    ADD COLUMN free_troll_coins INTEGER DEFAULT 0 NOT NULL;
    
    COMMENT ON COLUMN public.user_profiles.free_troll_coins IS 'Tracks coins earned for free (e.g. signup bonus, daily rewards) separate from paid coins.';
  END IF;
END $$;
