-- =============================================================================
-- Migration: user_tutorial_progress
-- =============================================================================
-- Purpose:
--   Tracks first-broadcast tutorial progress per user so the tutorial
--   only shows once and respects completed/skipped state.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_tutorial_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tutorial_key TEXT NOT NULL DEFAULT 'first_broadcast',
    current_step INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    is_skipped BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    skipped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, tutorial_key)
);

CREATE INDEX IF NOT EXISTS idx_user_tutorial_progress_user_id
    ON public.user_tutorial_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_user_tutorial_progress_tutorial_key
    ON public.user_tutorial_progress(tutorial_key);

ALTER TABLE public.user_tutorial_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own progress"
    ON public.user_tutorial_progress FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users upsert own progress"
    ON public.user_tutorial_progress FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own progress"
    ON public.user_tutorial_progress FOR UPDATE
    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_user_tutorial_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_user_tutorial_progress_updated_at
    ON public.user_tutorial_progress;

CREATE TRIGGER trg_update_user_tutorial_progress_updated_at
    BEFORE UPDATE ON public.user_tutorial_progress
    FOR EACH ROW EXECUTE FUNCTION public.update_user_tutorial_progress_updated_at();

COMMIT;
