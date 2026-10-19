BEGIN;

DO $preflight$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.user_profiles') IS NULL THEN
    v_missing := array_append(v_missing, 'public.user_profiles');
  END IF;
  IF to_regclass('public.streams') IS NULL THEN
    v_missing := array_append(v_missing, 'public.streams');
  END IF;
  IF to_regclass('public.coin_transactions') IS NULL THEN
    v_missing := array_append(v_missing, 'public.coin_transactions');
  END IF;
  IF to_regclass('public.stream_gifts') IS NULL THEN
    v_missing := array_append(v_missing, 'public.stream_gifts');
  END IF;
  IF to_regclass('public.stream_audience_presence') IS NULL THEN
    v_missing := array_append(v_missing, 'public.stream_audience_presence');
  END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'T League migration requires existing tables: %',
      array_to_string(v_missing, ', ');
  END IF;
END
$preflight$;

CREATE TABLE IF NOT EXISTS public.t_league_mission_catalog (
  mission_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target_value NUMERIC(14, 2) NOT NULL CHECK (target_value > 0),
  reward_points BIGINT NOT NULL CHECK (reward_points > 0),
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'onboarding')),
  eligible_roles TEXT[] NOT NULL DEFAULT ARRAY['all']::TEXT[],
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.t_league_mission_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  mission_key TEXT NOT NULL REFERENCES public.t_league_mission_catalog(mission_key),
  period_start DATE NOT NULL,
  target_value NUMERIC(14, 2) NOT NULL CHECK (target_value > 0),
  current_value NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  reward_points BIGINT NOT NULL CHECK (reward_points > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  points_awarded BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, mission_key, period_start)
);

CREATE TABLE IF NOT EXISTS public.t_league_mission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  event_value NUMERIC(14, 2) NOT NULL CHECK (event_value > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_table, source_id, event_type)
);

