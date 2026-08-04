-- Fix relationship between audit_logs and user_profiles

-- Step 1: Add FK from user_profiles.id to auth.users(id)
-- (Required so audit_logs can have an FK pointing to user_profiles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'user_profiles_id_fkey'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Step 2: Change audit_logs.user_id FK from auth.users(id) to user_profiles(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'audit_logs_user_id_fkey'
  ) THEN
    ALTER TABLE public.audit_logs
      DROP CONSTRAINT audit_logs_user_id_fkey;
  END IF;

  ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES user_profiles(id)
    ON DELETE CASCADE;
END $$;
