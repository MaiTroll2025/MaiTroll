-- ============================================================================
-- Secure Moderation Reports RPC Migration
-- ============================================================================
-- Adds missing columns to moderation_reports and creates secure RPCs for:
--   submit_report, list_reports, reject_report, take_action
--
-- All RPCs derive the actor from auth.uid().
-- Frontend MUST NOT supply actor_id, officer_id, role, or permission fields.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. Ensure moderation_reports has the expected columns
-- ============================================================================

DO $guard$
BEGIN
  IF to_regclass('public.moderation_reports') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'moderation_reports'
        AND column_name = 'reporter_id'
    ) THEN
      ALTER TABLE public.moderation_reports
        ADD COLUMN reporter_id uuid NOT NULL DEFAULT gen_random_uuid();
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'moderation_reports'
        AND column_name = 'target_user_id'
    ) THEN
      ALTER TABLE public.moderation_reports
        ADD COLUMN target_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'moderation_reports'
        AND column_name = 'stream_id'
    ) THEN
      ALTER TABLE public.moderation_reports
        ADD COLUMN stream_id uuid REFERENCES public.streams(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'moderation_reports'
        AND column_name = 'report_reason'
    ) THEN
      ALTER TABLE public.moderation_reports
        ADD COLUMN report_reason text NOT NULL DEFAULT '';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'moderation_reports'
        AND column_name = 'report_details'
    ) THEN
      ALTER TABLE public.moderation_reports
        ADD COLUMN report_details text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'moderation_reports'
        AND column_name = 'status'
    ) THEN
      ALTER TABLE public.moderation_reports
        ADD COLUMN status text DEFAULT 'pending';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'moderation_reports'
        AND column_name = 'resolved_by'
    ) THEN
      ALTER TABLE public.moderation_reports
        ADD COLUMN resolved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'moderation_reports'
        AND column_name = 'resolved_at'
    ) THEN
      ALTER TABLE public.moderation_reports
        ADD COLUMN resolved_at timestamptz;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'moderation_reports'
        AND column_name = 'created_at'
    ) THEN
      ALTER TABLE public.moderation_reports
        ADD COLUMN created_at timestamptz DEFAULT now();
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'moderation_reports'
        AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.moderation_reports
        ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;

    -- Drop legacy JSONB data column if it exists and is unused
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'moderation_reports'
        AND column_name = 'data'
    ) THEN
      ALTER TABLE public.moderation_reports DROP COLUMN IF EXISTS data;
    END IF;

    -- Drop legacy user_id column if it exists (reporter_id is the source of truth)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'moderation_reports'
        AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.moderation_reports DROP COLUMN IF EXISTS user_id;
    END IF;

    -- Ensure reporter_id has a proper FK
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'moderation_reports'
        AND column_name = 'reporter_id'
    ) THEN
      ALTER TABLE public.moderation_reports
        ADD COLUMN reporter_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE;
    END IF;

    -- Status check constraint
    DO $status_guard$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'moderation_reports_status_check'
          AND conrelid = 'public.moderation_reports'::regclass
      ) THEN
        ALTER TABLE public.moderation_reports
          DROP CONSTRAINT moderation_reports_status_check;
      END IF;
    END $status_guard$;

    ALTER TABLE public.moderation_reports
      ADD CONSTRAINT moderation_reports_status_check
      CHECK (status IN ('pending', 'reviewing', 'resolved', 'action_taken', 'rejected'));

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_moderation_reports_reporter_created
      ON public.moderation_reports (reporter_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_moderation_reports_reporter_reported
      ON public.moderation_reports (reporter_id, target_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_moderation_reports_status
      ON public.moderation_reports (status);
    CREATE INDEX IF NOT EXISTS idx_moderation_reports_stream
      ON public.moderation_reports (stream_id);
  END IF;
END $guard$;

-- ============================================================================
-- 1. Helper: require_moderation_access()
-- ============================================================================
-- Central authorization helper for moderation RPCs.
-- Returns (actor_id, role) or raises an exception with a structured error.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.require_moderation_access()
RETURNS TABLE (
  actor_id uuid,
  actor_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_profile public.user_profiles%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED:You must be signed in.';
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = v_actor_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND:User profile not found.';
  END IF;

  IF NOT public.is_modo_role(v_actor_id) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED:You do not have permission to use Mod Actions.';
  END IF;

  actor_id := v_actor_id;
  actor_role := COALESCE(
    NULLIF(LOWER(v_profile.role), ''),
    NULLIF(LOWER(v_profile.troll_role), ''),
    'user'
  );

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.require_moderation_access() TO authenticated, service_role;

-- ============================================================================
-- 2. submit_report
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_report(
  p_target_user_id uuid DEFAULT NULL,
  p_stream_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_report_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'UNAUTHENTICATED',
      'message', 'You must be signed in.', 'data', NULL
    );
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_INPUT',
      'message', 'Reason is required.', 'data', NULL
    );
  END IF;

  IF p_target_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = p_target_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_TARGET',
      'message', 'Target user not found.', 'data', NULL
    );
  END IF;

  IF p_stream_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.streams WHERE id = p_stream_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_STREAM_ID',
      'message', 'Stream not found.', 'data', NULL
    );
  END IF;

  INSERT INTO public.moderation_reports (
    reporter_id,
    target_user_id,
    stream_id,
    report_reason,
    report_details,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_actor_id,
    p_target_user_id,
    p_stream_id,
    trim(p_reason),
    trim(p_description),
    'pending',
    now(),
    now()
  )
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object(
    'success', true, 'code', 'REPORT_SUBMITTED',
    'message', 'Report submitted.', 'data',
    jsonb_build_object('report_id', v_report_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_report(uuid, uuid, text, text) TO authenticated, service_role;

-- ============================================================================
-- 3. list_reports
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_reports(
  p_status_filter text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_reports jsonb;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'UNAUTHENTICATED',
      'message', 'You must be signed in.', 'data', NULL
    );
  END IF;

  IF NOT public.is_modo_role(v_actor_id) THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'NOT_AUTHORIZED',
      'message', 'You do not have permission to list reports.', 'data', NULL
    );
  END IF;

  SELECT COALESCE(LOWER(role), LOWER(troll_role), 'user')
    INTO v_actor_role
    FROM public.user_profiles
    WHERE id = v_actor_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'report_id', r.id,
      'id', r.id,
      'reporter_id', r.reporter_id,
      'reporter_username', COALESCE(rp.username, rp.full_name, 'Unknown'),
      'reported_user_id', r.target_user_id,
      'reported_username', COALESCE(tp.username, tp.full_name, 'Unknown'),
      'target_user_id', r.target_user_id,
      'target_username', COALESCE(tp.username, tp.full_name, 'Unknown'),
      'report_reason', r.report_reason,
      'reason', r.report_reason,
      'report_details', r.report_details,
      'description', r.report_details,
      'stream_id', r.stream_id,
      'stream_title', s.title,
      'status', r.status,
      'resolved_by', r.resolved_by,
      'resolved_at', r.resolved_at,
      'created_at', r.created_at
    )
  )
  INTO v_reports
  FROM public.moderation_reports r
  LEFT JOIN public.user_profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.user_profiles tp ON tp.id = r.target_user_id
  LEFT JOIN public.streams s ON s.id = r.stream_id
  WHERE
    (p_status_filter IS NULL OR r.status = p_status_filter)
    AND (
      v_actor_role IN ('ceo', 'admin', 'lead_troll_officer', 'troll_officer', 'secretary')
      OR r.status IN ('pending', 'reviewing')
    )
  ORDER BY r.created_at DESC;

  RETURN jsonb_build_object(
    'success', true, 'code', 'REPORTS_LISTED',
    'message', 'Reports retrieved.', 'data',
    jsonb_build_object('reports', COALESCE(v_reports, '[]'::jsonb))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_reports(text) TO authenticated, service_role;

-- ============================================================================
-- 4. reject_report
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reject_report(
  p_report_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_updated uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'UNAUTHENTICATED',
      'message', 'You must be signed in.', 'data', NULL
    );
  END IF;

  IF NOT public.is_modo_role(v_actor_id) THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'NOT_AUTHORIZED',
      'message', 'You do not have permission to reject reports.', 'data', NULL
    );
  END IF;

  IF p_report_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_INPUT',
      'message', 'report_id is required.', 'data', NULL
    );
  END IF;

  UPDATE public.moderation_reports
  SET status = 'rejected',
      resolved_by = v_actor_id,
      resolved_at = now(),
      updated_at = now()
  WHERE id = p_report_id
  RETURNING id INTO v_updated;

  IF v_updated IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'REPORT_NOT_FOUND',
      'message', 'Report not found.', 'data', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'code', 'REPORT_REJECTED',
    'message', 'Report rejected.', 'data',
    jsonb_build_object('report_id', v_updated)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_report(uuid) TO authenticated, service_role;

