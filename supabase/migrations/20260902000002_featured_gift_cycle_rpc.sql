-- ============================================================
-- MaiTroll Featured Gift Cycle RPCs
-- ============================================================

-- Helper: find next gift in the deterministic ladder.
-- If current is NULL or missing, start at the cheapest active gift.
CREATE OR REPLACE FUNCTION public.get_next_featured_gift_id(p_current_gift_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  next_gift_id UUID;
BEGIN
  IF p_current_gift_id IS NULL THEN
    SELECT id INTO next_gift_id
    FROM public.featured_gift_ladder
    WHERE is_active = true
    ORDER BY price ASC, id ASC
    LIMIT 1;
    RETURN next_gift_id;
  END IF;

  SELECT id INTO next_gift_id
  FROM public.featured_gift_ladder
  WHERE is_active = true
    AND (price, id) > (
      SELECT price, id
      FROM public.gifts_catalog
      WHERE id = p_current_gift_id
    )
  ORDER BY price ASC, id ASC
  LIMIT 1;

  IF next_gift_id IS NULL THEN
    SELECT id INTO next_gift_id
    FROM public.featured_gift_ladder
    WHERE is_active = true
    ORDER BY price ASC, id ASC
    LIMIT 1;
  END IF;

  RETURN next_gift_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_featured_gift_id(UUID) TO authenticated, service_role, anon;

-- Get the currently active featured gift, if any.
CREATE OR REPLACE FUNCTION public.get_current_featured_gift()
RETURNS TABLE (
  cycle_id UUID,
  cycle_index INTEGER,
  gift_id UUID,
  gift_name TEXT,
  gift_price BIGINT,
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS cycle_id,
    c.cycle_index,
    c.current_gift_id AS gift_id,
    g.name AS gift_name,
    g.price::BIGINT AS gift_price,
    c.started_at,
    c.ends_at
  FROM public.active_featured_gift_cycle c
  LEFT JOIN public.gifts_catalog g ON g.id = c.current_gift_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_featured_gift() TO authenticated, service_role, anon;

-- Advance the featured gift cycle.
-- This should be called by a scheduled backend job/cron.
CREATE OR REPLACE FUNCTION public.advance_featured_gift_cycle()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  active_cycle RECORD;
  next_gift_id UUID;
  new_ends_at TIMESTAMPTZ;
BEGIN
  SELECT * INTO active_cycle
  FROM public.active_featured_gift_cycle
  LIMIT 1;

  IF active_cycle.id IS NULL THEN
    next_gift_id := public.get_next_featured_gift_id(NULL);
    new_ends_at := NOW() + INTERVAL '1 minute';

    INSERT INTO public.featured_gift_cycles (
      cycle_index,
      status,
      current_gift_id,
      started_at,
      ends_at
    ) VALUES (
      1,
      'active',
      next_gift_id,
      NOW(),
      new_ends_at
    );
    RETURN;
  END IF;

  next_gift_id := public.get_next_featured_gift_id(active_cycle.current_gift_id);
  new_ends_at := NOW() + INTERVAL '1 minute';

  UPDATE public.featured_gift_cycles
  SET
    status = 'ended',
    updated_at = NOW()
  WHERE id = active_cycle.id;

  INSERT INTO public.featured_gift_cycles (
    cycle_index,
    status,
    current_gift_id,
    started_at,
    ends_at
  ) VALUES (
    active_cycle.cycle_index + 1,
    'active',
    next_gift_id,
    NOW(),
    new_ends_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_featured_gift_cycle() TO service_role;
