-- Fix payout notification to only fire on Mondays and Fridays at 1 AM MST (8 AM UTC)
-- This updates the function logic
-- MST is UTC-7. 1 AM MST = 8 AM UTC.

CREATE OR REPLACE FUNCTION public.notify_payouts_open_if_needed()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count integer := 0;
  v_exists boolean := false;
  v_day integer;
  v_hour integer;
BEGIN
  -- Get current day of week (0=Sunday, 1=Monday, ..., 6=Saturday) in UTC
  SELECT EXTRACT(DOW FROM NOW() AT TIME ZONE 'UTC') INTO v_day;
  -- Get current hour in UTC
  SELECT EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC') INTO v_hour;

  -- Only allow notification on Monday (1) or Friday (5)
  IF v_day NOT IN (1, 5) THEN
    RETURN 0;
  END IF;

  -- Only allow notification at 1:00 AM MST (8:00 AM UTC)
  -- We use a window of 8 to 9 AM to ensure it triggers once
  IF v_hour != 8 THEN
    RETURN 0;
  END IF;

  -- Check if we already notified today
  SELECT EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE title = 'Payouts are now open'
      AND type = 'system_update'
      AND created_at::date = now()::date
  ) INTO v_exists;

  IF v_exists THEN
    RETURN 0;
  END IF;

  SELECT public.notify_all_users(
    'Payouts are now open',
    'Payouts are now open!',
    'system_update'
  ) INTO v_count;

  RETURN v_count;
END;
$$;
