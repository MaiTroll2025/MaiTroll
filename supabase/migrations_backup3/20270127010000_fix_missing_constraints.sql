-- Fix missing constraints that cause "no unique or exclusion constraint matching the ON CONFLICT specification"

-- 1. Ensure user_credit has a unique constraint on user_id
DO $$
BEGIN
  -- Check if user_credit table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_credit') THEN
    
    -- Check if there is any constraint (PK or Unique) on user_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'public' 
      AND tc.table_name = 'user_credit'
      AND ccu.column_name = 'user_id'
      AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
    ) THEN
      -- Try to add Primary Key first
      BEGIN
        ALTER TABLE public.user_credit ADD PRIMARY KEY (user_id);
      EXCEPTION WHEN OTHERS THEN
        -- If PK fails (e.g. nulls or duplicates), try unique index
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_credit_user_id_unique ON public.user_credit(user_id);
      END;
    END IF;
  END IF;
END $$;

-- 2. Ensure user_profiles has a unique constraint on id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'public' 
      AND tc.table_name = 'user_profiles'
      AND ccu.column_name = 'id'
      AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
    ) THEN
      BEGIN
        ALTER TABLE public.user_profiles ADD PRIMARY KEY (id);
      EXCEPTION WHEN OTHERS THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_id_unique ON public.user_profiles(id);
      END;
    END IF;
  END IF;
END $$;