CREATE TABLE IF NOT EXISTS public.t_league_progress (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  total_points BIGINT NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.t_league_eligible_coin_sources (
  transaction_type TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.t_league_viewing_sessions (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  watched_seconds INTEGER NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0),
  completed_minutes INTEGER NOT NULL DEFAULT 0 CHECK (completed_minutes >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.t_league_referral_clicks (
  visitor_token UUID PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  referred_user_id UUID UNIQUE REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.t_league_referral_attributions (
  referred_user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  visitor_token UUID NOT NULL UNIQUE REFERENCES public.t_league_referral_clicks(visitor_token),
  qualifying_view_minutes NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (qualifying_view_minutes >= 0),
  qualified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.t_league_referral_reward_ledger (
  referred_user_id UUID PRIMARY KEY REFERENCES public.t_league_referral_attributions(referred_user_id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reward_points BIGINT NOT NULL CHECK (reward_points > 0),
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released')),
  release_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.t_league_mission_catalog
  (mission_key, title, description, event_type, target_value, reward_points, cadence, eligible_roles)
VALUES
  ('weekly_broadcast', 'Build your broadcast habit', 'Complete 60 minutes of live broadcasting.', 'broadcast_minutes', 60, 100, 'weekly', ARRAY['broadcaster']),
  ('new_creator_broadcast', 'Start your creator journey', 'Complete 15 minutes of live broadcasting.', 'broadcast_minutes', 15, 80, 'onboarding', ARRAY['all']),
  ('weekly_viewing', 'Watch live together', 'Watch 30 verified minutes of live broadcasts.', 'broadcast_view_minutes', 30, 50, 'weekly', ARRAY['all'])
ON CONFLICT (mission_key) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    event_type = EXCLUDED.event_type,
    target_value = EXCLUDED.target_value,
    reward_points = EXCLUDED.reward_points,
    cadence = EXCLUDED.cadence,
    eligible_roles = EXCLUDED.eligible_roles,
    is_enabled = TRUE,
    updated_at = NOW();

INSERT INTO public.t_league_eligible_coin_sources (transaction_type, description)
VALUES
  ('gift_received', 'Creator coin share from a completed gift.'),
  ('founder_gift_bonus', 'Founder program earnings tied to a completed gift.'),
  ('agency_leader_bonus', 'Agency leader earnings tied to creator activity.'),
  ('agency_recruiter_bonus', 'Agency recruiter earnings tied to creator activity.')
ON CONFLICT (transaction_type) DO UPDATE
SET description = EXCLUDED.description,
    enabled = TRUE;

UPDATE public.t_league_eligible_coin_sources
SET enabled = FALSE
WHERE transaction_type = 'earn';

CREATE INDEX IF NOT EXISTS idx_tleague_events_user_type_time
  ON public.t_league_mission_events (user_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_tleague_assignments_user_status
  ON public.t_league_mission_assignments (user_id, status, period_start);
CREATE INDEX IF NOT EXISTS idx_tleague_coin_sources_positive
  ON public.coin_transactions (user_id, type)
  WHERE amount > 0;
CREATE INDEX IF NOT EXISTS idx_tleague_referral_rewards_held
  ON public.t_league_referral_reward_ledger (referrer_id, release_at)
  WHERE status = 'held';

ALTER TABLE public.t_league_mission_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_league_mission_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_league_mission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_league_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_league_eligible_coin_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_league_viewing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_league_referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_league_referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_league_referral_reward_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "T League mission catalog is readable" ON public.t_league_mission_catalog;
CREATE POLICY "T League mission catalog is readable"
  ON public.t_league_mission_catalog FOR SELECT TO authenticated USING (is_enabled);

DROP POLICY IF EXISTS "Users can read own T League missions" ON public.t_league_mission_assignments;
CREATE POLICY "Users can read own T League missions"
  ON public.t_league_mission_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own T League progress" ON public.t_league_progress;
CREATE POLICY "Users can read own T League progress"
  ON public.t_league_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Public can read T League standings" ON public.t_league_progress;
CREATE POLICY "Public can read T League standings"
  ON public.t_league_progress FOR SELECT TO anon, authenticated
  USING (TRUE);

GRANT SELECT ON public.t_league_mission_catalog TO authenticated;
GRANT SELECT ON public.t_league_mission_assignments TO authenticated;
GRANT SELECT ON public.t_league_progress TO authenticated;
GRANT SELECT ON public.t_league_progress TO anon;
GRANT ALL ON public.t_league_mission_catalog TO service_role;
GRANT ALL ON public.t_league_mission_assignments TO service_role;
GRANT ALL ON public.t_league_mission_events TO service_role;
GRANT ALL ON public.t_league_progress TO service_role;
GRANT ALL ON public.t_league_eligible_coin_sources TO service_role;
GRANT ALL ON public.t_league_viewing_sessions TO service_role;
GRANT ALL ON public.t_league_referral_clicks TO service_role;
GRANT ALL ON public.t_league_referral_attributions TO service_role;
GRANT ALL ON public.t_league_referral_reward_ledger TO service_role;

CREATE OR REPLACE FUNCTION public.t_league_tier_for_points(p_points BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_tier INTEGER;
  v_threshold BIGINT;
BEGIN
  IF COALESCE(p_points, 0) >= 2000000 THEN
    RETURN LEAST(
      500,
      10 + FLOOR(SQRT((p_points - 2000000)::NUMERIC / 8000))::INTEGER
    );
  END IF;

  FOR v_tier IN REVERSE 10..0 LOOP
    v_threshold := CASE v_tier
      WHEN 10 THEN 2000000
      WHEN 9 THEN 750000
      WHEN 8 THEN 300000
      WHEN 7 THEN 100000
      WHEN 6 THEN 40000
      WHEN 5 THEN 15000
      WHEN 4 THEN 5000
      WHEN 3 THEN 2000
      WHEN 2 THEN 500
      WHEN 1 THEN 100
      ELSE 0
    END;
    IF COALESCE(p_points, 0) >= v_threshold THEN
      RETURN v_tier;
    END IF;
  END LOOP;
  RETURN 0;
END;
$$;

CREATE OR REPLACE VIEW public.t_league_public_standings AS
SELECT
  progress.user_id,
  progress.total_points,
  CASE
    WHEN public.t_league_tier_for_points(progress.total_points) = 500
      AND COALESCE(eligible.coins, 0) < 5000000000000 THEN 499
    ELSE public.t_league_tier_for_points(progress.total_points)
  END AS tier
FROM public.t_league_progress progress
LEFT JOIN LATERAL (
  SELECT SUM(ct.amount)::BIGINT AS coins
  FROM public.coin_transactions ct
  JOIN public.t_league_eligible_coin_sources source
    ON source.transaction_type = ct.type
   AND source.enabled
  WHERE ct.user_id = progress.user_id
    AND ct.amount > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.stream_gifts gift
      WHERE gift.id::TEXT = COALESCE(ct.metadata->>'stream_gift_id', ct.metadata->>'original_stream_gift_id')
        AND gift.is_reversed IS TRUE
    )
) eligible ON TRUE;

GRANT SELECT ON public.t_league_public_standings TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.t_league_roles_for_user(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile JSONB;
  v_roles TEXT[] := ARRAY['all']::TEXT[];
  v_role TEXT;
  v_troll_role TEXT;
BEGIN
  SELECT to_jsonb(up) INTO v_profile
  FROM public.user_profiles up
  WHERE up.id = p_user_id;

  IF v_profile IS NULL THEN
    RETURN v_roles;
  END IF;

  v_role := LOWER(COALESCE(v_profile->>'role', ''));
  v_troll_role := LOWER(COALESCE(v_profile->>'troll_role', ''));
  IF v_role <> '' THEN v_roles := array_append(v_roles, v_role); END IF;
  IF v_troll_role <> '' THEN v_roles := array_append(v_roles, v_troll_role); END IF;

  IF COALESCE(v_profile->>'is_admin', 'false') = 'true'
     OR v_role IN ('admin', 'super_admin', 'superadmin') THEN
    v_roles := array_append(v_roles, 'admin');
  END IF;
  IF COALESCE(v_profile->>'is_troll_officer', 'false') = 'true'
     OR v_role IN ('troll_officer', 'moderator', 'broadcaster_moderator') THEN
    v_roles := array_append(v_roles, 'moderator');
    v_roles := array_append(v_roles, 'troll_officer');
  END IF;
  IF COALESCE(v_profile->>'is_lead_officer', 'false') = 'true' THEN
    v_roles := array_append(v_roles, 'lead_officer');
  END IF;
  IF COALESCE(v_profile->>'is_secretary', 'false') = 'true' THEN
    v_roles := array_append(v_roles, 'secretary');
  END IF;
  IF COALESCE(v_profile->>'is_prosecutor', 'false') = 'true' THEN
    v_roles := array_append(v_roles, 'prosecutor');
  END IF;
  IF COALESCE(v_profile->>'is_attorney', 'false') = 'true' THEN
    v_roles := array_append(v_roles, 'attorney');
  END IF;
  IF to_regclass('public.streams') IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.streams s
    WHERE COALESCE(
      NULLIF(to_jsonb(s)->>'broadcaster_id', ''),
      NULLIF(to_jsonb(s)->>'user_id', '')
    ) = p_user_id::TEXT
  ) THEN
    v_roles := array_append(v_roles, 'broadcaster');
    v_roles := array_append(v_roles, 'creator');
  END IF;

  RETURN ARRAY(SELECT DISTINCT role FROM unnest(v_roles) AS role);
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_refresh_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_at TIMESTAMPTZ;
  v_roles TEXT[];
  v_live_minutes NUMERIC := 0;
  v_stream_count INTEGER := 0;
  v_performance_factor NUMERIC := 1;
  v_points_to_add BIGINT := 0;
BEGIN
  SELECT created_at INTO v_created_at
  FROM public.user_profiles
  WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_roles := public.t_league_roles_for_user(p_user_id);

  IF to_regclass('public.streams') IS NOT NULL THEN
    SELECT
    COALESCE(SUM(LEAST(
      360,
      GREATEST(
        0,
        EXTRACT(EPOCH FROM (
          COALESCE(
            NULLIF(to_jsonb(s)->>'ended_at', '')::TIMESTAMPTZ,
            NULLIF(to_jsonb(s)->>'updated_at', '')::TIMESTAMPTZ,
            NOW()
          ) - COALESCE(
            NULLIF(to_jsonb(s)->>'started_at', '')::TIMESTAMPTZ,
            NULLIF(to_jsonb(s)->>'start_time', '')::TIMESTAMPTZ,
            NULLIF(to_jsonb(s)->>'created_at', '')::TIMESTAMPTZ
          )
        )) / 60
      )
    )), 0),
    COUNT(*)::INTEGER
  INTO v_live_minutes, v_stream_count
  FROM public.streams s
  WHERE COALESCE(
      NULLIF(to_jsonb(s)->>'broadcaster_id', ''),
      NULLIF(to_jsonb(s)->>'user_id', '')
    ) = p_user_id::TEXT
    AND COALESCE(
      NULLIF(to_jsonb(s)->>'ended_at', '')::TIMESTAMPTZ,
      NULLIF(to_jsonb(s)->>'updated_at', '')::TIMESTAMPTZ,
      NULLIF(to_jsonb(s)->>'started_at', '')::TIMESTAMPTZ,
      NULLIF(to_jsonb(s)->>'start_time', '')::TIMESTAMPTZ,
      NULLIF(to_jsonb(s)->>'created_at', '')::TIMESTAMPTZ
    ) >= NOW() - INTERVAL '30 days'
    AND COALESCE(
      NULLIF(to_jsonb(s)->>'ended_at', '')::TIMESTAMPTZ,
      NULLIF(to_jsonb(s)->>'updated_at', '')::TIMESTAMPTZ,
      NULLIF(to_jsonb(s)->>'started_at', '')::TIMESTAMPTZ,
      NULLIF(to_jsonb(s)->>'start_time', '')::TIMESTAMPTZ,
      NULLIF(to_jsonb(s)->>'created_at', '')::TIMESTAMPTZ
    ) <= NOW();
  END IF;

  v_performance_factor := 1 + LEAST(1, (v_live_minutes / 3000) + (v_stream_count / 100.0));

  INSERT INTO public.t_league_mission_assignments (
    user_id, mission_key, period_start, target_value, reward_points
  )
  SELECT
    p_user_id,
    catalog.mission_key,
    CASE catalog.cadence
      WHEN 'daily' THEN CURRENT_DATE
      WHEN 'weekly' THEN date_trunc('week', CURRENT_DATE::TIMESTAMP)::DATE
      ELSE v_created_at::DATE
    END,
    CEIL(catalog.target_value * CASE
      WHEN catalog.event_type = 'broadcast_minutes' THEN v_performance_factor
      ELSE 1
    END),
    CEIL(catalog.reward_points * CASE
      WHEN catalog.event_type = 'broadcast_minutes' THEN SQRT(v_performance_factor)
      ELSE 1
    END)::BIGINT
  FROM public.t_league_mission_catalog catalog
  WHERE catalog.is_enabled
    AND catalog.eligible_roles && v_roles
    AND (
      catalog.cadence <> 'onboarding'
      OR v_created_at >= NOW() - INTERVAL '14 days'
    )
  ON CONFLICT (user_id, mission_key, period_start) DO NOTHING;

  WITH assignment_totals AS (
    SELECT
      assignment.id,
      assignment.target_value,
      LEAST(assignment.target_value, COALESCE(SUM(event.event_value), 0)) AS current_value,
      COALESCE(SUM(event.event_value), 0) >= assignment.target_value AS is_completed
    FROM public.t_league_mission_assignments assignment
    JOIN public.t_league_mission_catalog catalog
      ON catalog.mission_key = assignment.mission_key
    LEFT JOIN public.t_league_mission_events event
      ON event.user_id = p_user_id
     AND event.event_type = catalog.event_type
     AND event.created_at >= assignment.period_start::TIMESTAMPTZ
     AND (
       catalog.cadence = 'onboarding'
       OR event.created_at < (assignment.period_start + CASE catalog.cadence
         WHEN 'daily' THEN 1
         WHEN 'weekly' THEN 7
         ELSE 36525
       END)::TIMESTAMPTZ
     )
    WHERE assignment.user_id = p_user_id
      AND assignment.status = 'active'
    GROUP BY
      assignment.id,
      assignment.target_value,
      catalog.cadence,
      assignment.period_start
  )
  UPDATE public.t_league_mission_assignments assignment
  SET current_value = totals.current_value,
      status = CASE WHEN totals.is_completed THEN 'completed' ELSE 'active' END,
      completed_at = CASE
        WHEN totals.is_completed THEN COALESCE(assignment.completed_at, NOW())
        ELSE NULL
      END,
      updated_at = NOW()
  FROM assignment_totals totals
  WHERE assignment.id = totals.id
    AND (
      assignment.current_value IS DISTINCT FROM totals.current_value
      OR assignment.status IS DISTINCT FROM CASE WHEN totals.is_completed THEN 'completed' ELSE 'active' END
      OR (totals.is_completed AND assignment.completed_at IS NULL)
    );

  WITH completed AS (
    UPDATE public.t_league_mission_assignments assignment
    SET points_awarded = TRUE,
        updated_at = NOW()
    WHERE assignment.user_id = p_user_id
      AND assignment.status = 'completed'
      AND assignment.points_awarded = FALSE
    RETURNING assignment.reward_points
  )
  SELECT COALESCE(SUM(reward_points), 0)
  INTO v_points_to_add
  FROM completed;

  IF v_points_to_add > 0 THEN
    INSERT INTO public.t_league_progress (user_id, total_points, updated_at)
    VALUES (p_user_id, v_points_to_add, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET total_points = public.t_league_progress.total_points + EXCLUDED.total_points,
        updated_at = NOW();
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.t_league_progress progress WHERE progress.user_id = p_user_id
  ) THEN
    INSERT INTO public.t_league_progress (user_id, total_points, updated_at)
    VALUES (p_user_id, 0, NOW())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_record_mission_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_value NUMERIC,
  p_source_table TEXT,
  p_source_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_event_type IS NULL OR p_source_table IS NULL
     OR p_source_id IS NULL OR COALESCE(p_event_value, 0) <= 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.t_league_mission_events (
    user_id, event_type, source_table, source_id, event_value
  )
  VALUES (p_user_id, p_event_type, p_source_table, p_source_id, p_event_value)
  ON CONFLICT (source_table, source_id, event_type) DO NOTHING;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  PERFORM public.t_league_refresh_user(p_user_id);
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_record_referral_click(
  p_referral_code TEXT,
  p_visitor_token UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  IF p_visitor_token IS NULL OR NULLIF(BTRIM(p_referral_code), '') IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_referrer_id := BTRIM(p_referral_code)::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_referrer_id := NULL;
  END;

  IF v_referrer_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = v_referrer_id
  ) THEN
    SELECT profile.id
    INTO v_referrer_id
    FROM public.user_profiles profile
    WHERE LOWER(profile.username) = LOWER(BTRIM(p_referral_code))
    LIMIT 1;
  END IF;

  IF v_referrer_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.t_league_referral_clicks (visitor_token, referrer_id)
  VALUES (p_visitor_token, v_referrer_id)
  ON CONFLICT (visitor_token) DO NOTHING;

  SELECT click.referrer_id
  INTO v_referrer_id
  FROM public.t_league_referral_clicks click
  WHERE click.visitor_token = p_visitor_token;

  RETURN v_referrer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_claim_referral_attribution(
  p_referred_user_id UUID,
  p_visitor_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  IF p_referred_user_id IS NULL OR p_visitor_token IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.t_league_referral_clicks click
  SET referred_user_id = p_referred_user_id,
      claimed_at = NOW()
  WHERE click.visitor_token = p_visitor_token
    AND click.referred_user_id IS NULL
    AND click.referrer_id <> p_referred_user_id
  RETURNING click.referrer_id INTO v_referrer_id;

  IF v_referrer_id IS NULL THEN
    SELECT attribution.referrer_id
    INTO v_referrer_id
    FROM public.t_league_referral_attributions attribution
    WHERE attribution.referred_user_id = p_referred_user_id
      AND attribution.visitor_token = p_visitor_token;
    RETURN v_referrer_id IS NOT NULL;
  END IF;

  INSERT INTO public.t_league_referral_attributions (
    referred_user_id, referrer_id, visitor_token
  )
  VALUES (p_referred_user_id, v_referrer_id, p_visitor_token)
  ON CONFLICT (referred_user_id) DO NOTHING;

  RETURN EXISTS (
    SELECT 1
    FROM public.t_league_referral_attributions attribution
    WHERE attribution.referred_user_id = p_referred_user_id
      AND attribution.referrer_id = v_referrer_id
      AND attribution.visitor_token = p_visitor_token
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_process_referral_viewing(
  p_viewer_id UUID,
  p_added_minutes NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_qualified BOOLEAN;
BEGIN
  IF COALESCE(p_added_minutes, 0) <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.t_league_referral_attributions attribution
  SET qualifying_view_minutes = LEAST(
        15,
        attribution.qualifying_view_minutes + p_added_minutes
      ),
      qualified_at = CASE
        WHEN attribution.qualifying_view_minutes + p_added_minutes >= 15
          THEN COALESCE(attribution.qualified_at, NOW())
        ELSE attribution.qualified_at
      END
  WHERE attribution.referred_user_id = p_viewer_id
  RETURNING attribution.referrer_id, attribution.qualified_at IS NOT NULL
  INTO v_referrer_id, v_qualified;

  IF NOT FOUND OR NOT v_qualified THEN
    RETURN;
  END IF;

  INSERT INTO public.t_league_referral_reward_ledger (
    referred_user_id, referrer_id, reward_points
  )
  VALUES (p_viewer_id, v_referrer_id, 100)
  ON CONFLICT (referred_user_id) DO NOTHING;

  PERFORM public.t_league_record_mission_event(
    v_referrer_id,
    'referral_qualified',
    1,
    't_league_referral_attributions',
    p_viewer_id::TEXT
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_t_league_viewing_heartbeat(p_stream_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_stream JSONB;
  v_owner_id UUID;
  v_session public.t_league_viewing_sessions%ROWTYPE;
  v_elapsed INTEGER;
  v_watched_seconds INTEGER;
  v_completed_minutes INTEGER;
  v_added_minutes INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT to_jsonb(stream)
  INTO v_stream
  FROM public.streams stream
  WHERE stream.id = p_stream_id;

  IF v_stream IS NULL
     OR NOT (
       COALESCE(v_stream->>'is_live', 'false') = 'true'
       OR LOWER(COALESCE(v_stream->>'status', '')) IN ('live', 'active')
     ) THEN
    UPDATE public.t_league_viewing_sessions
    SET last_heartbeat_at = NOW(),
        updated_at = NOW()
    WHERE user_id = v_user_id AND stream_id = p_stream_id;
    RETURN jsonb_build_object('credited_minutes', 0);
  END IF;

  BEGIN
    v_owner_id := COALESCE(
      NULLIF(v_stream->>'broadcaster_id', ''),
      NULLIF(v_stream->>'user_id', '')
    )::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_owner_id := NULL;
  END;

  IF v_owner_id IS NULL OR v_owner_id = v_user_id THEN
    RETURN jsonb_build_object('credited_minutes', 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.stream_audience_presence viewer
    WHERE viewer.stream_id = p_stream_id
      AND viewer.user_id = v_user_id
      AND viewer.is_active IS TRUE
      AND viewer.left_at IS NULL
      AND viewer.last_seen_at >= NOW() - INTERVAL '2 minutes'
  ) THEN
    RETURN jsonb_build_object('credited_minutes', 0);
  END IF;

  SELECT *
  INTO v_session
  FROM public.t_league_viewing_sessions
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.t_league_viewing_sessions (
      user_id, stream_id, session_id, last_heartbeat_at,
      watched_seconds, completed_minutes, updated_at
    )
    VALUES (v_user_id, p_stream_id, gen_random_uuid(), NOW(), 0, 0, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET stream_id = EXCLUDED.stream_id,
        session_id = EXCLUDED.session_id,
        last_heartbeat_at = EXCLUDED.last_heartbeat_at,
        watched_seconds = 0,
        completed_minutes = 0,
        updated_at = NOW();
    RETURN jsonb_build_object('credited_minutes', 0);
  END IF;

  IF v_session.stream_id <> p_stream_id THEN
    UPDATE public.t_league_viewing_sessions
    SET stream_id = p_stream_id,
        last_heartbeat_at = NOW(),
        updated_at = NOW()
    WHERE user_id = v_user_id;
    RETURN jsonb_build_object('credited_minutes', 0);
  END IF;

  v_elapsed := FLOOR(EXTRACT(EPOCH FROM (NOW() - v_session.last_heartbeat_at))::NUMERIC)::INTEGER;
  IF v_elapsed < 25 THEN
    RETURN jsonb_build_object('credited_minutes', 0);
  END IF;

  IF v_elapsed > 90 THEN
    UPDATE public.t_league_viewing_sessions
    SET last_heartbeat_at = NOW(),
        updated_at = NOW()
    WHERE user_id = v_user_id;
    RETURN jsonb_build_object('credited_minutes', 0);
  END IF;

  v_watched_seconds := v_session.watched_seconds + v_elapsed;
  v_completed_minutes := FLOOR(v_watched_seconds / 60.0)::INTEGER;
  v_added_minutes := v_completed_minutes - v_session.completed_minutes;

  UPDATE public.t_league_viewing_sessions
  SET last_heartbeat_at = NOW(),
      watched_seconds = v_watched_seconds,
      completed_minutes = v_completed_minutes,
      updated_at = NOW()
  WHERE user_id = v_user_id;

  IF v_added_minutes > 0 THEN
    PERFORM public.t_league_record_mission_event(
      v_user_id,
      'broadcast_view_minutes',
      v_added_minutes,
      't_league_viewing_sessions',
      v_session.session_id::TEXT || ':' || v_completed_minutes::TEXT
    );
    PERFORM public.t_league_process_referral_viewing(v_user_id, v_added_minutes);
  END IF;

  RETURN jsonb_build_object('credited_minutes', GREATEST(v_added_minutes, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_t_league_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_points BIGINT;
  v_eligible_coins BIGINT;
  v_tier INTEGER;
  v_missions JSONB;
  v_released_points BIGINT := 0;
  v_pending_referral_points BIGINT := 0;
  v_pending_referral_count BIGINT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  PERFORM public.t_league_refresh_user(v_user_id);

  WITH released_rewards AS (
    UPDATE public.t_league_referral_reward_ledger
    SET status = 'released',
        released_at = NOW()
    WHERE referrer_id = v_user_id
      AND status = 'held'
      AND release_at <= NOW()
    RETURNING reward_points
  )
  SELECT COALESCE(SUM(reward_points), 0)
  INTO v_released_points
  FROM released_rewards;

  IF v_released_points > 0 THEN
    INSERT INTO public.t_league_progress (user_id, total_points, updated_at)
    VALUES (v_user_id, v_released_points, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET total_points = public.t_league_progress.total_points + EXCLUDED.total_points,
        updated_at = NOW();
  END IF;

  SELECT COALESCE(SUM(reward_points), 0), COUNT(*)
  INTO v_pending_referral_points, v_pending_referral_count
  FROM public.t_league_referral_reward_ledger
  WHERE referrer_id = v_user_id
        AND status = 'held';

  SELECT total_points INTO v_points
  FROM public.t_league_progress
  WHERE user_id = v_user_id;
  v_points := COALESCE(v_points, 0);

  SELECT COALESCE(SUM(ct.amount), 0)::BIGINT
  INTO v_eligible_coins
  FROM public.coin_transactions ct
  JOIN public.t_league_eligible_coin_sources source
    ON source.transaction_type = ct.type
   AND source.enabled
  WHERE ct.user_id = v_user_id
    AND ct.amount > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.stream_gifts gift
      WHERE gift.id::TEXT = COALESCE(ct.metadata->>'stream_gift_id', ct.metadata->>'original_stream_gift_id')
        AND gift.is_reversed IS TRUE
    );

  v_tier := public.t_league_tier_for_points(v_points);
  IF v_tier = 500 AND v_eligible_coins < 5000000000000 THEN
    v_tier := 499;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', assignment.id,
    'missionKey', assignment.mission_key,
    'title', catalog.title,
    'description', catalog.description,
    'target', assignment.target_value,
    'current', assignment.current_value,
    'reward', assignment.reward_points,
    'completed', assignment.status = 'completed',
    'icon', CASE catalog.event_type
      WHEN 'broadcast_minutes' THEN '📡'
      WHEN 'broadcast_view_minutes' THEN '👀'
      WHEN 'battle_participation' THEN '⚔️'
      WHEN 'battle_win' THEN '🏅'
      WHEN 'referral_qualified' THEN '🤝'
      WHEN 'chat_message' THEN '💬'
      WHEN 'wall_engagement' THEN '❤️'
      WHEN 'creator_follow' THEN '👥'
      WHEN 'post_published' THEN '📝'
      WHEN 'staff_moderation_action' THEN '🛡️'
      WHEN 'maipiks_post' THEN '📸'
      WHEN 'story_published' THEN '📖'
      WHEN 'story_view' THEN '👁️'
      ELSE '🎯'
    END
  ) ORDER BY assignment.created_at, assignment.mission_key), '[]'::JSONB)
  INTO v_missions
  FROM public.t_league_mission_assignments assignment
  JOIN public.t_league_mission_catalog catalog
    ON catalog.mission_key = assignment.mission_key
  WHERE assignment.user_id = v_user_id
    AND assignment.status IN ('active', 'completed')
    AND (
      catalog.cadence = 'onboarding'
      OR assignment.period_start >= CASE catalog.cadence
        WHEN 'daily' THEN CURRENT_DATE
        ELSE date_trunc('week', CURRENT_DATE::TIMESTAMP)::DATE
      END
    );

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'total_points', v_points,
    'eligible_lifetime_coins', v_eligible_coins,
    'tier', v_tier,
    'tier_500_coin_gate_met', v_eligible_coins >= 5000000000000,
    'pending_referral_points', v_pending_referral_points,
    'pending_referral_count', v_pending_referral_count,
    'missions', v_missions
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_capture_stream_end()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new JSONB := to_jsonb(NEW);
  v_old JSONB := to_jsonb(OLD);
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_minutes NUMERIC;
  v_broadcaster_id UUID;
BEGIN
  IF NOT (
    (COALESCE(v_old->>'is_live', 'false') = 'true' AND COALESCE(v_new->>'is_live', 'false') = 'false')
    OR (COALESCE(v_old->>'status', '') IN ('live', 'active') AND COALESCE(v_new->>'status', '') IN ('ended', 'completed'))
    OR (NULLIF(v_old->>'ended_at', '') IS NULL AND NULLIF(v_new->>'ended_at', '') IS NOT NULL)
  ) THEN
    RETURN NEW;
  END IF;

  v_start := COALESCE(
    NULLIF(v_new->>'started_at', '')::TIMESTAMPTZ,
    NULLIF(v_new->>'start_time', '')::TIMESTAMPTZ,
    NULLIF(v_old->>'started_at', '')::TIMESTAMPTZ,
    NULLIF(v_old->>'start_time', '')::TIMESTAMPTZ,
    NULLIF(v_new->>'created_at', '')::TIMESTAMPTZ
  );
  v_end := COALESCE(NULLIF(v_new->>'ended_at', '')::TIMESTAMPTZ, NOW());
  v_broadcaster_id := COALESCE(
    NULLIF(v_new->>'broadcaster_id', '')::UUID,
    NULLIF(v_new->>'user_id', '')::UUID
  );
  v_minutes := LEAST(360, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_end - v_start)) / 60)));

  IF v_broadcaster_id IS NOT NULL AND v_minutes > 0 THEN
    PERFORM public.t_league_record_mission_event(
      v_broadcaster_id,
      'broadcast_minutes',
      v_minutes,
      'streams',
      v_new->>'id'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_capture_battle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new JSONB := to_jsonb(NEW);
  v_old JSONB := to_jsonb(OLD);
  v_status TEXT := LOWER(COALESCE(to_jsonb(NEW)->>'status', ''));
  v_stream_id TEXT;
  v_user_id UUID;
  v_stream_ids TEXT[];
BEGIN
  IF v_status IN ('ended', 'completed')
     AND LOWER(COALESCE(v_old->>'status', '')) NOT IN ('ended', 'completed') THEN
    v_stream_ids := ARRAY[
      NULLIF(v_new->>'challenger_stream_id', ''),
      NULLIF(v_new->>'opponent_stream_id', '')
    ];
    FOREACH v_stream_id IN ARRAY v_stream_ids LOOP
      IF v_stream_id IS NOT NULL THEN
        SELECT COALESCE(
          NULLIF(to_jsonb(stream)->>'broadcaster_id', ''),
          NULLIF(to_jsonb(stream)->>'user_id', '')
        )::UUID
        INTO v_user_id
        FROM public.streams stream
        WHERE to_jsonb(stream)->>'id' = v_stream_id;

        IF v_user_id IS NOT NULL THEN
          PERFORM public.t_league_record_mission_event(
            v_user_id,
            'battle_participation',
            1,
            'battles',
            (v_new->>'id') || ':participant:' || v_user_id::TEXT
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_status IN ('ended', 'completed')
     AND LOWER(COALESCE(v_old->>'status', '')) NOT IN ('ended', 'completed')
     AND NULLIF(v_new->>'winner_stream_id', '') IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(to_jsonb(stream)->>'broadcaster_id', ''),
      NULLIF(to_jsonb(stream)->>'user_id', '')
    )::UUID
    INTO v_user_id
    FROM public.streams stream
    WHERE to_jsonb(stream)->>'id' = v_new->>'winner_stream_id';

    IF v_user_id IS NOT NULL THEN
      PERFORM public.t_league_record_mission_event(
        v_user_id,
        'battle_win',
        1,
        'battles',
        (v_new->>'id') || ':winner:' || v_user_id::TEXT
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_capture_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new JSONB := to_jsonb(NEW);
BEGIN
  IF NULLIF(v_new->>'user_id', '') IS NOT NULL
     AND LOWER(COALESCE(v_new->>'type', '')) NOT IN ('system', 'automated', 'bot')
     AND LOWER(COALESCE(v_new->>'message_type', '')) NOT IN ('system', 'automated', 'bot')
     AND LOWER(COALESCE(v_new->>'is_automated', 'false')) <> 'true' THEN
    PERFORM public.t_league_record_mission_event(
      (v_new->>'user_id')::UUID, 'chat_message', 1, 'stream_messages', v_new->>'id'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_capture_wall_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new JSONB := to_jsonb(NEW);
  v_type TEXT := LOWER(COALESCE(to_jsonb(NEW)->>'post_type', 'text'));
BEGIN
  IF NULLIF(v_new->>'user_id', '') IS NOT NULL AND v_type = 'text' THEN
    PERFORM public.t_league_record_mission_event(
      (v_new->>'user_id')::UUID, 'post_published', 1, 'troll_wall_posts', v_new->>'id'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_capture_wall_engagement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new JSONB := to_jsonb(NEW);
  v_data JSONB := COALESCE(NULLIF(to_jsonb(NEW)->>'data', '')::JSONB, '{}'::JSONB);
  v_user_id UUID;
  v_post_id TEXT;
  v_post_owner UUID;
BEGIN
  v_user_id := NULLIF(v_new->>'user_id', '')::UUID;
  v_post_id := COALESCE(v_new->>'post_id', v_data->>'post_id', v_data->>'troll_wall_post_id');
  IF v_user_id IS NOT NULL
     AND v_post_id IS NOT NULL
     AND to_regclass('public.troll_wall_posts') IS NOT NULL THEN
    EXECUTE 'SELECT (to_jsonb(post)->>''user_id'')::UUID FROM public.troll_wall_posts post WHERE to_jsonb(post)->>''id'' = $1'
      INTO v_post_owner USING v_post_id;
  END IF;

  IF v_user_id IS NOT NULL
     AND v_post_id IS NOT NULL
     AND v_post_owner IS NOT NULL
     AND v_post_owner <> v_user_id THEN
    PERFORM public.t_league_record_mission_event(
      v_user_id,
      'wall_engagement',
      1,
      'troll_wall_engagement',
      v_user_id::TEXT || ':' || v_post_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_capture_creator_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new JSONB := to_jsonb(NEW);
BEGIN
  IF NULLIF(v_new->>'follower_id', '') IS NOT NULL
     AND NULLIF(v_new->>'following_id', '') IS NOT NULL
     AND v_new->>'follower_id' <> v_new->>'following_id' THEN
    PERFORM public.t_league_record_mission_event(
      (v_new->>'follower_id')::UUID,
      'creator_follow',
      1,
      'user_follows',
      (v_new->>'follower_id') || ':' || (v_new->>'following_id')
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_capture_moderation_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new JSONB := to_jsonb(NEW);
  v_actor_id UUID;
  v_action_type TEXT;
  v_status TEXT;
BEGIN
  v_actor_id := NULLIF(v_new->>'actor_id', '')::UUID;
  v_action_type := LOWER(COALESCE(v_new->>'action_type', ''));
  v_status := LOWER(COALESCE(v_new->>'status', 'active'));
  IF v_actor_id IS NOT NULL
     AND v_action_type NOT IN ('report', 'platform_review')
     AND v_status NOT IN ('revoked', 'expired', 'rejected') THEN
    PERFORM public.t_league_record_mission_event(
      v_actor_id,
      'staff_moderation_action',
      1,
      'broadcast_mod_actions',
      v_new->>'id'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_capture_maipiks_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new JSONB := to_jsonb(NEW);
BEGIN
  IF NULLIF(v_new->>'user_id', '') IS NOT NULL
     AND NULLIF(v_new->>'deleted_at', '') IS NULL THEN
    PERFORM public.t_league_record_mission_event(
      (v_new->>'user_id')::UUID,
      'maipiks_post',
      1,
      'maipiks_posts',
      v_new->>'id'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_capture_story_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new JSONB := to_jsonb(NEW);
BEGIN
  IF NULLIF(v_new->>'user_id', '') IS NOT NULL
     AND NULLIF(v_new->>'deleted_at', '') IS NULL THEN
    PERFORM public.t_league_record_mission_event(
      (v_new->>'user_id')::UUID,
      'story_published',
      1,
      'maipiks_stories',
      v_new->>'id'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.t_league_capture_story_view()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new JSONB := to_jsonb(NEW);
  v_viewer_id UUID;
  v_story_owner UUID;
  v_item_id TEXT;
BEGIN
  v_viewer_id := NULLIF(v_new->>'viewer_user_id', '')::UUID;
  v_item_id := v_new->>'story_item_id';

  IF v_viewer_id IS NOT NULL AND v_item_id IS NOT NULL THEN
    SELECT story.user_id
    INTO v_story_owner
    FROM public.maipiks_story_items item
    JOIN public.maipiks_stories story ON story.id = item.story_id
    WHERE item.id::TEXT = v_item_id
      AND story.deleted_at IS NULL;

    IF v_story_owner IS NOT NULL AND v_story_owner <> v_viewer_id THEN
      PERFORM public.t_league_record_mission_event(
        v_viewer_id,
        'story_view',
        1,
        'maipiks_story_views',
        v_viewer_id::TEXT || ':' || v_item_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $triggers$
BEGIN
  IF to_regclass('public.streams') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_league_stream_end ON public.streams';
    EXECUTE 'CREATE TRIGGER t_league_stream_end AFTER UPDATE ON public.streams FOR EACH ROW EXECUTE FUNCTION public.t_league_capture_stream_end()';
  END IF;
  IF to_regclass('public.battles') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_league_battle_update ON public.battles';
    EXECUTE 'CREATE TRIGGER t_league_battle_update AFTER UPDATE ON public.battles FOR EACH ROW EXECUTE FUNCTION public.t_league_capture_battle()';
    INSERT INTO public.t_league_mission_catalog
      (mission_key, title, description, event_type, target_value, reward_points, cadence, eligible_roles)
    VALUES
      ('weekly_battle_participation', 'Step into the arena', 'Participate in 3 completed live battles.', 'battle_participation', 3, 75, 'weekly', ARRAY['broadcaster']),
      ('weekly_battle_wins', 'Win the challenge', 'Win 2 live battles.', 'battle_win', 2, 100, 'weekly', ARRAY['broadcaster'])
    ON CONFLICT (mission_key) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, event_type = EXCLUDED.event_type,
        target_value = EXCLUDED.target_value, reward_points = EXCLUDED.reward_points,
        cadence = EXCLUDED.cadence, eligible_roles = EXCLUDED.eligible_roles, is_enabled = TRUE, updated_at = NOW();
  END IF;
  IF to_regclass('public.stream_messages') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_league_chat_message ON public.stream_messages';
    EXECUTE 'CREATE TRIGGER t_league_chat_message AFTER INSERT ON public.stream_messages FOR EACH ROW EXECUTE FUNCTION public.t_league_capture_chat_message()';
    INSERT INTO public.t_league_mission_catalog
      (mission_key, title, description, event_type, target_value, reward_points, cadence, eligible_roles)
    VALUES ('daily_chat', 'Join the conversation', 'Send 20 real broadcast chat messages.', 'chat_message', 20, 25, 'daily', ARRAY['all'])
    ON CONFLICT (mission_key) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, event_type = EXCLUDED.event_type,
        target_value = EXCLUDED.target_value, reward_points = EXCLUDED.reward_points,
        cadence = EXCLUDED.cadence, eligible_roles = EXCLUDED.eligible_roles, is_enabled = TRUE, updated_at = NOW();
  END IF;
  IF to_regclass('public.troll_wall_posts') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_league_wall_post ON public.troll_wall_posts';
    EXECUTE 'CREATE TRIGGER t_league_wall_post AFTER INSERT ON public.troll_wall_posts FOR EACH ROW EXECUTE FUNCTION public.t_league_capture_wall_post()';
    INSERT INTO public.t_league_mission_catalog
      (mission_key, title, description, event_type, target_value, reward_points, cadence, eligible_roles)
    VALUES
      ('weekly_posts', 'Share with the community', 'Publish 3 text posts on the Troll Wall.', 'post_published', 3, 120, 'weekly', ARRAY['all']),
      ('new_creator_post', 'Introduce yourself to the community', 'Publish your first 2 Troll Wall text posts.', 'post_published', 2, 70, 'onboarding', ARRAY['all'])
    ON CONFLICT (mission_key) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, event_type = EXCLUDED.event_type,
        target_value = EXCLUDED.target_value, reward_points = EXCLUDED.reward_points,
        cadence = EXCLUDED.cadence, eligible_roles = EXCLUDED.eligible_roles, is_enabled = TRUE, updated_at = NOW();
  END IF;
  IF to_regclass('public.troll_wall_likes') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_league_wall_like ON public.troll_wall_likes';
    EXECUTE 'CREATE TRIGGER t_league_wall_like AFTER INSERT ON public.troll_wall_likes FOR EACH ROW EXECUTE FUNCTION public.t_league_capture_wall_engagement()';
  END IF;
  IF to_regclass('public.troll_wall_reactions') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_league_wall_reaction ON public.troll_wall_reactions';
    EXECUTE 'CREATE TRIGGER t_league_wall_reaction AFTER INSERT ON public.troll_wall_reactions FOR EACH ROW EXECUTE FUNCTION public.t_league_capture_wall_engagement()';
  END IF;
  IF to_regclass('public.troll_wall_likes') IS NOT NULL
     OR to_regclass('public.troll_wall_reactions') IS NOT NULL THEN
    INSERT INTO public.t_league_mission_catalog
      (mission_key, title, description, event_type, target_value, reward_points, cadence, eligible_roles)
    VALUES ('daily_wall_engagement', 'Engage with the community', 'Like or react to 5 different Troll Wall posts.', 'wall_engagement', 5, 20, 'daily', ARRAY['all'])
    ON CONFLICT (mission_key) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, event_type = EXCLUDED.event_type,
        target_value = EXCLUDED.target_value, reward_points = EXCLUDED.reward_points,
        cadence = EXCLUDED.cadence, eligible_roles = EXCLUDED.eligible_roles, is_enabled = TRUE, updated_at = NOW();
  END IF;
  IF to_regclass('public.user_follows') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_league_creator_follow ON public.user_follows';
    EXECUTE 'CREATE TRIGGER t_league_creator_follow AFTER INSERT ON public.user_follows FOR EACH ROW EXECUTE FUNCTION public.t_league_capture_creator_follow()';
    INSERT INTO public.t_league_mission_catalog
      (mission_key, title, description, event_type, target_value, reward_points, cadence, eligible_roles)
    VALUES ('daily_follow_creators', 'Find your people', 'Follow 3 different community members.', 'creator_follow', 3, 20, 'daily', ARRAY['all'])
    ON CONFLICT (mission_key) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, event_type = EXCLUDED.event_type,
        target_value = EXCLUDED.target_value, reward_points = EXCLUDED.reward_points,
        cadence = EXCLUDED.cadence, eligible_roles = EXCLUDED.eligible_roles, is_enabled = TRUE, updated_at = NOW();
  END IF;
  IF to_regclass('public.broadcast_mod_actions') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_league_moderation_action ON public.broadcast_mod_actions';
    EXECUTE 'CREATE TRIGGER t_league_moderation_action AFTER INSERT ON public.broadcast_mod_actions FOR EACH ROW EXECUTE FUNCTION public.t_league_capture_moderation_action()';
    INSERT INTO public.t_league_mission_catalog
      (mission_key, title, description, event_type, target_value, reward_points, cadence, eligible_roles)
    VALUES ('daily_staff_moderation', 'Support a safer community', 'Complete 3 successful, audited moderation actions.', 'staff_moderation_action', 3, 60, 'daily', ARRAY['admin', 'moderator', 'troll_officer', 'lead_officer', 'secretary', 'prosecutor', 'attorney'])
    ON CONFLICT (mission_key) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, event_type = EXCLUDED.event_type,
        target_value = EXCLUDED.target_value, reward_points = EXCLUDED.reward_points,
        cadence = EXCLUDED.cadence, eligible_roles = EXCLUDED.eligible_roles, is_enabled = TRUE, updated_at = NOW();
  END IF;
  IF to_regclass('public.maipiks_posts') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_league_maipiks_post ON public.maipiks_posts';
    EXECUTE 'CREATE TRIGGER t_league_maipiks_post AFTER INSERT ON public.maipiks_posts FOR EACH ROW EXECUTE FUNCTION public.t_league_capture_maipiks_post()';
    INSERT INTO public.t_league_mission_catalog
      (mission_key, title, description, event_type, target_value, reward_points, cadence, eligible_roles)
    VALUES ('daily_maipiks_post', 'Share a moment', 'Publish a photo or video to MAIPiks.', 'maipiks_post', 1, 25, 'daily', ARRAY['all'])
    ON CONFLICT (mission_key) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, event_type = EXCLUDED.event_type,
        target_value = EXCLUDED.target_value, reward_points = EXCLUDED.reward_points,
        cadence = EXCLUDED.cadence, eligible_roles = EXCLUDED.eligible_roles, is_enabled = TRUE, updated_at = NOW();
  END IF;
  IF to_regclass('public.maipiks_stories') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_league_story_publish ON public.maipiks_stories';
    EXECUTE 'CREATE TRIGGER t_league_story_publish AFTER INSERT ON public.maipiks_stories FOR EACH ROW EXECUTE FUNCTION public.t_league_capture_story_publish()';
    INSERT INTO public.t_league_mission_catalog
      (mission_key, title, description, event_type, target_value, reward_points, cadence, eligible_roles)
    VALUES ('weekly_story', 'Keep your story going', 'Publish 3 MAIPiks stories.', 'story_published', 3, 90, 'weekly', ARRAY['all'])
    ON CONFLICT (mission_key) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, event_type = EXCLUDED.event_type,
        target_value = EXCLUDED.target_value, reward_points = EXCLUDED.reward_points,
        cadence = EXCLUDED.cadence, eligible_roles = EXCLUDED.eligible_roles, is_enabled = TRUE, updated_at = NOW();
  END IF;
  IF to_regclass('public.maipiks_story_views') IS NOT NULL
     AND to_regclass('public.maipiks_story_items') IS NOT NULL
     AND to_regclass('public.maipiks_stories') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS t_league_story_view ON public.maipiks_story_views';
    EXECUTE 'CREATE TRIGGER t_league_story_view AFTER INSERT ON public.maipiks_story_views FOR EACH ROW EXECUTE FUNCTION public.t_league_capture_story_view()';
    INSERT INTO public.t_league_mission_catalog
      (mission_key, title, description, event_type, target_value, reward_points, cadence, eligible_roles)
    VALUES ('daily_story_views', 'Catch up with the community', 'View 5 different MAIPiks stories.', 'story_view', 5, 20, 'daily', ARRAY['all'])
    ON CONFLICT (mission_key) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, event_type = EXCLUDED.event_type,
        target_value = EXCLUDED.target_value, reward_points = EXCLUDED.reward_points,
        cadence = EXCLUDED.cadence, eligible_roles = EXCLUDED.eligible_roles, is_enabled = TRUE, updated_at = NOW();
  END IF;
END
$triggers$;

REVOKE ALL ON FUNCTION public.t_league_tier_for_points(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t_league_roles_for_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t_league_refresh_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t_league_record_mission_event(UUID, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t_league_record_referral_click(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t_league_claim_referral_attribution(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t_league_process_referral_viewing(UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_t_league_viewing_heartbeat(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_t_league_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t_league_capture_battle() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t_league_capture_maipiks_post() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t_league_capture_story_publish() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t_league_capture_story_view() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_t_league_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_t_league_viewing_heartbeat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.t_league_record_referral_click(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.t_league_claim_referral_attribution(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.t_league_record_mission_event(UUID, TEXT, NUMERIC, TEXT, TEXT) TO service_role;

COMMIT;
