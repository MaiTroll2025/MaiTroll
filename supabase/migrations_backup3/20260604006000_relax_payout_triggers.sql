-- Relax payout restrictions for local/dev: allow payout_requests inserts
CREATE OR REPLACE FUNCTION public.ensure_payout_not_locked() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.ensure_payout_window_open() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NEW;
END
$$;
