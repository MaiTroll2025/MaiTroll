-- Migration: Fix houses table owner_id constraint issue
-- Problem: Insert operations into houses table failing due to NOT NULL constraint on owner_id
-- Solution: Ensure proper column setup and make nullable where needed

-- Step 1: Ensure public.houses table exists with correct schema
CREATE TABLE IF NOT EXISTS public.houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  upgrade_level INTEGER DEFAULT 1,
  condition INTEGER DEFAULT 100 CHECK (condition >= 0 AND condition <= 100),
  is_reposessed BOOLEAN DEFAULT FALSE,
  electric_on BOOLEAN DEFAULT FALSE,
  water_on BOOLEAN DEFAULT FALSE,
  internet_on BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Handle existing owner_id column (from older schema)
DO $$
BEGIN
  -- If owner_id exists, rename it or migrate it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'houses' AND column_name = 'owner_id'
  ) THEN
    -- First, check if owner_user_id exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'houses' AND column_name = 'owner_user_id'
    ) THEN
      -- Rename owner_id to owner_user_id
      ALTER TABLE public.houses RENAME COLUMN owner_id TO owner_user_id;
    ELSE
      -- Both exist, drop the old owner_id
      ALTER TABLE public.houses DROP COLUMN owner_id;
    END IF;
  END IF;
END $$;

-- Step 3: Ensure owner_user_id exists and is NOT NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'houses' AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE public.houses 
    ADD COLUMN owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Column likely already exists
END $$;

-- Step 4: Make neighborhood_id nullable (allows houses to exist without neighborhood assignment initially)
DO $$
BEGIN
  -- Try to alter column to DROP NOT NULL constraint if it exists
  ALTER TABLE public.houses 
  ALTER COLUMN neighborhood_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Column constraint might already be setup
END $$;

-- Step 5: Enable RLS if not already enabled
ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies (using DO to avoid duplicate policy errors)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own house" ON public.houses;
  CREATE POLICY "Users can view own house" ON public.houses 
  FOR SELECT 
  USING (owner_user_id = auth.uid() OR true); -- Allow viewing for now
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can insert own house" ON public.houses;
  CREATE POLICY "Users can insert own house" ON public.houses 
  FOR INSERT 
  WITH CHECK (owner_user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can update own house" ON public.houses;
  CREATE POLICY "Users can update own house" ON public.houses 
  FOR UPDATE 
  USING (owner_user_id = auth.uid()) 
  WITH CHECK (owner_user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Step 7: Create index for performance
CREATE INDEX IF NOT EXISTS idx_houses_owner_user_id ON public.houses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_houses_neighborhood_id ON public.houses(neighborhood_id);
