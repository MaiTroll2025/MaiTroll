CREATE OR REPLACE FUNCTION public.get_recent_platform_donations()
RETURNS TABLE (display_name text, amount_usd numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE(NULLIF(BTRIM(d.donor_name), ''), 'MaiTroll Supporter'),
    d.amount_usd
  FROM public.platform_donations AS d
  WHERE d.payment_status = 'completed'
  ORDER BY d.completed_at DESC NULLS LAST, d.created_at DESC
  LIMIT 10;
$$;

REVOKE ALL ON FUNCTION public.get_recent_platform_donations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_platform_donations() TO anon, authenticated;
