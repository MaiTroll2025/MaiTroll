-- 1. Add approved_by column to manual_coin_orders
ALTER TABLE public.manual_coin_orders 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.user_profiles(id);

-- 2. Update approve_manual_order RPC to log to admin_pool_ledger and set approved_by
DROP FUNCTION IF EXISTS public.approve_manual_order(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.approve_manual_order(
  p_order_id uuid,
  p_admin_id uuid,
  p_external_tx_id text DEFAULT NULL
) returns table (success boolean, new_balance integer, error_message text)
language plpgsql
security definer
as $$
declare
  v_order public.manual_coin_orders%rowtype;
  v_balance integer;
  v_purchase_type text;
  v_troll_pass_expires_at timestamptz;
  v_admin_username text;
  v_buyer_username text;
begin
  -- Lock order
  select * into v_order from public.manual_coin_orders where id = p_order_id for update;
  
  if not found then
    return query select false, null::integer, 'order not found';
    return;
  end if;
  
  if v_order.status <> 'pending' then
    if v_order.status = 'fulfilled' or v_order.status = 'paid' then
      -- Just return current balance
      select troll_coins into v_balance from public.user_profiles where id = v_order.user_id;
      return query select true, v_balance, null::text;
      return;
    end if;
    return query select false, null::integer, 'invalid status';
    return;
  end if;

  v_purchase_type := coalesce(v_order.metadata->>'purchase_type', '');

  -- Update order status
  update public.manual_coin_orders
    set 
      status = 'paid', 
      paid_at = now(), 
      fulfilled_at = now(), -- Auto fulfill for now as it grants coins immediately
      external_tx_id = coalesce(p_external_tx_id, external_tx_id),
      approved_by = p_admin_id
    where id = p_order_id;

  -- Grant coins (Troll Bank Credit)
  -- We use direct update here for simplicity as per original RPC, 
  -- but ideally should use troll_bank_credit_coins if available.
  -- The original RPC used direct update, so we keep it but ensure it's logged.
  
  UPDATE public.user_profiles
  SET troll_coins = troll_coins + v_order.coins
  WHERE id = v_order.user_id
  RETURNING troll_coins INTO v_balance;

  -- Log transaction in coin_transactions
  INSERT INTO public.coin_transactions (user_id, amount, type, reference, description)
  VALUES (v_order.user_id, v_order.coins, 'manual_order', p_order_id::TEXT, 'Manual Coin Order Approved');

  -- Handle Troll Pass if needed
  if v_purchase_type = 'troll_pass' then
    v_troll_pass_expires_at := public.apply_troll_pass_bundle(v_order.user_id);
  end if;

  -- Log to Admin Pool Ledger (Audit Log)
  -- Get usernames for better logging
  SELECT username INTO v_admin_username FROM public.user_profiles WHERE id = p_admin_id;
  SELECT username INTO v_buyer_username FROM public.user_profiles WHERE id = v_order.user_id;

  INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at)
  VALUES (
    v_order.coins, 
    'Manual Order Approved for @' || coalesce(v_buyer_username, 'unknown') || ' by @' || coalesce(v_admin_username, 'unknown'), 
    p_admin_id, 
    NOW()
  );

  return query select true, v_balance, null::text;
END;
$$;
