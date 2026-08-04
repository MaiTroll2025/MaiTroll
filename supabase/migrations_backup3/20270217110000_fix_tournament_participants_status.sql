-- Fix missing status column in tournament_participants
DO $$
BEGIN
    -- 1. Add column if not exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tournament_participants' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.tournament_participants 
        ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
    END IF;

    -- 2. Ensure constraint exists (drop and recreate to be safe)
    ALTER TABLE public.tournament_participants DROP CONSTRAINT IF EXISTS tournament_participants_status_check;
    
    ALTER TABLE public.tournament_participants 
    ADD CONSTRAINT tournament_participants_status_check 
    CHECK (status IN ('active', 'eliminated', 'withdrawn', 'winner'));

END $$;

-- Force schema cache reload (just in case)
NOTIFY pgrst, 'reload schema';
