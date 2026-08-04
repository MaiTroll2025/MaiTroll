-- =============================================================================
-- Allow public (anon) read access to active/live court sessions
-- =============================================================================

BEGIN;

CREATE POLICY "anon_view_active_court_sessions"
  ON public.court_sessions
  FOR SELECT
  TO anon
  USING ((status = 'active'::text) OR (status = 'live'::text));

CREATE POLICY "anon_view_active_court_sessions_service"
  ON public.court_sessions
  FOR SELECT
  TO service_role
  USING ((status = 'active'::text) OR (status = 'live'::text));

GRANT EXECUTE ON FUNCTION public.get_current_court_session() TO anon;

COMMIT;
