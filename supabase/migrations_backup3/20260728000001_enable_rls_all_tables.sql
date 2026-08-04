-- Enable RLS on all tables and add basic policies where missing

-- 1. Enable RLS on all public tables that do not already have it
DO $$
DECLARE
    t record;
BEGIN
    FOR t IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename NOT IN ('spatial_ref_sys')
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = t.tablename
            AND n.nspname = 'public'
            AND c.relrowsecurity = true
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
        END IF;
    END LOOP;
END $$;

-- 2. Add basic fallback policies for tables with no existing policies
DO $$
DECLARE
    t record;
    policy_count integer;
BEGIN
    FOR t IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename NOT IN ('spatial_ref_sys')
    LOOP
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = t.tablename;
        
        IF policy_count = 0 THEN
            BEGIN
                EXECUTE format('CREATE POLICY "authenticated_read" ON public.%I FOR SELECT USING (auth.uid() IS NOT NULL)', t.tablename);
            EXCEPTION WHEN duplicate_object THEN NULL; END;
            
            BEGIN
                EXECUTE format('CREATE POLICY "authenticated_write" ON public.%I FOR ALL USING (auth.uid() IS NOT NULL)', t.tablename);
            EXCEPTION WHEN duplicate_object THEN NULL; END;
        END IF;
    END LOOP;
END $$;
