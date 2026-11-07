CREATE OR REPLACE FUNCTION public.set_mai_calendar_events_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_mai_calendar_events_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;
