-- The deployed jail.bond_amount column is BIGINT, so the RPC result must match it.
DROP FUNCTION IF EXISTS public.is_user_jailed(UUID);

CREATE FUNCTION public.is_user_jailed(p_user_id UUID)
RETURNS TABLE (
  is_jailed BOOLEAN,
  jail_id UUID,
  discipline_level INTEGER,
  scheduled_release_at TIMESTAMPTZ,
  bond_amount BIGINT,
  bond_allowed BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.status = 'jailed' AND j.scheduled_release_at > now(),
    j.id,
    j.discipline_level,
    j.scheduled_release_at,
    j.bond_amount,
    j.bond_allowed
  FROM public.jail j
  WHERE j.user_id = p_user_id
    AND j.status = 'jailed'
    AND j.scheduled_release_at > now()
  ORDER BY j.jailed_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_user_jailed(UUID) TO authenticated, service_role;
