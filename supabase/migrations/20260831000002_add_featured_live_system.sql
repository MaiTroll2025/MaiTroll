-- ============================================================
-- MaiTroll Featured Live State
-- Central backend-controlled Featured state
-- ============================================================

CREATE TABLE IF NOT EXISTS public.featured_live_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  stream_id UUID NOT NULL
    REFERENCES public.streams(id)
    ON DELETE CASCADE,

  broadcaster_id UUID NOT NULL
    REFERENCES public.user_profiles(id)
    ON DELETE CASCADE,

  cycle_id UUID NULL,

  featured_score NUMERIC(12,2) NOT NULL DEFAULT 0,
  featured_rank INTEGER NOT NULL DEFAULT 0,

  featured_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  featured_ends_at TIMESTAMPTZ NOT NULL
    DEFAULT (NOW() + INTERVAL '30 minutes'),

  is_featured BOOLEAN NOT NULL DEFAULT true,

  current_viewers INTEGER NOT NULL DEFAULT 0,
  stream_coins NUMERIC(18,2) NOT NULL DEFAULT 0,
  stream_likes BIGINT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT featured_live_state_viewers_nonnegative
    CHECK (current_viewers >= 0),

  CONSTRAINT featured_live_state_coins_nonnegative
    CHECK (stream_coins >= 0),

  CONSTRAINT featured_live_state_likes_nonnegative
    CHECK (stream_likes >= 0),

  CONSTRAINT featured_live_state_rank_nonnegative
    CHECK (featured_rank >= 0),

  CONSTRAINT featured_live_state_score_nonnegative
    CHECK (featured_score >= 0),

  CONSTRAINT featured_live_state_time_valid
    CHECK (featured_ends_at > featured_started_at)
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_featured_live_state_active
  ON public.featured_live_state (
    is_featured,
    featured_ends_at,
    featured_rank
  );

CREATE INDEX IF NOT EXISTS idx_featured_live_state_stream
  ON public.featured_live_state (stream_id);

CREATE INDEX IF NOT EXISTS idx_featured_live_state_broadcaster
  ON public.featured_live_state (broadcaster_id);

CREATE INDEX IF NOT EXISTS idx_featured_live_state_cycle
  ON public.featured_live_state (cycle_id);

CREATE INDEX IF NOT EXISTS idx_featured_live_state_score
  ON public.featured_live_state (featured_score DESC);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.featured_live_state ENABLE ROW LEVEL SECURITY;

-- Clients can READ Featured state.
DROP POLICY IF EXISTS "Authenticated users can view featured live state"
ON public.featured_live_state;

CREATE POLICY "Authenticated users can view featured live state"
ON public.featured_live_state
FOR SELECT
TO authenticated
USING (true);

-- Anonymous/public Live Now pages can also read Featured state
-- if MaiTroll allows unauthenticated live browsing.
DROP POLICY IF EXISTS "Public can view featured live state"
ON public.featured_live_state;

CREATE POLICY "Public can view featured live state"
ON public.featured_live_state
FOR SELECT
TO anon
USING (true);

-- IMPORTANT:
-- There are intentionally NO INSERT/UPDATE/DELETE policies
-- for authenticated users.
--
-- Featured state must only be written by trusted backend
-- functions/service_role.

GRANT SELECT
ON public.featured_live_state
TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.featured_live_state
TO service_role;

-- ============================================================
-- Updated-at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_featured_live_state_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_featured_live_state_updated_at
ON public.featured_live_state;

CREATE TRIGGER trg_featured_live_state_updated_at
BEFORE UPDATE ON public.featured_live_state
FOR EACH ROW
EXECUTE FUNCTION public.refresh_featured_live_state_updated_at();

-- ============================================================
-- Active Featured view
-- ============================================================

CREATE OR REPLACE VIEW public.active_featured_live_state AS
SELECT *
FROM public.featured_live_state
WHERE is_featured = true
  AND featured_started_at <= NOW()
  AND featured_ends_at > NOW();
