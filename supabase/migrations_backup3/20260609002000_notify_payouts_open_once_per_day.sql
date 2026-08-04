-- Deduplicated payout-open broadcast: only once per day for all users

CREATE OR REPLACE FUNCTION public.notify_payouts_open_if_needed()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count integer := 0;
  v_exists boolean := false;
BEGIN
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

GRANT ALL ON FUNCTION public.notify_payouts_open_if_needed() TO anon;
GRANT ALL ON FUNCTION public.notify_payouts_open_if_needed() TO authenticated;
GRANT ALL ON FUNCTION public.notify_payouts_open_if_needed() TO service_role;

