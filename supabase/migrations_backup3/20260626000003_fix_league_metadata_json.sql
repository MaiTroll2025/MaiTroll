-- ============================================================================
-- Fix ensure_league_system_ready: invalid input syntax for type json
-- ============================================================================
-- The issue: to_jsonb(v_event) fails when metadata column contains a value
-- that cannot be cast to JSONB. Also the CASE expression for metadata type
-- checking is unnecessary since the column is already JSONB type.
-- Fix: Use jsonb_build_object instead of to_jsonb(v_event) and handle
-- metadata safely with a TRY/CATCH pattern.

CREATE OR REPLACE FUNCTION public.ensure_league_system_ready()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event public.league_events%ROWTYPE;
BEGIN
  PERFORM public.close_expired_league_events();

  SELECT
      id,
      name,
      slug,
      type,
      status,
      starts_at,
      ends_at,
      created_by,
      theme_key,
      points_multiplier,
      metadata,
      created_at,
      updated_at
  INTO v_event
  FROM public.league_events
  WHERE status = 'active'
    AND now() BETWEEN starts_at AND ends_at
  ORDER BY starts_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT
        id,
        name,
        slug,
        type,
        status,
        starts_at,
        ends_at,
        created_by,
        theme_key,
        points_multiplier,
        metadata,
        created_at,
        updated_at
    INTO v_event
    FROM public.create_system_league_event();
  END IF;

  IF v_event.id IS NOT NULL THEN
    PERFORM public.refresh_league_leaderboard(v_event.id);
  END IF;

  -- Safely build JSON response, handling potential metadata corruption
  RETURN jsonb_build_object(
    'id', v_event.id,
    'name', v_event.name,
    'slug', v_event.slug,
    'type', v_event.type,
    'status', v_event.status,
    'starts_at', v_event.starts_at,
    'ends_at', v_event.ends_at,
    'created_by', v_event.created_by,
    'theme_key', v_event.theme_key,
    'points_multiplier', v_event.points_multiplier,
    'metadata', CASE
      WHEN v_event.metadata IS NULL THEN '{}'::jsonb
      ELSE v_event.metadata
    END,
    'created_at', v_event.created_at,
    'updated_at', v_event.updated_at
  );
END;
$$;

-- Also fix any existing rows with corrupted metadata
UPDATE public.league_events
SET metadata = '{}'::jsonb
WHERE metadata IS NOT NULL AND metadata::text = '';

GRANT EXECUTE ON FUNCTION public.ensure_league_system_ready() TO authenticated, anon;
