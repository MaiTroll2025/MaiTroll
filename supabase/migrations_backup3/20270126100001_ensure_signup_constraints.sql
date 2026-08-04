-- Ensure constraints exist for signup flow to work correctly
-- This fixes the "no unique or exclusion constraint matching the ON CONFLICT specification" error

-- 1. Ensure user_profiles has a primary key on id
DO $$
BEGIN
  -- Try to add the constraint. If it fails due to existing PK, we catch it.
  BEGIN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);
  EXCEPTION
    WHEN invalid_table_definition THEN
      -- Table already has a primary key.
      RAISE NOTICE 'user_profiles already has a primary key';
    WHEN duplicate_object THEN
      -- Constraint name already exists
      RAISE NOTICE 'user_profiles_pkey already exists';
    WHEN OTHERS THEN
      RAISE NOTICE 'Error adding PK to user_profiles: %', SQLERRM;
  END;
END $$;

-- 2. Ensure user_credit has a primary key on user_id
DO $$
BEGIN
  -- Only attempt if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_credit') THEN
    BEGIN
      ALTER TABLE public.user_credit ADD CONSTRAINT user_credit_pkey PRIMARY KEY (user_id);
    EXCEPTION
      WHEN invalid_table_definition THEN
        RAISE NOTICE 'user_credit already has a primary key';
      WHEN duplicate_object THEN
        RAISE NOTICE 'user_credit_pkey already exists';
      WHEN OTHERS THEN
        RAISE NOTICE 'Error adding PK to user_credit: %', SQLERRM;
    END;
  END IF;
END $$;
