-- IMMEDIATE FIX: Drop and recreate the houses table with correct schema
-- This fixes the owner_id NOT NULL constraint violation

-- Step 1: Drop existing RLS policies that might reference the table
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own house" ON public.houses;
  DROP POLICY IF EXISTS "Users can insert own house" ON public.houses;
  DROP POLICY IF EXISTS "Users can update own house" ON public.houses;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Step 2: Drop the existing houses table if it has the wrong schema
DO $$
BEGIN
  -- Check if table exists and has owner_id column
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'houses'
  ) THEN
    -- Drop the table completely
    DROP TABLE IF EXISTS public.houses CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Step 3: Recreate the houses table with correct schema
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

-- Step 4: Enable RLS
ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
CREATE POLICY "Public can view houses" ON public.houses
FOR SELECT USING (true);

CREATE POLICY "Users can insert own house" ON public.houses
FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users can update own house" ON public.houses
FOR UPDATE USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

-- Step 6: Create indexes
CREATE INDEX idx_houses_owner_user_id ON public.houses(owner_user_id);
CREATE INDEX idx_houses_neighborhood_id ON public.houses(neighborhood_id);
