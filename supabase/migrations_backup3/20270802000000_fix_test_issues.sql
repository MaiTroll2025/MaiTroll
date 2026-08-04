
-- Fix missing columns in stream_guests
DO $$
BEGIN
    -- Add last_billed_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'stream_guests' 
        AND column_name = 'last_billed_at'
    ) THEN
        ALTER TABLE public.stream_guests ADD COLUMN last_billed_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add joined_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'stream_guests' 
        AND column_name = 'joined_at'
    ) THEN
        ALTER TABLE public.stream_guests ADD COLUMN joined_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add total_paid
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'stream_guests' 
        AND column_name = 'total_paid'
    ) THEN
        ALTER TABLE public.stream_guests ADD COLUMN total_paid INTEGER DEFAULT 0;
    END IF;

    -- Ensure Unique Constraint on (stream_id, user_id)
    -- First, check if a constraint exists (this is tricky to check generically by name if auto-generated)
    -- So we'll try to add it and catch exception, or drop by name if we know it.
    -- Better: Drop if exists by a likely name, then add.
    
    -- Try to drop constraint if it exists (assuming default naming convention or explicit name)
    BEGIN
        ALTER TABLE public.stream_guests DROP CONSTRAINT IF EXISTS stream_guests_stream_id_user_id_key;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Add the constraint
    -- Note: We wrap in a block to catch "already exists" if name is different
    BEGIN
        ALTER TABLE public.stream_guests ADD CONSTRAINT stream_guests_stream_id_user_id_key UNIQUE (stream_id, user_id);
    EXCEPTION WHEN duplicate_table THEN 
        NULL; -- already exists
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not add constraint: %', SQLERRM;
    END;

END $$;

-- Fix Battles RLS Policy (referencing non-existent broadcaster_id column)
DROP POLICY IF EXISTS "Creators insert battles" ON public.battles;
DROP POLICY IF EXISTS "Participants update battles" ON public.battles;
DROP POLICY IF EXISTS "Participants view own battles" ON public.battles;

-- Re-create correct policies using user_id instead of broadcaster_id
CREATE POLICY "Creators insert battles" ON public.battles
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.streams s 
            WHERE s.id = battles.challenger_stream_id 
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Participants update battles" ON public.battles
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.streams s 
            WHERE s.id = battles.challenger_stream_id 
            AND s.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.streams s 
            WHERE s.id = battles.opponent_stream_id 
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Participants view own battles" ON public.battles
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            EXISTS (
                SELECT 1 FROM public.streams s 
                WHERE s.id = battles.challenger_stream_id AND s.user_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM public.streams s 
                WHERE s.id = battles.opponent_stream_id AND s.user_id = auth.uid()
            )
        )
    );

-- Also ensure public read for battles
DROP POLICY IF EXISTS "Public view battles" ON public.battles;
CREATE POLICY "Public view battles" ON public.battles FOR SELECT USING (true);
