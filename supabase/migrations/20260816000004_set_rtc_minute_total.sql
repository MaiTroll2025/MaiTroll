-- ============================================================================
-- ALLOW ADMIN TO SET RTC MINUTE TOTAL
-- Adds a function to set the exact total RTC minutes
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. RPC - SET RTC MINUTE TOTAL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_rtc_minute_total(p_minutes INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_minutes IS NULL OR p_minutes < 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Minutes must be a non-negative number');
  END IF;

  UPDATE public.rtc_minute_totals
  SET total_minutes = p_minutes,
      updated_at = NOW()
  WHERE id = 'global';

  RETURN jsonb_build_object('success', true, 'message', 'RTC minute total updated', 'total_minutes', p_minutes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_rtc_minute_total(integer) TO authenticated, service_role;

COMMIT;
