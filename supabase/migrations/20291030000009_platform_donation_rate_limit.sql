CREATE TABLE IF NOT EXISTS public.platform_donation_rate_limits (
  rate_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0)
);

ALTER TABLE public.platform_donation_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_donation_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.platform_donation_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.check_platform_donation_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_key IS NULL
    OR length(p_key) > 128
    OR p_limit < 1
    OR p_window_seconds < 1
  THEN
    RAISE EXCEPTION 'Invalid donation rate-limit parameters'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.platform_donation_rate_limits AS current_limit (
    rate_key,
    window_started_at,
    request_count
  )
  VALUES (p_key, v_now, 1)
  ON CONFLICT (rate_key) DO UPDATE
  SET
    window_started_at = CASE
      WHEN current_limit.window_started_at <= v_now - p_window_seconds * interval '1 second'
        THEN v_now
      ELSE current_limit.window_started_at
    END,
    request_count = CASE
      WHEN current_limit.window_started_at <= v_now - p_window_seconds * interval '1 second'
        THEN 1
      ELSE current_limit.request_count + 1
    END
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.check_platform_donation_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_platform_donation_rate_limit(text, integer, integer) TO service_role;
