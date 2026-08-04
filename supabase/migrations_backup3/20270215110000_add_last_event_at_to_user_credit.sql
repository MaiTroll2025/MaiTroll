-- Add last_event_at column to user_credit if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_credit' AND column_name = 'last_event_at') THEN
        ALTER TABLE public.user_credit ADD COLUMN last_event_at TIMESTAMPTZ;
    END IF;
END $$;
