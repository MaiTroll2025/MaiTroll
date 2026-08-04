-- Fix RLS policies for properties table
-- Allow users to insert their own properties (e.g. starter home)
-- Fix potential issue with UPDATE policy referencing wrong column name

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Drop incorrect policies if they exist (from 20270122140000_fix_linter_issues.sql)
DROP POLICY IF EXISTS "Owners update properties" ON public.properties;

-- Re-create correct policies
-- 1. Owners can update their own properties
CREATE POLICY "Owners update properties"
ON public.properties
FOR UPDATE
USING (auth.uid() = owner_user_id);

-- 2. Users can insert their own properties
DROP POLICY IF EXISTS "Users can insert own properties" ON public.properties;
CREATE POLICY "Users can insert own properties"
ON public.properties
FOR INSERT
WITH CHECK (auth.uid() = owner_user_id);

-- 3. Public read access (usually already exists, but safe to ensure)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'properties' AND policyname = 'Public read properties'
    ) THEN
        CREATE POLICY "Public read properties" ON public.properties FOR SELECT USING (true);
    END IF;
END $$;
