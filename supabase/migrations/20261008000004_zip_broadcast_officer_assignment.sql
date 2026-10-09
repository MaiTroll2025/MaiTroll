BEGIN;

ALTER TABLE public.broadcast_officers
  ADD COLUMN IF NOT EXISTS assignment_source text NOT NULL DEFAULT 'manual';

UPDATE public.broadcast_officers
   SET assignment_source = CASE
     WHEN assignment_source = 'zip_auto' THEN 'zip_auto'
     ELSE 'manual'
   END
 WHERE assignment_source IS NULL
    OR assignment_source NOT IN ('manual', 'zip_auto');

ALTER TABLE public.broadcast_officers
  ALTER COLUMN assignment_source SET DEFAULT 'manual',
  ALTER COLUMN assignment_source SET NOT NULL;

ALTER TABLE public.broadcast_officers
  DROP CONSTRAINT IF EXISTS broadcast_officers_assignment_source_check;

ALTER TABLE public.broadcast_officers
  ADD CONSTRAINT broadcast_officers_assignment_source_check
  CHECK (assignment_source IN ('manual', 'zip_auto'));

CREATE OR REPLACE FUNCTION public.reconcile_zip_broadcast_officers(p_zip_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_zip text := left(regexp_replace(trim(COALESCE(p_zip_code, '')), '[^0-9]', '', 'g'), 5);
  v_live_count integer;
  v_officer_id uuid;
BEGIN
  IF length(v_zip) <> 5 THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('zip_broadcast_officer:' || v_zip));

  SELECT count(*)::integer
    INTO v_live_count
    FROM public.streams s
    JOIN public.city_identities ci
      ON ci.user_id = COALESCE(s.user_id, s.broadcaster_id)
   WHERE left(ci.zip_code, 5) = v_zip
     AND (s.is_live IS TRUE OR s.status = 'live');

  IF v_live_count < 15 THEN
    DELETE FROM public.broadcast_officers bo
    USING public.streams s, public.city_identities ci
     WHERE bo.stream_id = s.id
       AND ci.user_id = COALESCE(s.user_id, s.broadcaster_id)
       AND left(ci.zip_code, 5) = v_zip
       AND bo.assignment_source = 'zip_auto';
    RETURN;
  END IF;

  SELECT bo.officer_id
    INTO v_officer_id
    FROM public.broadcast_officers bo
    JOIN public.streams s
      ON s.id = bo.stream_id
    JOIN public.city_identities ci
      ON ci.user_id = COALESCE(s.user_id, s.broadcaster_id)
    JOIN public.user_profiles up
      ON up.id = bo.officer_id
   WHERE left(ci.zip_code, 5) = v_zip
     AND (s.is_live IS TRUE OR s.status = 'live')
     AND bo.assignment_source = 'zip_auto'
     AND up.is_officer_active IS TRUE
     AND (up.is_troll_officer IS TRUE OR lower(COALESCE(up.role::text, '')) = 'troll_officer')
     AND EXISTS (
       SELECT 1
         FROM public.officer_work_sessions ws
        WHERE ws.officer_id = up.id
          AND ws.clock_out IS NULL
          AND lower(COALESCE(ws.status, '')) <> 'break'
     )
   ORDER BY bo.created_at, bo.officer_id
   LIMIT 1;

  IF v_officer_id IS NULL THEN
    SELECT up.id
      INTO v_officer_id
      FROM public.user_profiles up
     WHERE up.is_officer_active IS TRUE
       AND (up.is_troll_officer IS TRUE OR lower(COALESCE(up.role::text, '')) = 'troll_officer')
       AND EXISTS (
         SELECT 1
           FROM public.officer_work_sessions ws
          WHERE ws.officer_id = up.id
            AND ws.clock_out IS NULL
            AND lower(COALESCE(ws.status, '')) <> 'break'
       )
     ORDER BY (
       SELECT count(DISTINCT assigned.stream_id)
         FROM public.broadcast_officers assigned
         JOIN public.streams active_stream
           ON active_stream.id = assigned.stream_id
        WHERE assigned.officer_id = up.id
          AND (active_stream.is_live IS TRUE OR active_stream.status = 'live')
     ), up.id
     LIMIT 1;
  END IF;

  IF v_officer_id IS NULL THEN
    DELETE FROM public.broadcast_officers bo
    USING public.streams s, public.city_identities ci
     WHERE bo.stream_id = s.id
       AND ci.user_id = COALESCE(s.user_id, s.broadcaster_id)
       AND left(ci.zip_code, 5) = v_zip
       AND bo.assignment_source = 'zip_auto';

    RAISE WARNING 'No on-duty Troll Officer is available for ZIP group % with % live broadcasts',
      v_zip, v_live_count;
    RETURN;
  END IF;

  DELETE FROM public.broadcast_officers bo
  USING public.streams s, public.city_identities ci
   WHERE bo.stream_id = s.id
     AND ci.user_id = COALESCE(s.user_id, s.broadcaster_id)
     AND left(ci.zip_code, 5) = v_zip
     AND (
       bo.assignment_source = 'zip_auto'
       AND (
         bo.officer_id <> v_officer_id
         OR NOT (s.is_live IS TRUE OR s.status = 'live')
       )
     );

  INSERT INTO public.broadcast_officers (
    broadcaster_id,
    officer_id,
    stream_id,
    assignment_source
  )
  SELECT
    COALESCE(s.user_id, s.broadcaster_id),
    v_officer_id,
    s.id,
    'zip_auto'
    FROM public.streams s
    JOIN public.city_identities ci
      ON ci.user_id = COALESCE(s.user_id, s.broadcaster_id)
   WHERE left(ci.zip_code, 5) = v_zip
     AND (s.is_live IS TRUE OR s.status = 'live')
     AND NOT EXISTS (
       SELECT 1
         FROM public.broadcast_officers existing
        WHERE existing.stream_id = s.id
          AND existing.officer_id = v_officer_id
     )
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_zip_broadcast_officers(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.handle_zip_stream_officer_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_zip_code text;
BEGIN
  SELECT ci.zip_code
    INTO v_zip_code
    FROM public.city_identities ci
   WHERE ci.user_id = COALESCE(NEW.user_id, NEW.broadcaster_id);

  IF v_zip_code IS NOT NULL THEN
    PERFORM public.reconcile_zip_broadcast_officers(v_zip_code);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_zip_stream_officer_assignment() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_zip_stream_officer_assignment_insert ON public.streams;
CREATE TRIGGER trg_zip_stream_officer_assignment_insert
  AFTER INSERT ON public.streams
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_zip_stream_officer_assignment();

DROP TRIGGER IF EXISTS trg_zip_stream_officer_assignment_update ON public.streams;
CREATE TRIGGER trg_zip_stream_officer_assignment_update
  AFTER UPDATE OF status, is_live ON public.streams
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_zip_stream_officer_assignment();

CREATE OR REPLACE FUNCTION public.handle_zip_city_identity_officer_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.zip_code IS DISTINCT FROM NEW.zip_code THEN
    PERFORM public.reconcile_zip_broadcast_officers(OLD.zip_code);
  END IF;

  PERFORM public.reconcile_zip_broadcast_officers(NEW.zip_code);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_zip_city_identity_officer_assignment() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_zip_city_identity_officer_assignment ON public.city_identities;
CREATE TRIGGER trg_zip_city_identity_officer_assignment
  AFTER INSERT OR UPDATE OF zip_code ON public.city_identities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_zip_city_identity_officer_assignment();

CREATE OR REPLACE FUNCTION public.reconcile_active_zip_officer_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_zip record;
BEGIN
  FOR v_zip IN
    SELECT left(ci.zip_code, 5) AS zip_code
      FROM public.city_identities ci
      JOIN public.streams s
        ON ci.user_id = COALESCE(s.user_id, s.broadcaster_id)
     WHERE (s.is_live IS TRUE OR s.status = 'live')
     GROUP BY left(ci.zip_code, 5)
    HAVING count(*) >= 15
  LOOP
    PERFORM public.reconcile_zip_broadcast_officers(v_zip.zip_code);
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_active_zip_officer_assignments() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_reconcile_active_zip_officer_assignments_insert ON public.user_profiles;
CREATE TRIGGER trg_reconcile_active_zip_officer_assignments_insert
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  WHEN (
    NEW.is_officer_active IS TRUE
    AND (NEW.is_troll_officer IS TRUE OR lower(COALESCE(NEW.role::text, '')) = 'troll_officer')
  )
  EXECUTE FUNCTION public.reconcile_active_zip_officer_assignments();

DROP TRIGGER IF EXISTS trg_reconcile_active_zip_officer_assignments_update ON public.user_profiles;
CREATE TRIGGER trg_reconcile_active_zip_officer_assignments_update
  AFTER UPDATE OF role, is_troll_officer, is_officer_active ON public.user_profiles
  FOR EACH ROW
  WHEN (
    OLD.role IS DISTINCT FROM NEW.role
    OR OLD.is_troll_officer IS DISTINCT FROM NEW.is_troll_officer
    OR OLD.is_officer_active IS DISTINCT FROM NEW.is_officer_active
  )
  EXECUTE FUNCTION public.reconcile_active_zip_officer_assignments();

DROP TRIGGER IF EXISTS trg_reconcile_active_zip_officer_assignments_work_session_insert ON public.officer_work_sessions;
CREATE TRIGGER trg_reconcile_active_zip_officer_assignments_work_session_insert
  AFTER INSERT ON public.officer_work_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.reconcile_active_zip_officer_assignments();

DROP TRIGGER IF EXISTS trg_reconcile_active_zip_officer_assignments_work_session_update ON public.officer_work_sessions;
CREATE TRIGGER trg_reconcile_active_zip_officer_assignments_work_session_update
  AFTER UPDATE OF officer_id, clock_out, status ON public.officer_work_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.reconcile_active_zip_officer_assignments();

COMMIT;