-- ============================================================================
-- 5. take_action
-- ============================================================================
-- Handles: warn, suspend_stream, arrest
-- Records moderation_actions via modo_audit and resolves the associated report.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.take_action(
  p_report_id uuid DEFAULT NULL,
  p_action_type text DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL,
  p_stream_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_action_details text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_ban_duration_hours integer DEFAULT NULL,
  p_honesty_message_shown boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_target_display text;
  v_target_role text;
  v_stream_title text;
  v_action_record_id uuid;
  v_now timestamptz := now();
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'UNAUTHENTICATED',
      'message', 'You must be signed in.', 'data', NULL
    );
  END IF;

  IF NOT public.is_modo_role(v_actor_id) THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'NOT_AUTHORIZED',
      'message', 'You do not have permission to take moderation actions.', 'data', NULL
    );
  END IF;

  IF p_action_type IS NULL OR length(trim(p_action_type)) = 0 THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_INPUT',
      'message', 'action_type is required.', 'data', NULL
    );
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_INPUT',
      'message', 'Reason is required.', 'data', NULL
    );
  END IF;

  IF p_action_type NOT IN ('warn', 'suspend_stream', 'arrest') THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_ACTION',
      'message', 'Unsupported action_type. Use warn, suspend_stream, or arrest.', 'data', NULL
    );
  END IF;

  IF p_action_type = 'suspend_stream' AND p_stream_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_INPUT',
      'message', 'stream_id is required for suspend_stream.', 'data', NULL
    );
  END IF;

  IF p_action_type = 'arrest' AND p_target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_INPUT',
      'message', 'target_user_id is required for arrest.', 'data', NULL
    );
  END IF;

  -- Validate target exists
  IF p_target_user_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(username, ''), 'Unknown'), COALESCE(role, 'unknown')
      INTO v_target_display, v_target_role
      FROM public.user_profiles
      WHERE id = p_target_user_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false, 'code', 'INVALID_TARGET',
        'message', 'Target user not found.', 'data', NULL
      );
    END IF;
  ELSE
    v_target_display := NULL;
    v_target_role := NULL;
  END IF;

  -- Validate stream exists
  IF p_stream_id IS NOT NULL THEN
    SELECT title INTO v_stream_title FROM public.streams WHERE id = p_stream_id;
  ELSE
    v_stream_title := NULL;
  END IF;

  SELECT COALESCE(LOWER(role), LOWER(troll_role), 'user')
    INTO v_actor_role
    FROM public.user_profiles
    WHERE id = v_actor_id;

  -- Resolve report if provided
  IF p_report_id IS NOT NULL THEN
    UPDATE public.moderation_reports
    SET status = 'resolved',
        resolved_by = v_actor_id,
        resolved_at = v_now,
        updated_at = v_now
    WHERE id = p_report_id AND status IN ('pending', 'reviewing');
  END IF;

  -- Execute the action
  IF p_action_type = 'warn' THEN
    -- Warn is just a notification + audit record
    PERFORM public.create_notification(
      p_target_user_id,
      'moderation_warning',
      'Moderation Warning',
      COALESCE(p_reason, 'You have received a moderation warning.'),
      jsonb_build_object(
        'reporter_id', v_actor_id,
        'report_id', p_report_id,
        'action_details', p_action_details
      )
    );

    PERFORM public.modo_audit(
      'warn', 'Warn', v_actor_id, p_target_user_id, v_target_display,
      v_target_role, v_target_role, p_stream_id, NULL,
      p_reason, NULL, 'active', 'warned', p_expires_at, true, NULL,
      jsonb_build_object(
        'report_id', p_report_id,
        'action_details', p_action_details,
        'honesty_message_shown', p_honesty_message_shown
      )
    );

  ELSIF p_action_type = 'suspend_stream' THEN
    IF p_stream_id IS NOT NULL THEN
      UPDATE public.streams
      SET is_live = false,
          status = 'ended',
          updated_at = v_now
      WHERE id = p_stream_id;

      INSERT INTO public.broadcast_restrictions (
        user_id, restricted_by, stream_id, reason, duration_minutes,
        starts_at, expires_at, status
      ) VALUES (
        (SELECT COALESCE(user_id, broadcaster_id) FROM public.streams WHERE id = p_stream_id),
        v_actor_id, p_stream_id, p_reason,
        COALESCE(p_ban_duration_hours, 24) * 60,
        v_now,
        COALESCE(p_expires_at, v_now + interval '24 hours'),
        'active'
      );
    END IF;

    PERFORM public.modo_audit(
      'suspend_stream', 'Suspend Stream', v_actor_id,
      (SELECT COALESCE(user_id, broadcaster_id) FROM public.streams WHERE id = p_stream_id),
      v_stream_title, NULL, NULL, p_stream_id, NULL,
      p_reason, COALESCE(p_ban_duration_hours, 24) * 60,
      'live', 'suspended', p_expires_at, true, NULL,
      jsonb_build_object(
        'report_id', p_report_id,
        'action_details', p_action_details
      )
    );

  ELSIF p_action_type = 'arrest' THEN
    -- Delegate to the existing secure modo_arrest RPC
    RETURN (
      SELECT data FROM public.modo_arrest(
        p_stream_id => p_stream_id,
        p_target_user_id => p_target_user_id,
        p_reason => p_reason,
        p_severity => 'moderate'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'code', 'ACTION_COMPLETED',
    'message', 'Action completed.', 'data', NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.take_action(
  uuid, text, uuid, uuid, text, text, timestamptz, integer, boolean
) TO authenticated, service_role;

-- ============================================================================
-- 6. RLS on moderation_reports
-- ============================================================================

DO $guard$
BEGIN
  IF to_regclass('public.moderation_reports') IS NOT NULL THEN
    ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "modo_reports_select" ON public.moderation_reports;
    CREATE POLICY "modo_reports_select"
      ON public.moderation_reports
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND (
              LOWER(COALESCE(up.role, '')) IN (
                'ceo','admin','lead_troll_officer','troll_officer','secretary',
                'broadcaster','broadofficer','ceo_assistant','noah_assistant'
              )
              OR LOWER(COALESCE(up.troll_role, '')) IN (
                'ceo','admin','lead_troll_officer','troll_officer','secretary',
                'broadcaster','broadofficer','ceo_assistant','noah_assistant'
              )
            )
        )
        OR reporter_id = auth.uid()
      );

    DROP POLICY IF EXISTS "modo_reports_insert" ON public.moderation_reports;
    CREATE POLICY "modo_reports_insert"
      ON public.moderation_reports
      FOR INSERT
      TO authenticated
      WITH CHECK (reporter_id = auth.uid());

    DROP POLICY IF EXISTS "modo_reports_update" ON public.moderation_reports;
    CREATE POLICY "modo_reports_update"
      ON public.moderation_reports
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND (
              LOWER(COALESCE(up.role, '')) IN (
                'ceo','admin','lead_troll_officer','troll_officer','secretary',
                'broadcaster','broadofficer','ceo_assistant','noah_assistant'
              )
              OR LOWER(COALESCE(up.troll_role, '')) IN (
                'ceo','admin','lead_troll_officer','troll_officer','secretary',
                'broadcaster','broadofficer','ceo_assistant','noah_assistant'
              )
            )
        )
      );
  END IF;
END $guard$;

COMMIT;

NOTIFY pgrst, 'reload schema';
