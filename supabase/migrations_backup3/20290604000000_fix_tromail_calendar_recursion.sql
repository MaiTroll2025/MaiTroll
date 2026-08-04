-- Fix infinite recursion in tromail_calendar_events / tromail_calendar_event_recipients RLS
-- The SELECT policy on tromail_calendar_events references tromail_calendar_event_recipients
-- and the SELECT policy on tromail_calendar_event_recipients references tromail_calendar_events,
-- causing mutual recursion when PostgreSQL evaluates either policy.
--
-- Fix: Create SECURITY DEFINER helper functions that bypass RLS, breaking the cycle.

-- 1. Helper: get calendar event IDs where the current user is a recipient
CREATE OR REPLACE FUNCTION public.get_auth_user_calendar_event_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT calendar_event_id
    FROM tromail_calendar_event_recipients
    WHERE recipient_user_id = auth.uid();
$$;

-- 2. Helper: get calendar event IDs created by the current user
CREATE OR REPLACE FUNCTION public.get_auth_user_created_calendar_event_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT id
    FROM tromail_calendar_events
    WHERE created_by_user_id = auth.uid();
$$;

-- 3. Drop all existing policies on both tables to clear the recursion
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'tromail_calendar_events' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON tromail_calendar_events', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'tromail_calendar_event_recipients' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON tromail_calendar_event_recipients', pol.policyname);
  END LOOP;
END $$;

-- 4. Recreate tromail_calendar_events policies (non-recursive)
CREATE POLICY "tromail_calendar_events_select" ON tromail_calendar_events
  FOR SELECT USING (
    id IN (SELECT public.get_auth_user_calendar_event_ids())
    OR created_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.is_admin = true
    )
  );

CREATE POLICY "tromail_calendar_events_insert" ON tromail_calendar_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'secretary', 'ceo', 'lead_troll_officer', 'troll_officer', 'prosecutor', 'attorney', 'auctioneer')
        OR up.is_admin = true
      )
    )
  );

CREATE POLICY "tromail_calendar_events_update" ON tromail_calendar_events
  FOR UPDATE USING (
    created_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'secretary')
        OR up.is_admin = true
      )
    )
  );

CREATE POLICY "tromail_calendar_events_delete" ON tromail_calendar_events
  FOR DELETE USING (
    created_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'secretary')
        OR up.is_admin = true
      )
    )
  );

-- 5. Recreate tromail_calendar_event_recipients policies (non-recursive)
CREATE POLICY "tromail_calendar_event_recipients_select" ON tromail_calendar_event_recipients
  FOR SELECT USING (
    recipient_user_id = auth.uid()
    OR calendar_event_id IN (SELECT public.get_auth_user_created_calendar_event_ids())
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'secretary')
        OR up.is_admin = true
      )
    )
  );

CREATE POLICY "tromail_calendar_event_recipients_insert" ON tromail_calendar_event_recipients
  FOR INSERT WITH CHECK (
    calendar_event_id IN (SELECT public.get_auth_user_created_calendar_event_ids())
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'secretary')
        OR up.is_admin = true
      )
    )
  );

CREATE POLICY "tromail_calendar_event_recipients_delete" ON tromail_calendar_event_recipients
  FOR DELETE USING (
    calendar_event_id IN (SELECT public.get_auth_user_created_calendar_event_ids())
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'secretary')
        OR up.is_admin = true
      )
    )
  );
