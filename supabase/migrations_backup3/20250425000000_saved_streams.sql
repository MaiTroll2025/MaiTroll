-- ============================================================================
-- SAVED STREAMS FEATURE
-- ============================================================================
-- Allows users to save broadcasts to their profile for later viewing
-- Automatic save on stream end + manual save from setup page
-- ============================================================================

-- Create table for saved streams
CREATE TABLE IF NOT EXISTS public.saved_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT DEFAULT 'manual', -- 'manual' | 'auto_stream_end' | 'auto_summary'
    UNIQUE(user_id, stream_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_saved_streams_user_id ON public.saved_streams(user_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_streams_stream_id ON public.saved_streams(stream_id);

-- Enable RLS
ALTER TABLE public.saved_streams ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved streams
DROP POLICY IF EXISTS "Users view own saved streams" ON public.saved_streams;
CREATE POLICY "Users view own saved streams" ON public.saved_streams
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert their own saved streams
DROP POLICY IF EXISTS "Users insert own saved streams" ON public.saved_streams;
CREATE POLICY "Users insert own saved streams" ON public.saved_streams
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can delete their own saved streams
DROP POLICY IF EXISTS "Users delete own saved streams" ON public.saved_streams;
CREATE POLICY "Users delete own saved streams" ON public.saved_streams
    FOR DELETE
    USING (user_id = auth.uid());

-- Function to auto-save stream when it ends (trigger)
CREATE OR REPLACE FUNCTION public.auto_save_stream_on_end()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Only trigger on status change to 'ended'
    IF NEW.status = 'ended' AND OLD.status != 'ended' THEN
        -- Get broadcaster user_id
        v_user_id := NEW.broadcaster_id;

        -- Auto-save for broadcaster
        INSERT INTO public.saved_streams (user_id, stream_id, source)
        VALUES (v_user_id, NEW.id, 'auto_stream_end')
        ON CONFLICT (user_id, stream_id) DO NOTHING;

        -- Also auto-save for participants who were in the stream
        -- This captures seat holders, etc.
        INSERT INTO public.saved_streams (user_id, stream_id, source)
        SELECT DISTINCT
            ss.user_id,
            NEW.id,
            'auto_stream_end'
        FROM public.stream_seat_sessions ss
        WHERE ss.stream_id = NEW.id
          AND ss.user_id IS NOT NULL
          AND ss.joined_at IS NOT NULL
        ON CONFLICT (user_id, stream_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on streams table
DROP TRIGGER IF EXISTS trigger_auto_save_stream_on_end ON public.streams;
CREATE TRIGGER trigger_auto_save_stream_on_end
    AFTER UPDATE ON public.streams
    FOR EACH ROW
    WHEN (OLD.status != 'ended' AND NEW.status = 'ended')
    EXECUTE FUNCTION public.auto_save_stream_on_end();

-- Function to check if a stream is saved by a user
CREATE OR REPLACE FUNCTION public.is_stream_saved(
    p_user_id UUID,
    p_stream_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_saved BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.saved_streams
        WHERE user_id = p_user_id
          AND stream_id = p_stream_id
    ) INTO v_saved;

    RETURN v_saved;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- END MIGRATION
-- ============================================================================
