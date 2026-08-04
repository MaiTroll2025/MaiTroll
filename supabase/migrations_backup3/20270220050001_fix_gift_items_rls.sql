-- Enable RLS on gift_items
ALTER TABLE public.gift_items ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read gift items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'gift_items' 
        AND policyname = 'Public read access'
    ) THEN
        CREATE POLICY "Public read access" 
        ON public.gift_items 
        FOR SELECT 
        USING (true);
    END IF;
END $$;

-- Allow service role full access (default, but good to be explicit if needed, though service role bypasses RLS)
-- No need for specific service role policy as it bypasses RLS.

-- Grant access to authenticated and anon roles
GRANT SELECT ON public.gift_items TO authenticated, anon;
