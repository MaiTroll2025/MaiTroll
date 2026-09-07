-- ============================================================================
-- Migration: MaiTroll Signal Engine foundation
-- Date: 2026-09-07
-- Purpose: Store canonical signal events and server-authoritative score snapshots.
--          Surface rankers consume these shared signals; they do not redefine
--          public, trust, or quality eligibility rules.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.maitroll_signal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'impression',
    'click',
    'watch_start',
    'watch_progress',
    'watch_complete',
    'skip',
    'listen_start',
    'listen_progress',
    'listen_complete',
    'like',
    'reaction',
    'comment',
    'share',
    'follow',
    'hide',
    'report',
    'gift',
    'return_visit',
    'moderation_update',
    'trust_update'
  )),
  surface TEXT CHECK (surface IN (
    'live_now',
    'for_you',
    'gift_momentum',
    'hytrogames',
    'podcast',
    'troll_wall',
    'profile_discovery'
  )),
  content_type TEXT NOT NULL CHECK (content_type IN (
    'broadcast',
    'hytrogame',
    'podcast',
    'troll_wall_post',
    'profile',
    'court_session',
    'marketplace_listing',
    'tcnn_article'
  )),
  content_id UUID NOT NULL,
  creator_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  value NUMERIC(12, 4) NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maitroll_signal_events_content_time
  ON public.maitroll_signal_events(content_type, content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_maitroll_signal_events_creator_time
  ON public.maitroll_signal_events(creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_maitroll_signal_events_type_time
  ON public.maitroll_signal_events(event_type, created_at DESC);

ALTER TABLE public.maitroll_signal_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own signal events" ON public.maitroll_signal_events;
CREATE POLICY "Users can read own signal events"
  ON public.maitroll_signal_events
  FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read signal events" ON public.maitroll_signal_events;
CREATE POLICY "Admins can read signal events"
  ON public.maitroll_signal_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.role = 'admin' OR up.is_admin = true)
    )
  );

CREATE TABLE IF NOT EXISTS public.maitroll_signal_content_scores (
  content_type TEXT NOT NULL CHECK (content_type IN (
    'broadcast',
    'hytrogame',
    'podcast',
    'troll_wall_post',
    'profile',
    'court_session',
    'marketplace_listing',
    'tcnn_article'
  )),
  content_id UUID NOT NULL,
  creator_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_eligible BOOLEAN NOT NULL DEFAULT false,
  trust_state TEXT NOT NULL DEFAULT 'unknown' CHECK (trust_state IN ('trusted', 'unknown', 'review', 'blocked')),
  quality_state TEXT NOT NULL DEFAULT 'unknown' CHECK (quality_state IN ('unknown', 'accepted', 'rejected')),
  pulse_score NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (pulse_score >= 0 AND pulse_score <= 100),
  troll_energy NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (troll_energy >= 0 AND troll_energy <= 100),
  feature_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  score_version TEXT NOT NULL DEFAULT 'rules-v1',
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_maitroll_signal_content_scores_discovery
  ON public.maitroll_signal_content_scores(is_eligible, pulse_score DESC)
  WHERE is_public = true AND is_eligible = true;

CREATE INDEX IF NOT EXISTS idx_maitroll_signal_content_scores_creator
  ON public.maitroll_signal_content_scores(creator_id, pulse_score DESC);

ALTER TABLE public.maitroll_signal_content_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read eligible signal scores" ON public.maitroll_signal_content_scores;
CREATE POLICY "Public can read eligible signal scores"
  ON public.maitroll_signal_content_scores
  FOR SELECT
  USING (is_public = true AND is_eligible = true);

DROP POLICY IF EXISTS "Admins can manage signal scores" ON public.maitroll_signal_content_scores;
CREATE POLICY "Admins can manage signal scores"
  ON public.maitroll_signal_content_scores
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.role = 'admin' OR up.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.role = 'admin' OR up.is_admin = true)
    )
  );

CREATE TABLE IF NOT EXISTS public.maitroll_signal_creator_scores (
  creator_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  troll_energy NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (troll_energy >= 0 AND troll_energy <= 100),
  energy_band TEXT NOT NULL DEFAULT 'low' CHECK (energy_band IN ('low', 'building', 'good', 'high', 'maximum')),
  feature_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  score_version TEXT NOT NULL DEFAULT 'rules-v1',
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.maitroll_signal_creator_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creators can read own signal score" ON public.maitroll_signal_creator_scores;
CREATE POLICY "Creators can read own signal score"
  ON public.maitroll_signal_creator_scores
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage creator signal scores" ON public.maitroll_signal_creator_scores;
CREATE POLICY "Admins can manage creator signal scores"
  ON public.maitroll_signal_creator_scores
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.role = 'admin' OR up.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.role = 'admin' OR up.is_admin = true)
    )
  );

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
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF p_event_type IN ('gift', 'moderation_update', 'trust_update') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event type is server-authoritative');
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
GRANT EXECUTE ON FUNCTION public.record_maitroll_signal_event(TEXT, TEXT, UUID, UUID, TEXT, NUMERIC, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_maitroll_signal_event(TEXT, TEXT, UUID, UUID, TEXT, NUMERIC, JSONB) TO service_role;
