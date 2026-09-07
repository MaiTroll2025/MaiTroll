-- Allow anonymous viewers to contribute non-social observation signals.
-- Social actions remain authenticated and server-authoritative.

CREATE OR REPLACE FUNCTION public.record_maitroll_signal_event(
  p_event_type TEXT,
  p_content_type TEXT,
  p_content_id UUID,
  p_creator_id UUID DEFAULT NULL,
  p_surface TEXT DEFAULT NULL,
  p_value NUMERIC DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_event_id UUID;
  v_anonymous_event BOOLEAN := p_event_type IN (
    'impression',
    'click',
    'watch_start',
    'watch_progress',
    'watch_complete',
    'skip',
    'listen_start',
    'listen_progress',
    'listen_complete'
  );
BEGIN
  IF v_actor_id IS NULL AND NOT v_anonymous_event THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF p_event_type NOT IN (
    'impression', 'click', 'watch_start', 'watch_progress', 'watch_complete',
    'skip', 'listen_start', 'listen_progress', 'listen_complete', 'like',
    'reaction', 'comment', 'share', 'follow', 'hide', 'report', 'return_visit'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unsupported event type');
  END IF;

  INSERT INTO public.maitroll_signal_events (
    event_type,
    surface,
    content_type,
    content_id,
    creator_id,
    actor_id,
    value,
    metadata
  ) VALUES (
    p_event_type,
    p_surface,
    p_content_type,
    p_content_id,
    p_creator_id,
    v_actor_id,
    GREATEST(COALESCE(p_value, 1), 0),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object('success', true, 'event_id', v_event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_maitroll_signal_event(TEXT, TEXT, UUID, UUID, TEXT, NUMERIC, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_maitroll_signal_event(TEXT, TEXT, UUID, UUID, TEXT, NUMERIC, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.record_maitroll_signal_event(TEXT, TEXT, UUID, UUID, TEXT, NUMERIC, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_maitroll_signal_event(TEXT, TEXT, UUID, UUID, TEXT, NUMERIC, JSONB) TO service_role;
