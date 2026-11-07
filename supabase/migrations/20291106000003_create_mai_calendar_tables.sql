-- 20291106000003_create_mai_calendar_tables.sql
-- MaiCalendar public events calendar system.
-- Reconciles the calendar schema and access policies when already provisioned.

BEGIN;

SET LOCAL search_path = pg_catalog, public;

-- ---------------------------------------------------------------------------
-- Server-side staff role helper used by RLS policies.
-- Returns true for Admin, Secretary, and assistant roles.
-- Users cannot modify their own roles through this helper; it only reads
-- the trusted user_profiles row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff_calendar_role(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text;
  v_troll_role text;
  v_is_admin boolean;
  v_is_secretary boolean;
  v_is_ceo_assistant boolean;
  v_is_noah_assistant boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN false;
  END IF;

  SELECT role, troll_role, is_admin, is_secretary, is_ceo_assistant, is_noah_assistant
  INTO v_role, v_troll_role, v_is_admin, v_is_secretary, v_is_ceo_assistant, v_is_noah_assistant
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Admin family (includes superadmin/owner/ceo).
  IF COALESCE(v_is_admin, false) THEN
    RETURN true;
  END IF;
  IF v_role IN ('admin','superadmin','owner','ceo') THEN
    RETURN true;
  END IF;
  IF v_troll_role IN ('admin','superadmin','owner','ceo') THEN
    RETURN true;
  END IF;

  -- Secretary family.
  IF COALESCE(v_is_secretary, false) THEN
    RETURN true;
  END IF;
  IF v_role IN ('secretary','executive_secretary','troll_city_secretary') THEN
    RETURN true;
  END IF;
  IF v_troll_role IN ('secretary','executive_secretary','troll_city_secretary') THEN
    RETURN true;
  END IF;

  -- Assistant family (CEO Assistant / Noah Assistant).
  IF v_role IN ('ceo_assistant','noah_assistant') THEN
    RETURN true;
  END IF;
  IF v_troll_role IN ('ceo_assistant','noah_assistant') THEN
    RETURN true;
  END IF;
  IF COALESCE(v_is_ceo_assistant, false) OR COALESCE(v_is_noah_assistant, false) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Restrict direct execution of the helper so users cannot leverage it for
-- escalation beyond what the policies already allow (it only reads profiles).
REVOKE ALL ON FUNCTION public.is_staff_calendar_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff_calendar_role(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- mai_calendar_events
-- Stores public calendar events. starts_at/ends_at are timestamptz (UTC).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mai_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'custom_event',
  banner_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  location text,
  stream_url text,
  stream_id text,
  status text NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming','live','completed','canceled')),
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','draft')),
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT mai_calendar_events_ends_after_starts CHECK (ends_at > starts_at)
);

-- ---------------------------------------------------------------------------
-- mai_calendar_notification_deliveries
-- Idempotent reminder delivery log. Prevents duplicate reminders for the same
-- recipient/event/reminder/channel combination.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mai_calendar_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.mai_calendar_events(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('push','in_app')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','sent','failed')),
  sent_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, recipient_user_id, reminder_type, channel)
);

ALTER TABLE public.mai_calendar_notification_deliveries
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mai_calendar_events_status
  ON public.mai_calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_mai_calendar_events_visibility
  ON public.mai_calendar_events(visibility);
CREATE INDEX IF NOT EXISTS idx_mai_calendar_events_starts_at
  ON public.mai_calendar_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_mai_calendar_events_slug
  ON public.mai_calendar_events(slug);
CREATE INDEX IF NOT EXISTS idx_mai_calendar_events_created_by
  ON public.mai_calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_mai_calendar_notification_deliveries_event
  ON public.mai_calendar_notification_deliveries(event_id);
