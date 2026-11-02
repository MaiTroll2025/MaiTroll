BEGIN;

ALTER TABLE IF EXISTS public.court_participants
  DROP CONSTRAINT IF EXISTS court_participants_role_check;

ALTER TABLE IF EXISTS public.court_participants
  ADD CONSTRAINT court_participants_role_check
  CHECK (role IN ('judge', 'prosecutor', 'attorney', 'defendant', 'secretary', 'witness', 'audience', 'bailiff', 'clerk'));

DROP FUNCTION IF EXISTS public.create_global_event(TEXT, TEXT, TEXT, INTEGER, JSONB);

GRANT EXECUTE ON FUNCTION public.create_global_event(
  TEXT, TEXT, TEXT, INTEGER, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.can_access_rtc_admin_monitor(UUID)
  TO authenticated, service_role;

-- Session pages and session creation are restricted to judges and administrators.
ALTER TABLE public.court_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "court_sessions_judge_admin_insert" ON public.court_sessions;
CREATE POLICY "court_sessions_judge_admin_insert"
  ON public.court_sessions
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          is_admin = true
          OR is_superadmin = true
          OR is_judge = true
          OR lower(COALESCE(role, '')) IN ('admin', 'superadmin', 'judge')
          OR lower(COALESCE(troll_role, '')) IN ('admin', 'superadmin', 'judge')
        )
    )
  );

DROP POLICY IF EXISTS "court_sessions_judge_admin_update" ON public.court_sessions;
CREATE POLICY "court_sessions_judge_admin_update"
  ON public.court_sessions
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          is_admin = true
          OR is_superadmin = true
          OR is_judge = true
          OR lower(COALESCE(role, '')) IN ('admin', 'superadmin', 'judge')
          OR lower(COALESCE(troll_role, '')) IN ('admin', 'superadmin', 'judge')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = auth.uid()
        AND (
          is_admin = true
          OR is_superadmin = true
          OR is_judge = true
          OR lower(COALESCE(role, '')) IN ('admin', 'superadmin', 'judge')
          OR lower(COALESCE(troll_role, '')) IN ('admin', 'superadmin', 'judge')
        )
    )
  );

CREATE OR REPLACE FUNCTION public.join_court_session(
  p_court_session_id UUID,
  p_role TEXT DEFAULT 'audience'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.court_sessions%ROWTYPE;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  IF COALESCE(p_role NOT IN ('judge', 'prosecutor', 'attorney', 'defendant', 'secretary', 'witness', 'audience', 'bailiff', 'clerk'), true) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid court participant role');
  END IF;

  SELECT * INTO v_session
  FROM public.court_sessions
  WHERE id = p_court_session_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Court session not found');
  END IF;

  INSERT INTO public.court_participants (court_session_id, user_id, role)
  VALUES (p_court_session_id, v_user_id, p_role)
  ON CONFLICT (court_session_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'message', 'Joined court session');
END;
$$;

CREATE OR REPLACE FUNCTION public.start_court_session(
  p_case_id UUID DEFAULT NULL,
  p_room_name TEXT DEFAULT NULL,
  p_max_boxes INTEGER DEFAULT 6
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_session_id UUID := gen_random_uuid();
  v_channel TEXT;
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = v_actor
        AND (
          is_admin = true
          OR is_superadmin = true
          OR is_judge = true
          OR lower(COALESCE(role, '')) IN ('admin', 'superadmin', 'judge')
          OR lower(COALESCE(troll_role, '')) IN ('admin', 'superadmin', 'judge')
        )
    ) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Only judges and administrators can open court sessions');
    END IF;
  END IF;

  v_channel := 'troll-court-' || v_session_id;

  INSERT INTO public.court_sessions (
    id, room_name, started_by, status, started_at, max_boxes, case_id, is_live, session_id
  ) VALUES (
    v_session_id,
    COALESCE(p_room_name, 'Troll Court'),
    v_actor,
    'active',
    NOW(),
    GREATEST(2, LEAST(6, p_max_boxes)),
    p_case_id,
    TRUE,
    v_session_id
  );

  INSERT INTO public.streams (user_id, broadcaster_id, title, category, status, is_live, started_at, agora_channel, box_count, layout_mode)
  VALUES (v_actor, v_actor, 'Troll Court Session', 'court', 'live', TRUE, NOW(), v_channel, GREATEST(2, LEAST(6, p_max_boxes)), 'grid')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.court_audit_log (action, actor_id, session_id, case_id, reason, metadata)
  VALUES ('court_session_started', v_actor, v_session_id, p_case_id, 'Court session started',
    jsonb_build_object('channel', v_channel));

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'channel', v_channel
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
