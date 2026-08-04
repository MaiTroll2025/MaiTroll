-- Fix Viewer Count Schema
-- Ensures stream_viewers table exists and streams table has correct columns

-- 1. Create stream_viewers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.stream_viewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now(),
    last_seen TIMESTAMPTZ DEFAULT now(),
    UNIQUE(stream_id, user_id)
);

-- 2. Add current_viewers to streams if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'current_viewers') THEN
        ALTER TABLE public.streams ADD COLUMN current_viewers INTEGER DEFAULT 0;
    END IF;

    -- Also ensure viewer_count exists just in case legacy code uses it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'viewer_count') THEN
        ALTER TABLE public.streams ADD COLUMN viewer_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 3. Create index for stream_viewers
CREATE INDEX IF NOT EXISTS idx_stream_viewers_stream_id ON public.stream_viewers(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_viewers_user_id ON public.stream_viewers(user_id);
