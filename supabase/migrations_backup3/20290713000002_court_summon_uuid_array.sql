-- Migrate court summon users_involved from TEXT[] to UUID[]
BEGIN;

-- 1. Update court_cases column type using a helper function
CREATE OR REPLACE FUNCTION public.text_array_to_uuid_array(arr text[])
RETURNS uuid[] LANGUAGE sql IMMUTABLE AS $$
  SELECT array_agg(uuid::uuid)
  FROM unnest(arr) AS arr(uuid)
  WHERE uuid ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'court_cases'
      AND column_name = 'users_involved'
      AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE public.court_cases
      ALTER COLUMN users_involved TYPE UUID[]
      USING public.text_array_to_uuid_array(users_involved);
  END IF;
END $$;

-- 2. Update court_summons_log column type if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'court_summons_log'
      AND column_name = 'users_involved'
  ) THEN
    ALTER TABLE public.court_summons_log
      ALTER COLUMN users_involved TYPE UUID[]
      USING public.text_array_to_uuid_array(users_involved);
  END IF;
END $$;

-- 3. Drop the helper function
DROP FUNCTION public.text_array_to_uuid_array(text[]);

-- 4. Drop and recreate summon_user_to_court with UUID[]
DROP FUNCTION IF EXISTS public.summon_user_to_court(UUID, TEXT, UUID[], UUID);

CREATE OR REPLACE FUNCTION public.summon_user_to_court(
  p_defendant_id UUID,
  p_reason TEXT,
  p_users_involved UUID[] DEFAULT ARRAY[]::uuid[],
  p_staff_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_docket_id UUID;
  v_case_id UUID;
  v_staff_id UUID;
BEGIN
  IF p_staff_id IS NULL THEN
    v_staff_id := auth.uid();
  ELSE
    v_staff_id := p_staff_id;
  END IF;

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Staff ID required';
  END IF;

  INSERT INTO public.court_dockets (defendant_id, plaintiff_id, reason, status)
  VALUES (p_defendant_id, v_staff_id, p_reason, 'open')
  RETURNING id INTO v_docket_id;

  INSERT INTO public.court_cases (
    docket_id,
    defendant_id,
    plaintiff_id,
    reason,
    users_involved,
    status,
    is_active
  )
  VALUES (
    v_docket_id,
    p_defendant_id,
    v_staff_id,
    p_reason,
    p_users_involved,
    'pending',
    true
  )
  RETURNING id INTO v_case_id;

  RETURN v_case_id;
END;
$$;

-- 5. Update grants
GRANT EXECUTE ON FUNCTION public.summon_user_to_court(UUID, TEXT, UUID[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.summon_user_to_court(UUID, TEXT, UUID[], UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.summon_user_to_court(UUID, TEXT, UUID[], UUID) TO service_role;

COMMIT;
