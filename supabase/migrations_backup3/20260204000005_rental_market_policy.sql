-- Migration to allow viewing rental listings
-- Adds RLS policy for public to see houses listed for rent

-- Ensure feature_flags column exists on user_houses
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_houses' AND column_name = 'feature_flags') THEN
        ALTER TABLE public.user_houses ADD COLUMN feature_flags JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Allow anyone to see houses that are marked for rent
CREATE POLICY "Public view rentable houses" ON public.user_houses 
FOR SELECT 
USING (
  (feature_flags->>'is_for_rent')::boolean = true
);
