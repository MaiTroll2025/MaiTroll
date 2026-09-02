-- ============================================================
-- MaiTroll Featured Gift Cycles
-- Authoritative backend state for the Featured Gift Banner.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.featured_gift_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cycle_index INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),

  current_gift_id UUID NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT featured_gift_cycles_cycle_index_positive
    CHECK (cycle_index > 0)
);

CREATE INDEX IF NOT EXISTS idx_featured_gift_cycles_status
  ON public.featured_gift_cycles (status, ends_at, cycle_index DESC);

ALTER TABLE public.featured_gift_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view featured gift cycles"
ON public.featured_gift_cycles;
CREATE POLICY "Authenticated users can view featured gift cycles"
ON public.featured_gift_cycles
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Public can view featured gift cycles"
ON public.featured_gift_cycles;
CREATE POLICY "Public can view featured gift cycles"
ON public.featured_gift_cycles
FOR SELECT
TO anon
USING (true);

GRANT SELECT ON public.featured_gift_cycles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.featured_gift_cycles TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_featured_gift_cycles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_featured_gift_cycles_updated_at
ON public.featured_gift_cycles;
CREATE TRIGGER trg_featured_gift_cycles_updated_at
BEFORE UPDATE ON public.featured_gift_cycles
FOR EACH ROW
EXECUTE FUNCTION public.refresh_featured_gift_cycles_updated_at();

-- Active cycle view
CREATE OR REPLACE VIEW public.active_featured_gift_cycle AS
SELECT *
FROM public.featured_gift_cycles
WHERE status = 'active'
  AND started_at <= NOW()
  AND (ends_at IS NULL OR ends_at > NOW());

-- Deterministic gift ladder from existing catalog, cheapest to most expensive.
-- Ties are broken by gift ID to keep ordering stable across refreshes.
CREATE OR REPLACE VIEW public.featured_gift_ladder AS
SELECT
  id,
  name,
  price,
  rarity,
  animation_type,
  thumbnail_url,
  is_active
FROM public.gifts_catalog
WHERE is_active = true
ORDER BY price ASC, id ASC;
