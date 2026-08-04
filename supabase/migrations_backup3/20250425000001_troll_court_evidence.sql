-- ============================================================================
-- TROLL COURT EVIDENCE SYSTEM
-- ============================================================================
-- Allows staff/officers to save broadcasts as legal evidence
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.troll_court_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    saved_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    case_title TEXT,
    case_description TEXT,
    evidence_type TEXT DEFAULT 'broadcast', -- 'broadcast', 'chat', 'gift', 'stream_messages'
    video_url TEXT, -- direct recording URL (from streams.recording_url)
    metadata JSONB DEFAULT '{}', -- additional data (duration, viewer_count, category, etc.)
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT unique_stream_evidence UNIQUE (stream_id, saved_by)
);

CREATE INDEX IF NOT EXISTS idx_troll_court_evidence_saved_by ON public.troll_court_evidence(saved_by, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_troll_court_evidence_stream_id ON public.troll_court_evidence(stream_id);
CREATE INDEX IF NOT EXISTS idx_troll_court_evidence_active ON public.troll_court_evidence(is_active, saved_at DESC);

-- RLS Policies
ALTER TABLE public.troll_court_evidence ENABLE ROW LEVEL SECURITY;

-- Staff/officers can view all evidence they saved or all evidence if admin
DROP POLICY IF EXISTS "Staff can view evidence" ON public.troll_court_evidence;
CREATE POLICY "Staff can view evidence" ON public.troll_court_evidence
    FOR SELECT
    USING (
        saved_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND (role IN ('admin', 'secretary', 'lead_troll_officer', 'troll_officer', 'prosecutor', 'attorney', 'chief_news_caster'))
        )
    );

-- Staff can insert evidence
DROP POLICY IF EXISTS "Staff can insert evidence" ON public.troll_court_evidence;
CREATE POLICY "Staff can insert evidence" ON public.troll_court_evidence
    FOR INSERT
    WITH CHECK (
        saved_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND (role IN ('admin', 'secretary', 'lead_troll_officer', 'troll_officer', 'prosecutor', 'attorney', 'chief_news_caster'))
        )
    );

-- Staff can update their own evidence
DROP POLICY IF EXISTS "Staff can update evidence" ON public.troll_court_evidence;
CREATE POLICY "Staff can update evidence" ON public.troll_court_evidence
    FOR UPDATE
    USING (saved_by = auth.uid())
    WITH CHECK (saved_by = auth.uid());

-- Staff can delete evidence (hard delete)
DROP POLICY IF EXISTS "Staff can delete evidence" ON public.troll_court_evidence;
CREATE POLICY "Staff can delete evidence" ON public.troll_court_evidence
    FOR DELETE
    USING (
        saved_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Function to get evidence for a stream
CREATE OR REPLACE FUNCTION public.get_evidence_for_stream(p_stream_id UUID)
RETURNS SETOF public.troll_court_evidence AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.troll_court_evidence
    WHERE stream_id = p_stream_id
      AND is_active = true
    ORDER BY saved_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- END MIGRATION
-- ============================================================================