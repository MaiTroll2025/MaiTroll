DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_errors') THEN
        -- Allow authenticated users to insert errors
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_errors' AND policyname = 'Authenticated users can insert errors') THEN
            CREATE POLICY "Authenticated users can insert errors" ON "public"."system_errors"
            FOR INSERT
            TO authenticated
            WITH CHECK (true);
        END IF;
    END IF;
END $$;
