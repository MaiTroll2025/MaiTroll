-- Protection order cancellation: petitioner pays 500 Troll Coins to cancel an
-- active order (e.g. to re-enter a stream where the respondent is present).
BEGIN;

ALTER TABLE public.protection_orders DROP CONSTRAINT IF EXISTS protection_orders_status_check;
ALTER TABLE public.protection_orders ADD CONSTRAINT protection_orders_status_check
  CHECK (status IN ('PENDING_HEARING', 'DENIED', 'GRANTED', 'ACTIVE', 'EXPIRED', 'CANCELLED'));

CREATE OR REPLACE FUNCTION public.cancel_protection_order(p_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_petitioner UUID := auth.uid();
  v_fee INTEGER := 500;
  v_paid BOOLEAN;
BEGIN
  IF v_petitioner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.protection_orders
    WHERE id = p_order_id
      AND petitioner_uuid = v_petitioner
      AND status IN ('GRANTED', 'ACTIVE')
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Protection order is not active');
  END IF;

  SELECT public.try_pay_coins_secure(
    v_fee,
    'protection_order_cancellation',
    jsonb_build_object('protection_order_id', p_order_id)
  ) INTO v_paid;

  IF NOT COALESCE(v_paid, false) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient Troll Coins');
  END IF;

  UPDATE public.protection_orders
  SET status = 'CANCELLED', updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'status', 'CANCELLED', 'cancellation_fee', v_fee);
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_protection_order(UUID) TO authenticated;

COMMIT;
