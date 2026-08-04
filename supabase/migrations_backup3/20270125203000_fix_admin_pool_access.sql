-- Allow public read access to admin_pool so the Public Pool page can show the balance
-- This table contains system-wide stats which are generally public or low-risk to expose read-only.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_pool' 
        AND policyname = 'Public read admin pool'
    ) THEN
        CREATE POLICY "Public read admin pool" ON public.admin_pool FOR SELECT USING (true);
    END IF;
END
$$;

-- Add admin_pool to realtime publication so the frontend updates live
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'admin_pool'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_pool;
    END IF;
END
$$;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
