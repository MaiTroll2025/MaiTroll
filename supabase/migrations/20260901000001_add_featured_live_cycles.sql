-- ============================================================
-- MaiTroll Featured Live Cycles
-- Backend-controlled cycle state for Featured Live rotations.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.featured_live_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cycle_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NULL,

  winner_stream_id UUID NULL,
  winner_broadcaster_id UUID NULL,
  featured_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT featured_live_cycles_cycle_number_positive
    CHECK (cycle_number > 0),

  CONSTRAINT featured_live_cycles_featured_count_nonnegative
    CHECK (featured_count >= 0),

  CONSTRAINT featured_live_cycles_end_after_start
    CHECK (ends_at IS NULL OR ends_at > started_at)
);

CREATE INDEX IF NOT EXISTS idx_featured_live_cycles_status
  ON public.featured_live_cycles (status, ends_at, cycle_number DESC);

CREATE INDEX IF NOT EXISTS idx_featured_live_cycles_winner_stream
  ON public.featured_live_cycles (winner_stream_id);

ALTER TABLE public.featured_live_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view featured live cycles"
ON public.featured_live_cycles;

CREATE POLICY "Authenticated users can view featured live cycles"
ON public.featured_live_cycles
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Public can view featured live cycles"
ON public.featured_live_cycles;

CREATE POLICY "Public can view featured live cycles"
ON public.featured_live_cycles
FOR SELECT
TO anon
USING (true);

GRANT SELECT
ON public.featured_live_cycles
TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.featured_live_cycles
TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_featured_live_cycles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_featured_live_cycles_updated_at
ON public.featured_live_cycles;

CREATE TRIGGER trg_featured_live_cycles_updated_at
BEFORE UPDATE ON public.featured_live_cycles
FOR EACH ROW
EXECUTE FUNCTION public.refresh_featured_live_cycles_updated_at();

CREATE OR REPLACE VIEW public.active_featured_live_cycle AS
SELECT *
FROM public.featured_live_cycles
WHERE status = 'active'
  AND started_at <= NOW()
  AND (ends_at IS NULL OR ends_at > NOW());