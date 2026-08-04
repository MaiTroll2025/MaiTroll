-- Migration: Guest access for podcasts and podcast_episodes
-- Allows anonymous users to read podcast data for public listening

ALTER TABLE public.podcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view podcasts" ON public.podcasts;
CREATE POLICY "Anyone can view podcasts" ON public.podcasts
    FOR SELECT USING (true);

GRANT SELECT ON public.podcasts TO anon;

ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view podcast episodes" ON public.podcast_episodes;
CREATE POLICY "Anyone can view podcast episodes" ON public.podcast_episodes
    FOR SELECT USING (true);

GRANT SELECT ON public.podcast_episodes TO anon;
