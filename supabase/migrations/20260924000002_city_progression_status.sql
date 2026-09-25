-- City progression is a status projection over the existing XP/level system.
-- It is deliberately separate from authorization roles and wallet state.

CREATE TABLE IF NOT EXISTS public.city_progression_statuses (
  status_key TEXT PRIMARY KEY,
  status_order INTEGER NOT NULL UNIQUE CHECK (status_order >= 0),
  min_level INTEGER NOT NULL CHECK (min_level >= 1),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.city_progression_statuses (
  status_key,
  status_order,
  min_level,
  display_name
)
VALUES
  ('resident', 0, 1, 'Resident'),
  ('tenant', 1, 10, 'Tenant'),
  ('landlord', 2, 50, 'Landlord'),
  ('owner', 3, 100, 'Owner'),
  ('mayor', 4, 250, 'Mayor')
ON CONFLICT (status_key) DO NOTHING;

ALTER TABLE public.city_progression_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "City progression statuses are publicly readable"
  ON public.city_progression_statuses;

CREATE POLICY "City progression statuses are publicly readable"
  ON public.city_progression_statuses
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.get_city_status(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  user_id UUID,
  status_key TEXT,
  display_name TEXT,
  status_order INTEGER,
  level INTEGER,
  xp_total BIGINT,
  next_status_key TEXT,
  next_display_name TEXT,
  next_min_level INTEGER
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH source_level AS (
    SELECT
      p_user_id AS user_id,
      COALESCE(up.level, us.level, 1)::INTEGER AS level,
      COALESCE(up.xp, us.xp_total, 0)::BIGINT AS xp_total
    FROM public.user_profiles AS up
    LEFT JOIN public.user_stats AS us ON us.user_id = up.id
    WHERE up.id = p_user_id
  ), current_status AS (
    SELECT DISTINCT ON (sl.user_id)
      sl.user_id,
      cps.status_key,
      cps.display_name,
      cps.status_order,
      sl.level,
      sl.xp_total
    FROM source_level AS sl
    JOIN public.city_progression_statuses AS cps
      ON cps.min_level <= sl.level
    ORDER BY sl.user_id, cps.status_order DESC
  )
  SELECT
    cs.user_id,
    cs.status_key,
    cs.display_name,
    cs.status_order,
    cs.level,
    cs.xp_total,
    next_status.status_key,
    next_status.display_name,
    next_status.min_level
  FROM current_status AS cs
  LEFT JOIN public.city_progression_statuses AS next_status
    ON next_status.status_order = cs.status_order + 1;
$$;

REVOKE ALL ON FUNCTION public.get_city_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_city_status(UUID) TO anon, authenticated;

COMMENT ON TABLE public.city_progression_statuses IS
  'Configurable city status projection over the existing MaiTroll level/XP system.';

COMMENT ON FUNCTION public.get_city_status(UUID) IS
  'Returns server-derived city status from user_stats/user_profiles without changing authorization roles.';

CREATE TABLE IF NOT EXISTS public.city_progression_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_status_key TEXT,
  new_status_key TEXT NOT NULL,
  level INTEGER NOT NULL,
  xp_total BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_city_progression_events_user_created
  ON public.city_progression_events (user_id, created_at DESC);

ALTER TABLE public.city_progression_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read city progression events"
  ON public.city_progression_events;

CREATE POLICY "Users can read city progression events"
  ON public.city_progression_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_city_progression_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_previous_level INTEGER;
  v_level INTEGER;
  v_xp_total BIGINT;
  v_previous_status TEXT;
  v_new_status TEXT;
  v_username TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'user_profiles' THEN
    IF NEW.level IS NOT DISTINCT FROM OLD.level AND NEW.xp IS NOT DISTINCT FROM OLD.xp THEN
      RETURN NEW;
    END IF;
    v_user_id := NEW.id;
    v_previous_level := COALESCE(OLD.level, 1);
    v_level := COALESCE(NEW.level, 1);
    v_xp_total := COALESCE(NEW.xp, 0);
  ELSE
    IF NEW.level IS NOT DISTINCT FROM OLD.level AND NEW.xp_total IS NOT DISTINCT FROM OLD.xp_total THEN
      RETURN NEW;
    END IF;
    v_user_id := NEW.user_id;
    v_previous_level := COALESCE(OLD.level, 1);
    v_level := COALESCE(NEW.level, 1);
    v_xp_total := COALESCE(NEW.xp_total, 0);
  END IF;

  SELECT cps.status_key
  INTO v_previous_status
  FROM public.city_progression_statuses AS cps
  WHERE cps.min_level <= v_previous_level
  ORDER BY cps.status_order DESC
  LIMIT 1;

  SELECT cps.status_key
  INTO v_new_status
  FROM public.city_progression_statuses AS cps
  WHERE cps.min_level <= v_level
  ORDER BY cps.status_order DESC
  LIMIT 1;

  IF v_new_status IS NULL OR v_new_status = v_previous_status THEN
    RETURN NEW;
  END IF;

  SELECT username INTO v_username
  FROM public.user_profiles
  WHERE id = v_user_id;

  INSERT INTO public.city_progression_events (
    user_id,
    previous_status_key,
    new_status_key,
    level,
    xp_total
  )
  VALUES (
    v_user_id,
    v_previous_status,
    v_new_status,
    v_level,
    v_xp_total
  );

  INSERT INTO public.global_events (type, title, icon, priority, metadata)
  VALUES (
    'city_progression',
    format('%s reached %s status', COALESCE(v_username, 'A Resident'), initcap(replace(v_new_status, '_', ' '))),
    'city',
    2,
    jsonb_build_object(
      'user_id', v_user_id,
      'previous_status', v_previous_status,
      'new_status', v_new_status,
      'level', v_level,
      'xp_total', v_xp_total
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_city_progression_event ON public.user_profiles;

CREATE TRIGGER trg_record_city_progression_event
  AFTER UPDATE OF level, xp ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.record_city_progression_event();