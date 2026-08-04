-- Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view messages (public)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'messages' 
        AND policyname = 'Public can view messages'
    ) THEN
        CREATE POLICY "Public can view messages"
        ON messages FOR SELECT
        USING (true);
    END IF;
END $$;

-- Policy: Authenticated users can insert messages (must match their user_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'messages' 
        AND policyname = 'Authenticated users can insert messages'
    ) THEN
        CREATE POLICY "Authenticated users can insert messages"
        ON messages FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Policy: Service role has full access (implicit, but good to know)
-- No need to explicitly define for service_role as it bypasses RLS
