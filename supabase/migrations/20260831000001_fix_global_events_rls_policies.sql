-- ============================================================================
-- Fix global_events RLS policies and add create_global_event RPC
-- ============================================================================
-- The 20260830 migration granted INSERT to anon/authenticated but a GRANT
-- alone does NOT bypass Row Level Security — a CREATE POLICY is also
-- required. Combined with the over-broad UPDATE policy this allowed:
--   • anonymous browsers to spam/fake ticker announcements (e.g. "BREAKING:
--     MaiTroll is shutting down") via direct INSERT
--   • any authenticated user to UPDATE/DELETE every global_events row
--
-- New model (per Bug Center review):
--   • Public:        SELECT (read-only ticker, public)
--   • Authenticated: EXECUTE create_global_event RPC only
--   • Service role:  direct INSERT / UPDATE / DELETE (edge functions, triggers)
--
-- All browser-side writes now go through the SECURITY DEFINER RPC
-- create_global_event(), which verifies auth.uid() before inserting.
--
-- Affected bugs: #4 (42501 anon /auth), #5 (42501 admin /), #6 (P0001 /)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. RESTRICTIVE RLS POLICIES
-- ============================================================================

ALTER TABLE IF EXISTS public.global_events ENABLE ROW LEVEL SECURITY;

-- Drop every existing policy on the table so we start from a known state
DROP POLICY IF EXISTS "Allow service_role to insert" ON public.global_events;
DROP POLICY IF EXISTS "Allow service_role to delete" ON public.global_events;
DROP POLICY IF EXISTS "Allow authenticated users to insert events" ON public.global_events;
DROP POLICY IF EXISTS "Allow users to read their own events" ON public.global_events;
DROP POLICY IF EXISTS "Allow users to read public events" ON public.global_events;
DROP POLICY IF EXISTS "Allow service role full access" ON public.global_events;
DROP POLICY IF EXISTS "Allow anon users to read public events" ON public.global_events;
DROP POLICY IF EXISTS "Anonymous users can insert city events" ON public.global_events;
DROP POLICY IF EXISTS "Authenticated users can insert city events" ON public.global_events;
DROP POLICY IF EXISTS "Authenticated users can update city events" ON public.global_events;
DROP POLICY IF EXISTS "Allow all inserts" ON public.global_events;
DROP POLICY IF EXISTS "Service role can insert global_events" ON public.global_events;
DROP POLICY IF EXISTS "Service role can update global_events" ON public.global_events;
DROP POLICY IF EXISTS "Service role can delete global_events" ON public.global_events;
DROP POLICY IF EXISTS "Global events are viewable by everyone" ON public.global_events;
DROP POLICY IF EXISTS "Allow public read access" ON public.global_events;

-- SELECT: everyone (anon + authenticated) can read
CREATE POLICY "Global events are viewable by everyone"
  ON public.global_events
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT: service role only (edge functions, triggers, SECURITY DEFINER RPCs)
CREATE POLICY "Service role can insert global_events"
  ON public.global_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- UPDATE: service role only
CREATE POLICY "Service role can update global_events"
  ON public.global_events
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- DELETE: service role only
CREATE POLICY "Service role can delete global_events"
  ON public.global_events
  FOR DELETE
  TO service_role
  USING (true);

-- Permissions
GRANT SELECT ON public.global_events TO anon;
GRANT SELECT ON public.global_events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.global_events TO service_role;

-- ============================================================================
-- 2. SECURITY-DEFINER RPC: create_global_event()
-- ============================================================================
-- Replaces all direct client-side INSERTs into global_events.
-- Runs as the function owner (service_role) so it bypasses RLS, but
-- explicitly checks auth.uid() to ensure the caller is authenticated.

CREATE OR REPLACE FUNCTION public.create_global_event(
    p_title   TEXT,
    p_type    TEXT    DEFAULT 'system',
    p_icon    TEXT    DEFAULT NULL,
    p_priority INTEGER DEFAULT 1,
    p_metadata JSONB  DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id  UUID;
    v_event_id UUID;
BEGIN
    -- Require an authenticated caller
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
        USING ERRCODE = 'P0001';
    END IF;

    -- Tag every event with its originating actor
    p_metadata := COALESCE(p_metadata, '{}'::JSONB) || jsonb_build_object('actor_id', v_user_id);

    INSERT INTO public.global_events (type, title, icon, priority, metadata)
    VALUES (p_type, p_title, p_icon, p_priority, p_metadata)
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

-- Only authenticated users can call this RPC (anon is blocked, so the
-- hasValidSession guard in store.ts is a second line of defence)
GRANT EXECUTE ON FUNCTION public.create_global_event TO authenticated;

-- ============================================================================
-- 3. BACKFILL: fix any global_events rows missing the required 'type' column
--    (4 insert paths never set type — they only appeared to work because
--    RLS rejected them before the NOT NULL constraint was checked)
-- ============================================================================

UPDATE public.global_events
SET type = 'system'
WHERE type IS NULL;

-- ============================================================================
-- 4. Refresh PostgREST schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
