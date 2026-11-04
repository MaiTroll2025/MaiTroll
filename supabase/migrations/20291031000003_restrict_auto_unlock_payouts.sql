-- Payout unlocking is a controlled state transition and must be backend-only.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.auto_unlock_payouts()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.auto_unlock_payouts() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.auto_unlock_payouts() TO service_role;
  END IF;
END;
$$;

COMMIT;
