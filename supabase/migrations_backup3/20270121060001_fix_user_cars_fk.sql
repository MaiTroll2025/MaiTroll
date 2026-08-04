-- Fix user_cars foreign key constraint
-- Changes the FK from user_profiles to auth.users to prevent FK constraint errors

-- Drop the old FK constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_cars_user_id_fkey'
      AND table_name = 'user_cars'
  ) THEN
    ALTER TABLE public.user_cars DROP CONSTRAINT user_cars_user_id_fkey;
  END IF;
END $$;

-- Add the correct FK constraint to auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'user_cars_user_id_fkey'
      AND table_name = 'user_cars'
  ) THEN
    ALTER TABLE public.user_cars
      ADD CONSTRAINT user_cars_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
