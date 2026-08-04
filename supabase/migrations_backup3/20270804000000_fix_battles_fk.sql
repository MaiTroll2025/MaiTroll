
-- Fix Foreign Key constraints on battles table to allow cascading deletes
-- Column: challenger_stream_id
ALTER TABLE public.battles
DROP CONSTRAINT IF EXISTS battles_challenger_stream_id_fkey;

ALTER TABLE public.battles
ADD CONSTRAINT battles_challenger_stream_id_fkey
    FOREIGN KEY (challenger_stream_id)
    REFERENCES public.streams(id)
    ON DELETE CASCADE;

-- Column: opponent_stream_id
ALTER TABLE public.battles
DROP CONSTRAINT IF EXISTS battles_opponent_stream_id_fkey;

ALTER TABLE public.battles
ADD CONSTRAINT battles_opponent_stream_id_fkey
    FOREIGN KEY (opponent_stream_id)
    REFERENCES public.streams(id)
    ON DELETE CASCADE;

-- Column: winner_stream_id (if exists)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battles' AND column_name = 'winner_stream_id') THEN
        ALTER TABLE public.battles
        DROP CONSTRAINT IF EXISTS battles_winner_stream_id_fkey;

        ALTER TABLE public.battles
        ADD CONSTRAINT battles_winner_stream_id_fkey
            FOREIGN KEY (winner_stream_id)
            REFERENCES public.streams(id)
            ON DELETE CASCADE;
    END IF;
END $$;
