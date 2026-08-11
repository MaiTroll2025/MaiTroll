-- Fix missing ends_at column on trollmin_current
-- The live database had a trollmin_current table without ends_at,
-- but the trigger set_trollmin_ends_at() tries to assign NEW.ends_at,
-- causing: record "new" has no field "ends_at"

ALTER TABLE public.trollmin_current
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_trollmin_ends_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.ends_at := NEW.started_at + (NEW.term_days * INTERVAL '1 day');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_trollmin_ends_at ON public.trollmin_current;

CREATE TRIGGER trigger_set_trollmin_ends_at
    BEFORE INSERT OR UPDATE ON public.trollmin_current
    FOR EACH ROW
    EXECUTE FUNCTION public.set_trollmin_ends_at();