CREATE INDEX IF NOT EXISTS idx_mai_calendar_notification_deliveries_recipient
  ON public.mai_calendar_notification_deliveries(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_mai_calendar_notification_deliveries_status
  ON public.mai_calendar_notification_deliveries(status);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_mai_calendar_events_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_mai_calendar_events_updated_at ON public.mai_calendar_events;
CREATE TRIGGER set_mai_calendar_events_updated_at
  BEFORE UPDATE ON public.mai_calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_mai_calendar_events_updated_at();

REVOKE ALL ON FUNCTION public.set_mai_calendar_events_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.mai_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_calendar_notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mai_calendar_events_public_read
  ON public.mai_calendar_events;
DROP POLICY IF EXISTS mai_calendar_events_staff_read_drafts
  ON public.mai_calendar_events;
DROP POLICY IF EXISTS mai_calendar_events_staff_insert
  ON public.mai_calendar_events;
DROP POLICY IF EXISTS mai_calendar_events_staff_update
  ON public.mai_calendar_events;
DROP POLICY IF EXISTS mai_calendar_events_staff_delete
  ON public.mai_calendar_events;
DROP POLICY IF EXISTS mai_calendar_notification_deliveries_recipient_read
  ON public.mai_calendar_notification_deliveries;
DROP POLICY IF EXISTS mai_calendar_notification_deliveries_staff_read
  ON public.mai_calendar_notification_deliveries;
DROP POLICY IF EXISTS mai_calendar_notification_deliveries_service_insert
  ON public.mai_calendar_notification_deliveries;
DROP POLICY IF EXISTS mai_calendar_notification_deliveries_service_update
  ON public.mai_calendar_notification_deliveries;

-- Public / anonymous and regular authenticated users may read published public events.
CREATE POLICY mai_calendar_events_public_read
  ON public.mai_calendar_events
  FOR SELECT
  TO anon, authenticated
  USING (
    visibility = 'public'
    AND status <> 'draft'
  );

-- Drafts visible only to authorized staff (server-side role check via helper).
CREATE POLICY mai_calendar_events_staff_read_drafts
  ON public.mai_calendar_events
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'draft'
    AND public.is_staff_calendar_role(auth.uid())
  );

-- Only authorized staff may insert events.
CREATE POLICY mai_calendar_events_staff_insert
  ON public.mai_calendar_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff_calendar_role(auth.uid())
  );

-- Only authorized staff may update events.
CREATE POLICY mai_calendar_events_staff_update
  ON public.mai_calendar_events
  FOR UPDATE
  TO authenticated
  USING (public.is_staff_calendar_role(auth.uid()))
  WITH CHECK (public.is_staff_calendar_role(auth.uid()));

-- Only authorized staff may delete events.
CREATE POLICY mai_calendar_events_staff_delete
  ON public.mai_calendar_events
  FOR DELETE
  TO authenticated
  USING (public.is_staff_calendar_role(auth.uid()));

-- Notification deliveries: recipients may read their own deliveries; staff may read all.
-- Writes are reserved for the service-role backend, which bypasses RLS.
CREATE POLICY mai_calendar_notification_deliveries_recipient_read
  ON public.mai_calendar_notification_deliveries
  FOR SELECT
  TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY mai_calendar_notification_deliveries_staff_read
  ON public.mai_calendar_notification_deliveries
  FOR SELECT
  TO authenticated
  USING (public.is_staff_calendar_role(auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.mai_calendar_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mai_calendar_events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mai_calendar_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mai_calendar_events TO service_role;

REVOKE ALL ON public.mai_calendar_notification_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mai_calendar_notification_deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.mai_calendar_notification_deliveries TO service_role;

-- ---------------------------------------------------------------------------
-- Scheduled reminder dispatch.
-- Configure a recurring cron job (e.g. every hour, `0 * * * *`) in the
-- Supabase Dashboard → Cron calling the `mai-calendar-reminders` edge
-- function with `Authorization: Bearer <MAI_CALENDAR_CRON_SECRET>`. Store a
-- random secret of at least 32 characters in the Edge Function environment.
-- The endpoint is not JWT-verified and rejects requests without this secret.
-- It is NOT automatically scheduled here because pg_cron and the net
-- extension are not available on every Supabase plan.
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.mai_calendar_events IS 'Public events calendar listings (MaiCalendar).';
COMMENT ON TABLE public.mai_calendar_notification_deliveries IS 'Idempotent reminder delivery log for calendar events.';

COMMIT;
