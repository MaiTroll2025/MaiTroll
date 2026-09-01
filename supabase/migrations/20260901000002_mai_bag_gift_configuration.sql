-- ============================================================
-- Mai Bag broadcaster gift configuration
-- Selected gift IDs are broadcaster-private.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mai_bag_gift_configuration (
  mai_bag_id UUID NOT NULL REFERENCES public.mai_bags(id) ON DELETE CASCADE,
  gift_id UUID NOT NULL REFERENCES public.gift_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (mai_bag_id, gift_id)
);

ALTER TABLE public.mai_bag_gift_configuration ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Broadcasters can view their bag gifts"
ON public.mai_bag_gift_configuration;

CREATE POLICY "Broadcasters can view their bag gifts"
ON public.mai_bag_gift_configuration
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.mai_bags
    WHERE mai_bags.id = mai_bag_gift_configuration.mai_bag_id
      AND mai_bags.broadcaster_id = auth.uid()
  )
);

GRANT SELECT
ON public.mai_bag_gift_configuration
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.mai_bag_gift_configuration
TO service_role;

CREATE OR REPLACE FUNCTION public.configure_mai_bag_gifts(
  p_broadcast_id UUID,
  p_gift_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bag public.mai_bags%ROWTYPE;
  v_ids UUID[];
BEGIN
  SELECT * INTO v_bag
  FROM public.mai_bags
  WHERE broadcast_id = p_broadcast_id
    AND broadcaster_id = auth.uid()
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the broadcaster can configure this Mai Bag';
  END IF;

  SELECT ARRAY_AGG(gift_id ORDER BY gift_id)
  INTO v_ids
  FROM (
    SELECT DISTINCT gift_id
    FROM UNNEST(COALESCE(p_gift_ids, ARRAY[]::UUID[])) AS gift_id
    JOIN public.gift_items ON gift_items.id = gift_id
    LIMIT 5
  ) AS valid_gifts;

  DELETE FROM public.mai_bag_gift_configuration
  WHERE mai_bag_id = v_bag.id;

  INSERT INTO public.mai_bag_gift_configuration (mai_bag_id, gift_id)
  SELECT v_bag.id, gift_id
  FROM UNNEST(COALESCE(v_ids, ARRAY[]::UUID[])) AS gift_id;

  RETURN jsonb_build_object(
    'success', true,
    'selected_count', COALESCE(array_length(v_ids, 1), 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_mai_bag_gift_configuration(
  p_broadcast_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bag_id UUID;
BEGIN
  SELECT id INTO v_bag_id
  FROM public.mai_bags
  WHERE broadcast_id = p_broadcast_id
    AND broadcaster_id = auth.uid()
    AND status = 'active'
  LIMIT 1;

  IF v_bag_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'gift_ids', ARRAY[]::UUID[]);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'gift_ids', COALESCE(
      (SELECT jsonb_agg(gift_id) FROM public.mai_bag_gift_configuration WHERE mai_bag_id = v_bag_id),
      '[]'::jsonb
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.configure_mai_bag_gifts(UUID, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_mai_bag_gift_configuration(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.configure_mai_bag_gifts(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mai_bag_gift_configuration(UUID) TO authenticated;
