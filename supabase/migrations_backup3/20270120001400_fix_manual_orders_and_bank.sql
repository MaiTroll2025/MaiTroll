-- Fix Manual Orders to use Troll Bank (Loan Repayment) and Handle Troll Pass

-- 1. Ensure bank_tiers are correct
TRUNCATE TABLE public.bank_tiers;
INSERT INTO public.bank_tiers (tier_name, min_tenure_days, max_loan_coins) VALUES
('New', 0, 100),
('Established', 30, 1000),
('Veteran', 180, 2000);

-- 2. Ensure manual_coin_orders has processed_by
ALTER TABLE public.manual_coin_orders 
ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES public.user_profiles(id);

-- 3. Update approve_manual_order to use troll_bank_credit_coins and handle Troll Pass
DROP FUNCTION IF EXISTS public.approve_manual_order(uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.approve_manual_order(
  p_order_id uuid,
  p_admin_id uuid,
  p_external_tx_id text DEFAULT NULL
)
RETURNS TABLE(success boolean, error_message text, new_balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order public.manual_coin_orders%rowtype;
  v_user_id uuid;
  v_credit_result json;
  v_new_balance int;
  v_troll_pass_months int := 0;
BEGIN
  -- Get order details
  SELECT * INTO v_order
  FROM public.manual_coin_orders
  WHERE id = p_order_id AND status = 'pending'
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RETURN QUERY SELECT false, 'Order not found or not pending'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  v_user_id := v_order.user_id;

  -- Check if it's a Troll Pass order (Metadata: { type: 'troll_pass' })
  IF v_order.metadata->>'type' = 'troll_pass' THEN
      -- Handle Troll Pass (1 Month)
      v_troll_pass_months := 1; 

      -- Update or Set Expiry
      UPDATE public.user_profiles
      SET troll_pass_expires_at = CASE 
          WHEN troll_pass_expires_at > now() THEN troll_pass_expires_at + (v_troll_pass_months || ' month')::interval
          ELSE now() + (v_troll_pass_months || ' month')::interval
      END
      WHERE id = v_user_id;

      -- Log it
      INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
      VALUES (
        v_user_id,
        0,
        'purchase',
        'Troll Pass Purchase',
        jsonb_build_object('order_id', v_order.id, 'months', v_troll_pass_months, 'source', 'cashapp')
      );

      -- Get current balance for return
      SELECT troll_coins INTO v_new_balance FROM public.user_profiles WHERE id = v_user_id;

  ELSE
      -- Handle Coin Purchase (Use Troll Bank for 50% repayment logic)
      SELECT public.troll_bank_credit_coins(
          v_user_id,
          v_order.coins,
          'paid', -- Bucket: Paid coins
          'coin_purchase', -- Source
          v_order.id::text, -- Ref ID
          jsonb_build_object('admin_id', p_admin_id, 'manual_order_id', v_order.id, 'source', 'cashapp') -- Metadata
      ) INTO v_credit_result;

      -- Fetch updated balance
      SELECT troll_coins INTO v_new_balance FROM public.user_profiles WHERE id = v_user_id;
  END IF;

  -- Mark order as paid/fulfilled
  UPDATE public.manual_coin_orders
  SET status = 'fulfilled',
      paid_at = now(),
      fulfilled_at = now(),
      external_tx_id = coalesce(p_external_tx_id, external_tx_id),
      processed_by = p_admin_id
  WHERE id = p_order_id;

  RETURN QUERY SELECT true, NULL::text, v_new_balance;
END;
$$;
