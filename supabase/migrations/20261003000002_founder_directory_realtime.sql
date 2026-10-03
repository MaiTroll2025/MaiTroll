-- ============================================================================
-- FOUNDER PROGRAM — PUBLIC DIRECTORY MIRROR
--
-- Why this table exists
-- --------------------
-- The React Founder badge is driven by a shared directory store that must
-- refresh the moment an Admin grants or revokes Founder status. Supabase
-- Realtime "postgres_changes" only delivers rows the subscriber is allowed to
-- SELECT under RLS, and public.founders is deliberately locked down
-- (founders_read_own_or_admin) so that admin-only columns — notes,
-- previous_role, removal_reason, created_by — never leak.
--
-- Consequence: without help, a newly promoted Founder would never receive the
-- realtime event and their gold username / Founder badge would not appear until
-- a full reload.
--
-- founder_public_status is a deliberately minimal, non-sensitive projection of
-- exactly the four facts the badge needs. It carries NO notes, roles, or admin
-- metadata, so it can be world-readable and subscribed to safely.
--
-- RLS note: SELECT is intentionally open. Nothing secret is stored here.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.founder_public_status (
  user_id     uuid PRIMARY KEY,
  status      text NOT NULL DEFAULT 'active',
  start_at    timestamptz NOT NULL DEFAULT now(),
  end_at      timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_public_status_status_check
    CHECK (status IN ('active', 'expired', 'removed', 'suspended'))
);

COMMENT ON TABLE public.founder_public_status IS
  'Non-sensitive Founder projection used only to drive the gold-username / Founder badge. Contains no admin notes or role data.';

-- ============================================================================
-- Keep the mirror in sync with public.founders
-- ============================================================================

CREATE OR REPLACE FUNCTION public.founder_sync_public_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A removed Founder must disappear from the mirror immediately, so DELETE
  -- the row rather than marking it (removal is not a "status" the badge shows).
  IF (TG_OP = 'DELETE') OR (NEW.removed_at IS NOT NULL) THEN
    DELETE FROM public.founder_public_status
      WHERE user_id = COALESCE(OLD.user_id, NEW.user_id);
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Only surface a genuinely active, unexpired Founder in the mirror.
  IF NEW.status = 'active' AND NEW.end_at > now() THEN
    INSERT INTO public.founder_public_status (user_id, status, start_at, end_at, updated_at)
    VALUES (NEW.user_id, NEW.status, NEW.start_at, NEW.end_at, now())
    ON CONFLICT (user_id) DO UPDATE
      SET status     = EXCLUDED.status,
          start_at   = EXCLUDED.start_at,
          end_at     = EXCLUDED.end_at,
          updated_at = now();
  ELSE
    DELETE FROM public.founder_public_status WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS founder_sync_public_status_trg ON public.founders;
CREATE TRIGGER founder_sync_public_status_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.founders
  FOR EACH ROW
  EXECUTE FUNCTION public.founder_sync_public_status();

-- Backfill from any existing Founder rows.
INSERT INTO public.founder_public_status (user_id, status, start_at, end_at, updated_at)
SELECT f.user_id, f.status, f.start_at, f.end_at, now()
FROM public.founders f
WHERE f.status = 'active'
  AND f.removed_at IS NULL
  AND f.end_at > now()
ON CONFLICT (user_id) DO UPDATE
  SET status     = EXCLUDED.status,
      start_at   = EXCLUDED.start_at,
      end_at     = EXCLUDED.end_at,
      updated_at = now();

-- ============================================================================
-- RLS + grants
-- ============================================================================

ALTER TABLE public.founder_public_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS founder_public_status_read ON public.founder_public_status;
CREATE POLICY founder_public_status_read
  ON public.founder_public_status FOR SELECT
  TO anon, authenticated
  USING (true);

-- No client writes: this table is maintained by trigger + admin RPCs only.
REVOKE INSERT, UPDATE, DELETE ON public.founder_public_status FROM anon, authenticated;
GRANT SELECT ON public.founder_public_status TO anon, authenticated;

-- Trigger function is SECURITY DEFINER; it must be able to write regardless of
-- the caller's role, so make sure it is not revoked from the owner (default).
REVOKE ALL ON FUNCTION public.founder_sync_public_status() FROM PUBLIC;

-- ============================================================================
-- Realtime: the badge store subscribes to THIS table, not public.founders
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'founder_public_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.founder_public_status;
  END IF;
END
$$;
