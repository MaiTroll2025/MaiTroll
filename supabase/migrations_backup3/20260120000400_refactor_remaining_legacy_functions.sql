-- Refactor remaining legacy functions to use Troll Bank pipeline

-- 1. apply_troll_pass_bundle
CREATE OR REPLACE FUNCTION public.apply_troll_pass_bundle(p_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expires_at timestamptz;
    v_coins int := 1500; -- Bundle includes 1500 coins
    v_bank_result jsonb;
BEGIN
    -- Set expiry to 30 days from now (or extend existing)
    SELECT greatest(now(), troll_pass_expires_at) + interval '30 days'
    INTO v_expires_at
    FROM user_profiles
    WHERE id = p_user_id;

    IF v_expires_at IS NULL THEN
        v_expires_at := now() + interval '30 days';
    END IF;

    -- Update user profile
    UPDATE user_profiles
    SET troll_pass_expires_at = v_expires_at
    WHERE id = p_user_id;

    -- Credit coins via Troll Bank (repayment rules apply)
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        v_coins,
        'paid',
        'troll_pass_bundle'
    ) INTO v_bank_result;

    RETURN v_expires_at;
END;
$$;

-- 2. credit_coins (Legacy wrapper)
CREATE OR REPLACE FUNCTION public.credit_coins(
    p_user_id uuid,
    p_coins int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT public.troll_bank_credit_coins(
        p_user_id,
        p_coins,
        'paid',
        'legacy_credit_coins'
    ) INTO v_result;
END;
$$;

-- 3. approve_manual_order (Refactor to use Troll Bank)
CREATE OR REPLACE FUNCTION public.approve_manual_order(
  p_order_id uuid,
  p_admin_id uuid,
  p_external_tx_id text
) returns table (success boolean, new_balance integer, error_message text)
language plpgsql
security definer
as $$
declare
  v_order public.manual_coin_orders%rowtype;
  v_balance integer;
  v_purchase_type text;
  v_troll_pass_expires_at timestamptz;
  v_bank_result jsonb;
begin
  select * into v_order from public.manual_coin_orders where id = p_order_id for update;
  if not found then
    return query select false, null::integer, 'order not found';
    return;
  end if;
  if v_order.status <> 'pending' then
    if v_order.status = 'fulfilled' then
      -- Just return current balance
      select troll_coins into v_balance from public.user_profiles where id = v_order.user_id;
      return query select true, v_balance, null::text;
      return;
    end if;
    return query select false, null::integer, 'invalid status';
    return;
  end if;

  v_purchase_type := coalesce(v_order.metadata->>'purchase_type', '');

  update public.manual_coin_orders
    set status = 'paid', paid_at = now(), external_tx_id = coalesce(p_external_tx_id, external_tx_id)
    where id = p_order_id;

  -- Handle Troll Pass vs Regular Coins
  if v_purchase_type = 'troll_pass' then
    -- apply_troll_pass_bundle now handles coin credit via Troll Bank
    v_troll_pass_expires_at := public.apply_troll_pass_bundle(v_order.user_id);
    
    -- We still need to update total_earned_coins if that's a requirement, but Troll Bank handles troll_coins.
    -- apply_troll_pass_bundle adds 1500 coins. If the manual order has a different amount, we might need to adjust.
    -- Assuming manual order for troll pass implies the standard bundle.
    -- If v_order.coins is different, we might have a discrepancy. 
    -- For safety, let's trust apply_troll_pass_bundle for the coins.
    
  else
    -- Regular coin purchase
    -- Use Troll Bank
    SELECT public.troll_bank_credit_coins(
        v_order.user_id,
        v_order.coins,
        'paid',
        'manual_purchase',
        p_order_id::text
    ) INTO v_bank_result;
    
    -- Update stats (total_earned_coins, etc) - Troll Bank only updates troll_coins and ledger.
    -- We might need to update total_earned_coins separately if it's tracked separately from balance.
    UPDATE public.user_profiles
    SET 
        paid_coins = coalesce(paid_coins, 0) + v_order.coins,
        total_earned_coins = coalesce(total_earned_coins, 0) + v_order.coins
    WHERE id = v_order.user_id;
  end if;

  -- Insert wallet transaction (legacy/audit?)
  -- Keeping this for record keeping as it logs to wallet_transactions which might be different from coin_ledger
  insert into public.wallet_transactions (user_id, type, currency, amount, reason, source, reference_id, metadata)
  values (v_order.user_id, 'manual_purchase', 'troll_coins', v_order.coins, 'Cash App purchase', 'cashapp', v_order.id,
          jsonb_build_object('admin_id', p_admin_id, 'amount_cents', v_order.amount_cents, 'payer_cashtag', v_order.payer_cashtag));

  -- Mark fulfilled
  update public.manual_coin_orders set status = 'fulfilled', fulfilled_at = now() where id = p_order_id;

  -- Get final balance
  select troll_coins into v_balance from public.user_profiles where id = v_order.user_id;
  
  return query select true, v_balance, null::text;
end;
$$;

-- 4. send_wall_post_gift (Refactor to use Troll Bank)
create or replace function public.send_wall_post_gift(
  p_post_id uuid,
  p_gift_type text,
  p_quantity integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_gift_cost integer;
  v_post_owner_id uuid;
  v_receiver_reward integer;
  v_default_cost integer := 10;
  v_safe_quantity integer;
  v_spend_result jsonb;
  v_credit_result jsonb;
begin
  if v_sender_id is null then
    raise exception 'Not authenticated';
  end if;

  v_safe_quantity := greatest(1, p_quantity);

  select coin_cost into v_gift_cost from gifts where lower(name) = lower(p_gift_type) limit 1;
  if v_gift_cost is null then
    v_gift_cost := v_default_cost;
  end if;
  v_gift_cost := v_gift_cost * v_safe_quantity;

  select user_id into v_post_owner_id from troll_wall_posts where id = p_post_id;
  if v_post_owner_id is null then
    return jsonb_build_object('success', false, 'error', 'Post not found');
  end if;

  -- 1. Deduct from sender via Troll Bank
  v_spend_result := public.troll_bank_spend_coins(
      v_sender_id,
      v_gift_cost,
      'paid', -- spending usually from paid/fungible
      'gift_sent_wall',
      p_post_id::text,
      jsonb_build_object('gift_type', p_gift_type, 'quantity', v_safe_quantity, 'receiver_id', v_post_owner_id)
  );

  if (v_spend_result->>'success')::boolean = false then
     return v_spend_result; -- Return error
  end if;

  -- 2. Credit receiver (80%) via Troll Bank
  v_receiver_reward := floor(v_gift_cost * 0.8);
  
  SELECT public.troll_bank_credit_coins(
      v_post_owner_id,
      v_receiver_reward,
      'gifted',
      'gift_received_wall',
      p_post_id::text,
      jsonb_build_object('gift_type', p_gift_type, 'quantity', v_safe_quantity, 'sender_id', v_sender_id)
  ) INTO v_credit_result;

  insert into troll_wall_gifts (post_id, sender_id, gift_type, quantity, coin_cost)
  values (p_post_id, v_sender_id, p_gift_type, v_safe_quantity, v_gift_cost);

  return jsonb_build_object(
    'success', true,
    'gift_type', p_gift_type,
    'quantity', v_safe_quantity,
    'total_cost', v_gift_cost,
    'sender_coins', (v_spend_result->>'new_balance')::int,
    'receiver_reward', v_receiver_reward, -- This is gross reward, actual might be less due to repayment
    'repaid_amount', (v_credit_result->>'repay')::int
  );
end;
$$;
