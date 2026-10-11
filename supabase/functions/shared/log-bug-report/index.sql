-- Safe RPC: log_app_bug_report
-- Inserts or updates bug reports with duplicate detection.
-- Optimized for high-throughput: uses UPDATE ... WHERE with RETURNING first
-- (single row lock via index), then INSERT only if no match. This avoids the
-- expensive SELECT scan + separate UPDATE/INSERT that caused 19s timeouts.
CREATE OR REPLACE FUNCTION public.log_app_bug_report(
  payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
DECLARE
  v_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_source TEXT;
  v_severity TEXT;
  v_page_url TEXT;
  v_route_path TEXT;
  v_user_id UUID;
  v_user_email TEXT;
  v_user_role TEXT;
  v_stream_id UUID;
  v_function_name TEXT;
  v_table_name TEXT;
  v_error_code TEXT;
  v_error_message TEXT;
  v_error_details TEXT;
  v_error_hint TEXT;
  v_stack_trace TEXT;
  v_file_debug TEXT;
  v_request_payload JSONB;
  v_response_payload JSONB;
  v_browser_info JSONB;
  v_app_context JSONB;
  v_is_duplicate BOOLEAN := false;
BEGIN
  -- Safely extract fields from payload with defaults
  v_source        := COALESCE(payload->>'source', 'frontend');
  v_severity      := COALESCE(payload->>'severity', 'medium');
  v_page_url      := payload->>'page_url';
  v_route_path    := payload->>'route_path';
  v_user_id       := NULLIF(payload->>'user_id', '')::UUID;
  v_user_email    := payload->>'user_email';
  v_user_role     := payload->>'user_role';
  v_stream_id     := NULLIF(payload->>'stream_id', '')::UUID;
  v_function_name := payload->>'function_name';
  v_table_name    := payload->>'table_name';
  v_error_code    := payload->>'error_code';
  v_error_message := COALESCE(payload->>'error_message', 'Unknown application error');
  v_error_details := payload->>'error_details';
  v_error_hint    := payload->>'error_hint';
  v_stack_trace   := payload->>'stack_trace';
  v_file_debug    := payload->>'file_debug';
  v_request_payload  := payload->'request_payload';
  v_response_payload := payload->'response_payload';
  v_browser_info     := payload->'browser_info';
  v_app_context      := payload->'app_context';

  -- Validate severity
  IF v_severity NOT IN ('low', 'medium', 'high', 'critical') THEN
    v_severity := 'medium';
  END IF;

  -- Validate source
  IF v_source IS NULL OR length(trim(v_source)) = 0 THEN
    v_source := 'frontend';
  END IF;

  -- Step 1: Try to update an existing open/in-progress duplicate.
  -- This uses the index on (source, route_path, error_message, status, last_seen_at)
  -- and only locks the single matching row — no full table scan.
  UPDATE public.app_bug_reports
  SET
    occurrence_count = occurrence_count + 1,
    last_seen_at = v_now,
    updated_at = v_now,
    page_url = COALESCE(v_page_url, page_url),
    error_code = COALESCE(v_error_code, error_code),
    error_details = COALESCE(v_error_details, error_details),
    error_hint = COALESCE(v_error_hint, error_hint),
    stack_trace = COALESCE(v_stack_trace, stack_trace),
    file_debug = COALESCE(v_file_debug, file_debug)
  WHERE id = (
    SELECT id
    FROM public.app_bug_reports
    WHERE source = v_source
      AND route_path = v_route_path
      AND error_message = v_error_message
      AND status IN ('open', 'in_progress')
      AND last_seen_at > (v_now - INTERVAL '60 seconds')
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    v_is_duplicate := true;
  ELSE
    -- Step 2: No duplicate found — insert new row.
    -- Use ON CONFLICT to handle the race condition where two concurrent
    -- calls both pass the UPDATE check and try to insert simultaneously.
    BEGIN
      INSERT INTO public.app_bug_reports (
        source, severity, page_url, route_path,
        user_id, user_email, user_role,
        stream_id, function_name, table_name,
        error_code, error_message, error_details, error_hint, stack_trace, file_debug,
        request_payload, response_payload, browser_info, app_context,
        created_at, updated_at, occurrence_count, last_seen_at
      ) VALUES (
        v_source, v_severity, v_page_url, v_route_path,
        v_user_id, v_user_email, v_user_role,
        v_stream_id, v_function_name, v_table_name,
        v_error_code, v_error_message, v_error_details, v_error_hint, v_stack_trace, v_file_debug,
        v_request_payload, v_response_payload, v_browser_info, v_app_context,
        v_now, v_now, 1, v_now
      )
      RETURNING id INTO v_id;
    EXCEPTION
      WHEN unique_violation THEN
        -- Another concurrent call inserted the same bug — fall back to UPDATE
        UPDATE public.app_bug_reports
        SET
          occurrence_count = occurrence_count + 1,
          last_seen_at = v_now,
          updated_at = v_now
        WHERE source = v_source
          AND route_path = v_route_path
          AND error_message = v_error_message
          AND status IN ('open', 'in_progress')
        RETURNING id INTO v_id;
        v_is_duplicate := true;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'duplicate', v_is_duplicate
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Never throw to frontend - just log and return error
    RAISE LOG 'Error in log_app_bug_report: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'id', NULL
    );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.log_app_bug_report(JSONB) TO authenticated;
