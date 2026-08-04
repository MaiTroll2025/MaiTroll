-- ============================================================================
-- Migration: fix_missing_columns
-- Fixes missing columns reported by Bug Center on 2026-07-31
-- ============================================================================

-- 1. Add view_count to tcnn_articles (Bug #1)
ALTER TABLE public.tcnn_articles ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- 2. Add status to user_inventory (Bug #2)
ALTER TABLE public.user_inventory ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 3. Add is_active to user_roles (Bug #4)
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 4. Add raided_at to house_raids (Bugs #5, #6)
ALTER TABLE public.house_raids ADD COLUMN IF NOT EXISTS raided_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Add missing TCNN article flag used by the live app (Bug #1)
ALTER TABLE public.tcnn_articles
  ADD COLUMN IF NOT EXISTS is_breaking BOOLEAN NOT NULL DEFAULT FALSE;

-- 6. Add court summons compatibility columns used by the frontend (Bug #7)
ALTER TABLE public.court_summons
  ADD COLUMN IF NOT EXISTS summoned_user_id UUID,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

UPDATE public.court_summons
SET summoned_user_id = served_to
WHERE summoned_user_id IS NULL AND served_to IS NOT NULL;

UPDATE public.court_summons
SET reason = notes
WHERE reason IS NULL AND notes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_court_summons_summoned_user_id
  ON public.court_summons(summoned_user_id);

CREATE OR REPLACE FUNCTION public.sync_court_summons_compat()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.summoned_user_id IS NULL AND NEW.served_to IS NOT NULL THEN
    NEW.summoned_user_id := NEW.served_to;
  ELSIF NEW.served_to IS NULL AND NEW.summoned_user_id IS NOT NULL THEN
    NEW.served_to := NEW.summoned_user_id;
  END IF;

  IF NEW.reason IS NULL AND NEW.notes IS NOT NULL THEN
    NEW.reason := NEW.notes;
  ELSIF NEW.notes IS NULL AND NEW.reason IS NOT NULL THEN
    NEW.notes := NEW.reason;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_court_summons_compat ON public.court_summons;
CREATE TRIGGER trg_court_summons_compat
BEFORE INSERT OR UPDATE ON public.court_summons
FOR EACH ROW
EXECUTE FUNCTION public.sync_court_summons_compat();

-- 7. Inventory compatibility for the app's status filter (Bug #2)
ALTER TABLE public.user_inventory
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_user_inventory_status
  ON public.user_inventory(status);