-- Court docket hardening:
-- - Court dockets/cases are visible to authenticated users only, never public anon.
-- - Court staff can permanently delete cases/docket entries.
-- - Case extension moves to the exact requested date instead of drifting by one day.

CREATE OR REPLACE FUNCTION public.is_court_staff(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = p_user_id
      AND (
        COALESCE(up.is_admin, false) = true
        OR COALESCE(up.is_troll_officer, false) = true
        OR COALESCE(up.is_lead_officer, false) = true
        OR up.role IN ('admin', 'owner', 'secretary', 'troll_officer', 'lead_troll_officer')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_court_staff(uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF to_regclass('public.court_dockets') IS NOT NULL THEN
    ALTER TABLE public.court_dockets ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Public can view court dockets" ON public.court_dockets;
    DROP POLICY IF EXISTS "Everyone can view court dockets" ON public.court_dockets;
    DROP POLICY IF EXISTS "Users can view court dockets" ON public.court_dockets;
    DROP POLICY IF EXISTS "Authenticated users can view court dockets" ON public.court_dockets;
    CREATE POLICY "Authenticated users can view court dockets"
      ON public.court_dockets
      FOR SELECT
      TO authenticated
      USING (auth.uid() IS NOT NULL);

    REVOKE ALL ON public.court_dockets FROM anon;
    GRANT SELECT ON public.court_dockets TO authenticated;
  END IF;

  IF to_regclass('public.court_cases') IS NOT NULL THEN
    ALTER TABLE public.court_cases
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

    ALTER TABLE public.court_cases ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Everyone can read public cases" ON public.court_cases;
    DROP POLICY IF EXISTS "Users can view public cases" ON public.court_cases;
    DROP POLICY IF EXISTS "Public can view court cases" ON public.court_cases;
    DROP POLICY IF EXISTS "Authenticated users can view court cases" ON public.court_cases;
    CREATE POLICY "Authenticated users can view court cases"
      ON public.court_cases
      FOR SELECT
      TO authenticated
      USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

    REVOKE ALL ON public.court_cases FROM anon;
    GRANT SELECT ON public.court_cases TO authenticated;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.hard_delete_court_case(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_docket_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_court_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only court staff can delete court cases';
  END IF;

  SELECT docket_id INTO v_docket_id
  FROM public.court_cases
  WHERE id = p_case_id;

  DELETE FROM public.court_cases
  WHERE id = p_case_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case not found');
  END IF;

  IF v_docket_id IS NOT NULL AND to_regclass('public.court_dockets') IS NOT NULL THEN
    UPDATE public.court_dockets
    SET cases_count = GREATEST(COALESCE(cases_count, 1) - 1, 0),
        updated_at = now()
    WHERE id = v_docket_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.hard_delete_court_case(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.hard_delete_docket_entry(p_docket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_court_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only court staff can delete docket entries';
  END IF;

  IF to_regclass('public.court_docket') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'court_docket table not found');
  END IF;

  DELETE FROM public.court_docket
  WHERE id = p_docket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Docket entry not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.hard_delete_docket_entry(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.extend_court_date(p_case_id uuid, p_new_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_docket_id uuid;
  v_new_docket_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_court_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only court staff can extend court cases';
  END IF;

  IF p_new_date IS NULL THEN
    RAISE EXCEPTION 'New court date is required';
  END IF;

  SELECT docket_id INTO v_old_docket_id
  FROM public.court_cases
  WHERE id = p_case_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case not found');
  END IF;

  SELECT id INTO v_new_docket_id
  FROM public.court_dockets
  WHERE court_date = p_new_date
  LIMIT 1;

  IF v_new_docket_id IS NULL THEN
    INSERT INTO public.court_dockets (court_date, status, max_cases, cases_count, created_by, updated_at)
    VALUES (p_new_date, 'open', 20, 0, auth.uid(), now())
    RETURNING id INTO v_new_docket_id;
  END IF;

  UPDATE public.court_cases
  SET docket_id = v_new_docket_id,
      updated_at = now()
  WHERE id = p_case_id;

  IF v_old_docket_id IS NOT NULL AND v_old_docket_id <> v_new_docket_id THEN
    UPDATE public.court_dockets
    SET cases_count = GREATEST(COALESCE(cases_count, 1) - 1, 0),
        updated_at = now()
    WHERE id = v_old_docket_id;
  END IF;

  UPDATE public.court_dockets
  SET cases_count = COALESCE(cases_count, 0) + CASE WHEN v_old_docket_id IS DISTINCT FROM v_new_docket_id THEN 1 ELSE 0 END,
      updated_at = now()
  WHERE id = v_new_docket_id;

  RETURN jsonb_build_object(
    'success', true,
    'case_id', p_case_id,
    'court_date', p_new_date,
    'docket_id', v_new_docket_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_court_date(uuid, date) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
