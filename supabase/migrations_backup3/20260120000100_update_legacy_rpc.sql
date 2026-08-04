-- Update credit_coins to use Troll Bank pipeline
DROP FUNCTION IF EXISTS public.credit_coins(uuid, integer, uuid);

CREATE OR REPLACE FUNCTION public.credit_coins(
  p_user_id uuid,
  p_coins integer,
  p_order_id uuid
)
RETURNS TABLE (
  success boolean,
  new_balance integer,
  error text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_balance bigint;
  v_bank_result json;
BEGIN
  -- Validate Order
  SELECT * INTO v_order FROM public.coin_orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, null::integer, 'order not found';
    RETURN;
  END IF;

  IF v_order.user_id <> p_user_id THEN
    RETURN QUERY SELECT false, null::integer, 'user mismatch';
    RETURN;
  END IF;

  IF v_order.status <> 'paid' THEN
    IF v_order.status = 'fulfilled' THEN
      SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = p_user_id;
      RETURN QUERY SELECT true, v_balance::integer, null::text;
      RETURN;
    END IF;
    RETURN QUERY SELECT false, null::integer, 'order not paid';
    RETURN;
  END IF;

  -- Use Troll Bank Centralized Credit
  -- bucket='paid', source='coin_purchase'
  SELECT public.troll_bank_credit_coins(
    p_user_id,
    p_coins,
    'paid',
    'coin_purchase',
    p_order_id::text
  ) INTO v_bank_result;

  -- Update order status
  UPDATE public.coin_orders
  SET status = 'fulfilled',
      fulfilled_at = now()
  WHERE id = p_order_id;

  -- Get final balance
  SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = p_user_id;
  
  RETURN QUERY SELECT true, v_balance::integer, null::text;
END;
$$;
