BEGIN;

ALTER TABLE public.court_sessions
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;

DROP POLICY IF EXISTS "Public can view active public court sessions" ON public.court_sessions;
CREATE POLICY "Public can view active public court sessions"
  ON public.court_sessions
  FOR SELECT
  TO anon, authenticated
  USING (is_public = TRUE AND status IN ('active', 'live'));

GRANT SELECT ON public.court_sessions TO anon, authenticated;
GRANT SELECT ON public.court_participants TO anon, authenticated;

DROP POLICY IF EXISTS "Public view court_participants" ON public.court_participants;
CREATE POLICY "Public view court_participants"
  ON public.court_participants
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.court_sessions
      WHERE court_sessions.id = court_participants.court_session_id
        AND court_sessions.is_public = TRUE
        AND court_sessions.status IN ('active', 'live')
    )
  );

DROP POLICY IF EXISTS "Public can view live podcasts" ON public.podcasts;
CREATE POLICY "Public can view live podcasts"
  ON public.podcasts
  FOR SELECT
  TO anon, authenticated
  USING (status IN ('live', 'active'));

GRANT SELECT ON public.podcasts TO anon, authenticated;

ALTER TABLE public.facebook_publications
  DROP CONSTRAINT IF EXISTS facebook_publications_source_type_check;

ALTER TABLE public.facebook_publications
  ADD CONSTRAINT facebook_publications_source_type_check
  CHECK (source_type IN (
    'announcement',
    'admin_broadcast',
    'wall_post',
    'troll_post',
    'stream',
    'gaming_stream',
    'podcast',
    'court_session',
    'treelz_post'
  ));

COMMIT;
