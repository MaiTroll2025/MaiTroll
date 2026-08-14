-- Persistent RTC minute totals that survive stream and user deletion
-- This table stores a single cumulative row of all RTC minutes used,
-- independent of any stream or user record lifecycle.

-- ============================================================================
-- 1. Create persistent RTC minute totals table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rtc_minute_totals (
  id TEXT PRIMARY KEY DEFAULT 'global',
  total_minutes INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the single row if it doesn't exist
INSERT INTO public.rtc_minute_totals (id, total_minutes)
VALUES ('global', 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. RLS policies
-- ============================================================================

ALTER TABLE public.rtc_minute_totals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to rtc_minute_totals"
  ON public.rtc_minute_totals
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service_role full access to rtc_minute_totals"
  ON public.rtc_minute_totals
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 3. Helper functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_rtc_minutes(p_minutes INTEGER)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_minutes IS NULL OR p_minutes <= 0 THEN
    RETURN jsonb_build_object('success', true, 'added', 0);
  END IF;

  UPDATE public.rtc_minute_totals
  SET total_minutes = total_minutes + p_minutes,
      updated_at = NOW()
  WHERE id = 'global';

  RETURN jsonb_build_object('success', true, 'added', p_minutes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_rtc_minutes(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_rtc_minute_total()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(total_minutes, 0) INTO v_total
  FROM public.rtc_minute_totals
  WHERE id = 'global';

  RETURN COALESCE(v_total, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_rtc_minute_total() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reset_rtc_minute_totals()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rtc_minute_totals
  SET total_minutes = 0,
      reset_at = NOW(),
      updated_at = NOW()
  WHERE id = 'global';

  RETURN jsonb_build_object('success', true, 'reset_at', NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_rtc_minute_totals() TO authenticated, service_role;

-- ============================================================================
-- 4. Trigger on streams to persist minutes automatically
--    This captures minutes_used and gift_extension_minutes changes
--    without modifying the existing broadcast_minute_tracking functions.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.persist_stream_minutes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delta INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.minutes_used IS DISTINCT FROM NEW.minutes_used THEN
      v_delta := GREATEST(COALESCE(NEW.minutes_used, 0) - COALESCE(OLD.minutes_used, 0), 0);
      IF v_delta > 0 THEN
        PERFORM public.add_rtc_minutes(v_delta);
      END IF;
    END IF;

    IF OLD.gift_extension_minutes IS DISTINCT FROM NEW.gift_extension_minutes THEN
      v_delta := GREATEST(COALESCE(NEW.gift_extension_minutes, 0) - COALESCE(OLD.gift_extension_minutes, 0), 0);
      IF v_delta > 0 THEN
        PERFORM public.add_rtc_minutes(v_delta);
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_persist_stream_minutes ON public.streams;
CREATE TRIGGER trg_persist_stream_minutes
  AFTER INSERT OR UPDATE OF minutes_used, gift_extension_minutes ON public.streams
  FOR EACH ROW
  EXECUTE FUNCTION public.persist_stream_minutes();

-- ============================================================================
-- 5. Backfill existing stream minute data into rtc_minute_totals
--    (only runs once; safe to re-run because of WHERE clause)
-- ============================================================================

DO $$
DECLARE
  v_existing INTEGER;
BEGIN
  SELECT COALESCE(SUM(
    GREATEST(COALESCE(minutes_used, 0), 0) +
    GREATEST(COALESCE(gift_extension_minutes, 0), 0)
  ), 0) INTO v_existing
  FROM public.streams;

  IF v_existing > 0 THEN
    UPDATE public.rtc_minute_totals
    SET total_minutes = GREATEST(total_minutes, v_existing),
        updated_at = NOW()
    WHERE id = 'global';
  END IF;
END;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
