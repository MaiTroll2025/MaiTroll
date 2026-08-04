
-- 1. Fix Payout Email Saving (RLS)
-- Check if policy exists before creating to avoid errors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_profiles' 
        AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile" ON public.user_profiles
        FOR UPDATE
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;
END $$;

-- 2. Fix Chat Message Deletion (RLS)
-- Allow authors to delete
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'stream_messages' 
        AND policyname = 'Users can delete own messages'
    ) THEN
        CREATE POLICY "Users can delete own messages" ON public.stream_messages
        FOR DELETE
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- Allow Broadcasters (Stream Owners) to delete
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'stream_messages' 
        AND policyname = 'Broadcasters can delete messages in their stream'
    ) THEN
        CREATE POLICY "Broadcasters can delete messages in their stream" ON public.stream_messages
        FOR DELETE
        USING (
            EXISTS (
                SELECT 1 FROM public.streams
                WHERE id = stream_messages.stream_id
                AND user_id = auth.uid()
            )
        );
    END IF;
END $$;

-- Allow Moderators to delete
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'stream_messages' 
        AND policyname = 'Moderators can delete messages'
    ) THEN
        CREATE POLICY "Moderators can delete messages" ON public.stream_messages
        FOR DELETE
        USING (
            EXISTS (
                SELECT 1 FROM public.stream_moderators sm
                JOIN public.streams s ON s.user_id = sm.broadcaster_id
                WHERE s.id = stream_messages.stream_id
                AND sm.user_id = auth.uid()
            )
        );
    END IF;
END $$;
