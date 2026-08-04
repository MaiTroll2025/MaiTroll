-- Fix missing RLS policy on broadcaster_stats
-- Detected error: Policy "Users view own stats" missing on broadcaster_stats

BEGIN;

-- Ensure table exists and RLS is enabled
CREATE TABLE IF NOT EXISTS public.broadcaster_stats (
    user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id),
    total_gifts_24h INTEGER DEFAULT 0,
    total_gifts_all_time INTEGER DEFAULT 0,
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.broadcaster_stats ENABLE ROW LEVEL SECURITY;

-- Re-create the missing policy
DROP POLICY IF EXISTS "Users view own stats" ON public.broadcaster_stats;
CREATE POLICY "Users view own stats" ON public.broadcaster_stats
    FOR SELECT USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- Ensure the public view exists as well (as seen in consolidated_fix)
CREATE OR REPLACE VIEW public.broadcaster_stats_public AS
SELECT user_id, total_gifts_24h, total_gifts_all_time, last_updated_at
FROM public.broadcaster_stats;

GRANT SELECT ON public.broadcaster_stats_public TO authenticated;

COMMIT;
